import express from "express";
import pool from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { calculateTotalFee, splitFee } from "../utils/calculateFee.js";
import { createMomoPayment } from "../services/momoService.js";
import crypto from "crypto";

const router = express.Router();

// Lấy thông tin ví và lịch sử giao dịch
router.get("/my-wallet", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Lấy thông tin ví
    let [[wallet]] = await pool.query(
      "SELECT * FROM wallets WHERE user_id = ?",
      [userId]
    );

    // Nếu chưa có ví thì tạo mới
    if (!wallet) {
      await pool.query(
        "INSERT INTO wallets (user_id, balance, bonus_balance) VALUES (?, 0, 0)",
        [userId]
      );
      wallet = { user_id: userId, balance: 0, bonus_balance: 0 };
    }

    // Lấy lịch sử giao dịch
    const [transactions] = await pool.query(
      "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    res.json({ success: true, wallet, transactions });
  } catch (error) {
    console.error("GET /wallet/my-wallet error:", error);
    res.status(500).json({ error: "Lỗi khi lấy thông tin ví" });
  }
});

// Nạp tiền ảo (Mock Deposit)
router.post("/mock-deposit", authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Số tiền không hợp lệ" });
    }

    await connection.beginTransaction();

    // Lấy hoặc tạo ví
    let [[wallet]] = await connection.query(
      "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
      [userId]
    );

    if (!wallet) {
      await connection.query(
        "INSERT INTO wallets (user_id, balance, bonus_balance) VALUES (?, 0, 0)",
        [userId]
      );
      wallet = { user_id: userId, balance: 0, bonus_balance: 0 };
    }

    // Cộng tiền vào balance
    await connection.query(
      "UPDATE wallets SET balance = balance + ? WHERE user_id = ?",
      [amount, userId]
    );

    // Ghi log giao dịch
    await connection.query(
      `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
       VALUES (?, ?, 'deposit', 'mock_deposit', 'balance', 'Nạp tiền ảo')`,
      [userId, amount]
    );

    await connection.commit();
    res.json({ success: true, message: "Nạp tiền thành công", new_balance: Number(wallet.balance) + amount });
  } catch (error) {
    await connection.rollback();
    console.error("POST /wallet/mock-deposit error:", error);
    res.status(500).json({ error: "Lỗi nạp tiền" });
  } finally {
    connection.release();
  }
});

