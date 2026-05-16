import express from "express";
import pool from "../db.js";
import { authenticateToken } from "../middleware/auth.js";
import { calculateTotalFee, splitFee } from "../utils/calculateFee.js";

const router = express.Router();

// Lß║Ñy th├┤ng tin v├¡ v├á lß╗ïch sß╗¡ giao dß╗ïch
router.get("/my-wallet", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Lß║Ñy th├┤ng tin v├¡
    let [[wallet]] = await pool.query(
      "SELECT * FROM wallets WHERE user_id = ?",
      [userId]
    );

    // Nß║┐u ch╞░a c├│ v├¡ th├¼ tß║ío mß╗¢i
    if (!wallet) {
      await pool.query(
        "INSERT INTO wallets (user_id, balance, bonus_balance) VALUES (?, 0, 0)",
        [userId]
      );
      wallet = { user_id: userId, balance: 0, bonus_balance: 0 };
    }

    // Lß║Ñy lß╗ïch sß╗¡ giao dß╗ïch
    const [transactions] = await pool.query(
      "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC",
      [userId]
    );

    res.json({ success: true, wallet, transactions });
  } catch (error) {
    console.error("GET /wallet/my-wallet error:", error);
    res.status(500).json({ error: "Lß╗ùi khi lß║Ñy th├┤ng tin v├¡" });
  }
});

// Nß║íp tiß╗ün ß║úo (Mock Deposit)
router.post("/mock-deposit", authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const amount = Number(req.body.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Sß╗æ tiß╗ün kh├┤ng hß╗úp lß╗ç" });
    }

    await connection.beginTransaction();

    // Lß║Ñy hoß║╖c tß║ío v├¡
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

    // Cß╗Öng tiß╗ün v├áo balance
    await connection.query(
      "UPDATE wallets SET balance = balance + ? WHERE user_id = ?",
      [amount, userId]
    );

    // Ghi log giao dß╗ïch
    await connection.query(
      `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
       VALUES (?, ?, 'deposit', 'mock_deposit', 'balance', 'Nß║íp tiß╗ün ß║úo')`,
      [userId, amount]
    );

    await connection.commit();
    res.json({ success: true, message: "Nß║íp tiß╗ün th├ánh c├┤ng", new_balance: Number(wallet.balance) + amount });
  } catch (error) {
    await connection.rollback();
    console.error("POST /wallet/mock-deposit error:", error);
    res.status(500).json({ error: "Lß╗ùi nß║íp tiß╗ün" });
  } finally {
    connection.release();
  }
});

// Thanh to├ín hoa hß╗ông chß╗æt ─æ╞ín
router.post("/pay-commission", authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const userId = req.user.id;
    const requestId = Number(req.body.request_id);

    if (!requestId) {
      return res.status(400).json({ error: "Thiß║┐u m├ú y├¬u cß║ºu" });
    }

    await connection.beginTransaction();

    // 1. Lß║Ñy th├┤ng tin ─æ╞ín h├áng
    const [[request]] = await connection.query(
      "SELECT id, buyer_id, farmer_id, proposed_price, quantity, status FROM purchase_requests WHERE id = ?",
      [requestId]
    );

    if (!request) {
      await connection.rollback();
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy y├¬u cß║ºu" });
    }

    if (userId !== request.buyer_id && userId !== request.farmer_id) {
      await connection.rollback();
      return res.status(403).json({ error: "Kh├┤ng c├│ quyß╗ün thanh to├ín" });
    }

    // 2. T├¡nh ph├¡
    const totalValue = Number(request.proposed_price) * Number(request.quantity);
    const totalFee = calculateTotalFee(totalValue);
    const { farmerFee, dealerFee } = splitFee(totalFee);
    
    const isFarmer = userId === request.farmer_id;
    const feeAmountToPay = isFarmer ? farmerFee : dealerFee;

    // 3. Kiß╗âm tra sß╗æ d╞░ v├¡
    let [[wallet]] = await connection.query(
      "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
      [userId]
    );

    if (!wallet || Number(wallet.balance) < feeAmountToPay) {
      await connection.rollback();
      return res.status(400).json({ error: "Sß╗æ d╞░ V├¡ N├┤ng Xu kh├┤ng ─æß╗º ─æß╗â thanh to├ín hoa hß╗ông" });
    }

    // 4. Trß╗½ tiß╗ün (Hoa hß╗ông chß╗ë ─æ╞░ß╗úc trß╗½ tß╗½ balance)
    await connection.query(
      "UPDATE wallets SET balance = balance - ? WHERE user_id = ?",
      [feeAmountToPay, userId]
    );

    // 5. Ghi log transaction
    await connection.query(
      `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note)
       VALUES (?, ?, 'deduct', 'commission', 'balance', ?)`,
      [userId, feeAmountToPay, `Thanh to├ín hoa hß╗ông cho ─æ╞ín #${requestId}`]
    );

    // 6. Cß║¡p nhß║¡t bß║úng commissions
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

    // 7. Kiß╗âm tra nß║┐u cß║ú 2 ─æ├ú thanh to├ín th├¼ chuyß╗ân ─æ╞ín h├áng sang Ho├án th├ánh
    let orderCompleted = false;
    if (newFarmerStatus === 'paid' && newBuyerStatus === 'paid') {
      await connection.query(
        "UPDATE purchase_requests SET status = 'completed' WHERE id = ?",
        [requestId]
      );
      orderCompleted = true;
    }

    await connection.commit();

    // 8. Bß║»n sß╗▒ kiß╗çn realtime qua Socket.io
    const io = req.app.get("io");
    if (io) {
      // Th├┤ng b├ío cho ph├¡a ─æß╗æi t├íc biß║┐t m├¼nh ─æ├ú thanh to├ín
      const partnerId = isFarmer ? request.buyer_id : request.farmer_id;
      io.to(`user:${partnerId}`).emit("commission_paid", {
        request_id: requestId,
        paid_by: userId,
        role: isFarmer ? 'farmer' : 'buyer'
      });

      // Nß║┐u ─æ╞ín h├áng ho├án th├ánh, th├┤ng b├ío cho cß║ú 2
      if (orderCompleted) {
        io.to(`user:${request.farmer_id}`).emit("order_completed", { request_id: requestId });
        io.to(`user:${request.buyer_id}`).emit("order_completed", { request_id: requestId });
      }
    }

    res.json({ success: true, message: "Thanh to├ín hoa hß╗ông th├ánh c├┤ng", orderCompleted });
  } catch (error) {
    await connection.rollback();
    console.error("POST /wallet/pay-commission error:", error);
    res.status(500).json({ error: "Lß╗ùi thanh to├ín hoa hß╗ông" });
  } finally {
    connection.release();
  }
});

// Mock api lß║Ñy th├┤ng tin invoice tr╞░ß╗¢c khi chß╗æt ─æ╞ín (─æß╗â show popup)
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

    if (!request) return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy y├¬u cß║ºu" });

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
    res.status(500).json({ error: "Lß╗ùi khi lß║Ñy th├┤ng tin ho├í ─æ╞ín" });
  }
});

export default router;
