import express from "express";
import pool from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { calculateTotalFee, splitFee } from "../utils/calculateFee.js";

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

    // 5b. Nếu là người mua (đại lý), cập nhật trạng thái dealer_fee trong purchase_requests
    if (!isFarmer) {
      await connection.query(
        `UPDATE purchase_requests 
         SET dealer_fee_status = 'recorded', 
             dealer_fee_amount = ?, 
             dealer_action_at = NOW() 
         WHERE id = ?`,
        [feeAmountToPay, requestId]
      );
    }

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

export default router;