// Thanh toán hoa hồng chốt đơn
router.post("/pay-commission", authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const requestId = Number(req.body.request_id);

    if (!requestId) {
      return res.status(400).json({ error: "Thiếu mã yêu cầu" });
    }

    await connection.beginTransaction();

    // 1. Lấy thông tin đơn hàng
    const [[request]] = await connection.query(
      "SELECT id, buyer_id, farmer_id, proposed_price, quantity, status FROM purchase_requests WHERE id = ?",
      [requestId]
    );

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ error: "Không tìm thấy yêu cầu" });
    }

    if (userId !== request.buyer_id && userId !== request.farmer_id) {
      await connection.rollback();
      return res.status(403).json({ error: "Không có quyền thanh toán" });
    }

    // 2. Tính phí
    const totalValue = Number(request.proposed_price) * Number(request.quantity);
    const totalFee = calculateTotalFee(totalValue);
    const { farmerFee, dealerFee } = splitFee(totalFee);
    
    const isFarmer = userId === request.farmer_id;
    const feeAmountToPay = isFarmer ? farmerFee : dealerFee;

    // 3. Kiểm tra số dư ví
    let [[wallet]] = await connection.query(
      "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
      [userId]
    );

    if (!wallet || Number(wallet.balance) < feeAmountToPay) {
      await connection.rollback();
      return res.status(400).json({ error: "Số dư Ví Nông Xu không đủ để thanh toán hoa hồng" });
    }

    // 4. Trừ tiền (Hoa hồng chỉ được trừ từ balance)
    await connection.query(
      "UPDATE wallets SET balance = balance - ? WHERE user_id = ?",
      [feeAmountToPay, userId]
    );

    // 5. Ghi log transaction
    await connection.query(
      `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note)
       VALUES (?, ?, 'deduct', 'commission', 'balance', ?)`,
      [userId, feeAmountToPay, `Thanh toán hoa hồng cho đơn #${requestId}`]
    );

    // 6. Cập nhật bảng commissions
    let [[commission]] = await connection.query(
      "SELECT id, farmer_status, buyer_status FROM commissions WHERE request_id = ?",
      [requestId]
    );

    let newFarmerStatus = isFarmer ? 'paid' : (commission ? commission.farmer_status : 'unpaid');
    let newBuyerStatus = !isFarmer ? 'paid' : (commission ? commission.buyer_status : 'unpaid');

    if (!commission) {
      await connection.query(
        `INSERT INTO commissions (request_id, farmer_id, buyer_id, total_amount, fee_amount, farmer_status, buyer_status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [requestId, request.farmer_id, request.buyer_id, totalValue, totalFee, newFarmerStatus, newBuyerStatus]
      );
    } else {
      await connection.query(
        "UPDATE commissions SET farmer_status = ?, buyer_status = ? WHERE request_id = ?", 
        [newFarmerStatus, newBuyerStatus, requestId]
      );
    }

    // 7. Kiểm tra nếu cả 2 đã thanh toán thì chuyển đơn hàng sang Hoàn thành
    let orderCompleted = false;
    if (newFarmerStatus === 'paid' && newBuyerStatus === 'paid') {
      await connection.query(
        "UPDATE purchase_requests SET status = 'completed' WHERE id = ?",
        [requestId]
      );
      orderCompleted = true;
    }

    await connection.commit();

    // 8. Bắn sự kiện realtime qua Socket.io
    const io = req.app.get("io");
    if (io) {
      // Thông báo cho phía đối tác biết mình đã thanh toán
      const partnerId = isFarmer ? request.buyer_id : request.farmer_id;
      io.to(`user:${partnerId}`).emit("commission_paid", {
        request_id: requestId,
        paid_by: userId,
        role: isFarmer ? 'farmer' : 'buyer'
      });

      // Nếu đơn hàng hoàn thành, thông báo cho cả 2
      if (orderCompleted) {
        io.to(`user:${request.farmer_id}`).emit("order_completed", { request_id: requestId });
        io.to(`user:${request.buyer_id}`).emit("order_completed", { request_id: requestId });
      }
    }

    res.json({ success: true, message: "Thanh toán hoa hồng thành công", orderCompleted });
  } catch (error) {
    await connection.rollback();
    console.error("POST /wallet/pay-commission error:", error);
    res.status(500).json({ error: "Lỗi thanh toán hoa hồng" });
  } finally {
    connection.release();
  }
});

// Mock api lấy thông tin invoice trước khi chốt đơn (để show popup)
router.get("/invoice-preview/:requestId", authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.requestId);
    
    const [[request]] = await pool.query(
      `SELECT pr.id, pr.proposed_price, pr.quantity, p.name as product_name
       FROM purchase_requests pr
       JOIN products p ON p.id = pr.product_id
       WHERE pr.id = ?`,
      [requestId]
    );

    if (!request) return res.status(404).json({ error: "Không tìm thấy yêu cầu" });

    const totalValue = Number(request.proposed_price) * Number(request.quantity);
    const totalFee = calculateTotalFee(totalValue);
    const { farmerFee, dealerFee } = splitFee(totalFee);
    
    // Check if current user is farmer or buyer
    let isFarmer = false;
    let isBuyer = false;
    // We don't have farmer_id and buyer_id in the SELECT, let's update the SELECT!
    const [[reqDetail]] = await pool.query(
      `SELECT farmer_id, buyer_id FROM purchase_requests WHERE id = ?`,
      [requestId]
    );

    if (reqDetail) {
      isFarmer = req.user.id === reqDetail.farmer_id;
      isBuyer = req.user.id === reqDetail.buyer_id;
    }

    const feeAmountToPay = isFarmer ? farmerFee : (isBuyer ? dealerFee : 0);

    res.json({
      success: true,
      product_name: request.product_name,
      proposed_price: Number(request.proposed_price),
      quantity: Number(request.quantity),
      total_value: totalValue,
      fee_amount: feeAmountToPay
    });
  } catch (error) {
    console.error("GET /wallet/invoice-preview error:", error);
    res.status(500).json({ error: "Lỗi khi lấy thông tin hoá đơn" });
  }
});

// ============================================================
// Nạp tiền qua MoMo
// ============================================================
router.post("/deposit", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const amount = Number(req.body.amount);

    if (!amount || amount < 10000) {
      return res.status(400).json({ error: "Số tiền tối thiểu là 10,000đ" });
    }

    if (amount > 50000000) {
      return res.status(400).json({ error: "Số tiền tối đa là 50,000,000đ" });
    }

    const isSimulate = process.env.PAYMENT_SIMULATE === 'true';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000/api';

    // Tạo orderId unique
    const orderId = `DEPOSIT_${userId}_${Date.now()}`;

    if (isSimulate) {
      // Simulate mode: cộng tiền trực tiếp
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        let [[wallet]] = await connection.query(
          "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
          [userId]
        );

        if (!wallet) {
          await connection.query(
            "INSERT INTO wallets (user_id, balance, bonus_balance) VALUES (?, 0, 0)",
            [userId]
          );
        }

        await connection.query(
          "UPDATE wallets SET balance = balance + ? WHERE user_id = ?",
          [amount, userId]
        );

        await connection.query(
          `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
           VALUES (?, ?, 'deposit', 'mock_deposit', 'balance', ?)`,
          [userId, amount, `Nạp tiền (giả lập) - ${orderId}`]
        );

        await connection.commit();

        const [[updatedWallet]] = await pool.query("SELECT * FROM wallets WHERE user_id = ?", [userId]);
        res.json({ 
          success: true, 
          message: "Nạp tiền thành công (giả lập)", 
          new_balance: Number(updatedWallet.balance),
          simulated: true
        });
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
      return;
    }

    // MoMo thật
    const momoData = await createMomoPayment({
      orderId,
      amount,
      orderInfo: `Nap tien vi Nong Xu - ${amount.toLocaleString()}d`,
      redirectUrl: `${frontendUrl}/wallet?momo-deposit=1&amount=${amount}&orderId=${orderId}`,
      cancelUrl: `${frontendUrl}/wallet?momo-deposit=1&status=cancel`,
      ipnUrl: `${backendUrl}/wallet/momo/webhook`,
    });

    const payUrl = momoData.payUrl || momoData.deeplink || momoData.qrCodeUrl || '';
    const qrCodeUrl = momoData.qrCodeUrl || null;

    res.json({
      success: true,
      payUrl,
      qrCodeUrl,
      orderId,
      amount
    });
  } catch (error) {
    console.error("POST /wallet/deposit error:", error);
    res.status(500).json({ error: "Lỗi tạo giao dịch nạp tiền: " + (error.message || "Unknown") });
  }
});

// MoMo Webhook cho nạp tiền ví
router.post("/momo/webhook", async (req, res) => {
  try {
    const {
      partnerCode, orderId, amount, resultCode, transId,
      message, signature, requestId, orderInfo, orderType,
      payType, responseTime, extraData
    } = req.body;

    // Xác thực chữ ký
    const secretKey = process.env.MOMO_SECRET_KEY || "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    const accessKey = process.env.MOMO_ACCESS_KEY || "F8BBA842ECF85";

    const rawSignature =
      `accessKey=${accessKey}` +
      `&amount=${amount}` +
      `&extraData=${extraData}` +
      `&message=${message}` +
      `&orderId=${orderId}` +
      `&orderInfo=${orderInfo}` +
      `&orderType=${orderType}` +
      `&partnerCode=${partnerCode}` +
      `&payType=${payType}` +
      `&requestId=${requestId}` +
      `&responseTime=${responseTime}` +
      `&resultCode=${resultCode}` +
      `&transId=${transId}`;

    const expectedSig = crypto
      .createHmac("sha256", secretKey)
      .update(rawSignature)
      .digest("hex");

    if (expectedSig !== signature) {
      console.error("[Wallet MoMo Webhook] Chữ ký không hợp lệ!");
      return res.status(400).json({ success: false, error: "Invalid signature" });
    }

    // Chỉ xử lý khi thanh toán thành công
    if (resultCode !== 0) {
      console.log(`[Wallet MoMo Webhook] Thanh toán thất bại (resultCode=${resultCode})`);
      return res.json({ success: true });
    }

    // Parse userId từ orderId: DEPOSIT_{userId}_{timestamp}
    const parts = String(orderId).split("_");
    const userId = Number(parts[1]);
    const depositAmount = Number(amount);

    if (!userId || !depositAmount) {
      console.error("[Wallet MoMo Webhook] Không parse được userId/amount từ orderId:", orderId);
      return res.json({ success: true });
    }

    // Cộng tiền vào ví
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let [[wallet]] = await connection.query(
        "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
        [userId]
      );

      if (!wallet) {
        await connection.query(
          "INSERT INTO wallets (user_id, balance, bonus_balance) VALUES (?, 0, 0)",
          [userId]
        );
      }

      await connection.query(
        "UPDATE wallets SET balance = balance + ? WHERE user_id = ?",
        [depositAmount, userId]
      );

      await connection.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
         VALUES (?, ?, 'deposit', 'mock_deposit', 'balance', ?)`,
        [userId, depositAmount, `Nạp tiền MoMo - ${transId}`]
      );

      await connection.commit();
      console.log(`✅ [Wallet MoMo Webhook] Đã nạp ${depositAmount}đ cho user ${userId}`);
    } catch (dbErr) {
      await connection.rollback();
      throw dbErr;
    } finally {
      connection.release();
    }

    res.json({ success: true });
  } catch (error) {
    console.error("[Wallet MoMo Webhook] Lỗi:", error.message);
    res.json({ success: false, error: error.message });
  }
});

// Confirm nạp tiền cho localhost (MoMo redirect về nhưng webhook không gọi được)
router.post("/deposit/confirm", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { orderId, amount } = req.body;
    const depositAmount = Number(amount);

    if (!orderId || !depositAmount || depositAmount <= 0) {
      return res.status(400).json({ error: "Thiếu thông tin giao dịch" });
    }

    // Kiểm tra orderId có đúng format và thuộc user này không
    const expectedPrefix = `DEPOSIT_${userId}_`;
    if (!String(orderId).startsWith(expectedPrefix)) {
      return res.status(403).json({ error: "Giao dịch không hợp lệ" });
    }

    // Kiểm tra đã xử lý chưa (tránh duplicate)
    const [existing] = await pool.query(
      "SELECT id FROM wallet_transactions WHERE user_id = ? AND note LIKE ?",
      [userId, `%${orderId}%`]
    );
    if (existing.length > 0) {
      return res.json({ success: true, message: "Giao dịch đã được xử lý trước đó" });
    }

    // Cộng tiền
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let [[wallet]] = await connection.query(
        "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
        [userId]
      );

      if (!wallet) {
        await connection.query(
          "INSERT INTO wallets (user_id, balance, bonus_balance) VALUES (?, 0, 0)",
          [userId]
        );
      }

      await connection.query(
        "UPDATE wallets SET balance = balance + ? WHERE user_id = ?",
        [depositAmount, userId]
      );

      await connection.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
         VALUES (?, ?, 'deposit', 'mock_deposit', 'balance', ?)`,
        [userId, depositAmount, `Nạp tiền MoMo - ${orderId}`]
      );

      await connection.commit();
    } catch (dbErr) {
      await connection.rollback();
      throw dbErr;
    } finally {
      connection.release();
    }

    const [[updatedWallet]] = await pool.query("SELECT * FROM wallets WHERE user_id = ?", [userId]);
    res.json({ success: true, message: "Nạp tiền thành công", new_balance: Number(updatedWallet.balance) });
  } catch (error) {
    console.error("POST /wallet/deposit/confirm error:", error);
    res.status(500).json({ error: "Lỗi xác nhận nạp tiền" });
  }
});

export default router;
