import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole } from "../middleware/auth.js"
import { SYSTEM_FEES } from "../utils/constants.js"

const router = express.Router()

// Lấy danh sách gói ghim
router.get("/plans", (req, res) => {
  res.json({ plans: SYSTEM_FEES.BOOST_PACKAGES })
})

// Thanh toán ghim tin bằng Ví Nông Xu
router.post("/create-payment", authenticateToken, requireRole("user"), async (req, res) => {
  const connection = await pool.getConnection()

  try {
    const listingId = Number(req.body.listing_id)
    const planId = req.body.plan_id
    const userId = req.user.id

    if (!listingId || !planId) {
      return res.status(400).json({ error: "Thiếu nguồn hàng hoặc gói ghim" })
    }

    const plan = SYSTEM_FEES.BOOST_PACKAGES.find(p => p.id === planId)
    if (!plan) {
      return res.status(400).json({ error: "Gói ghim không hợp lệ" })
    }

    const planPrice = plan.price_vnd
    const planDuration = plan.duration_days

    await connection.beginTransaction()

    const [[listing]] = await connection.query(
      `
        SELECT usl.id, usl.user_id, usl.product_id, p.name AS product_name
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        WHERE usl.id = ? AND usl.user_id = ?
        LIMIT 1
      `,
      [listingId, userId]
    )

    if (!listing) {
      await connection.rollback()
      return res.status(404).json({ error: "Không tìm thấy nguồn hàng hoặc bạn không có quyền ghim" })
    }

    const [[activeBoost]] = await connection.query(
      `
        SELECT id, boost_end_at
        FROM listing_boosts
        WHERE listing_id = ? AND status = 'active' AND boost_end_at > NOW()
        ORDER BY boost_end_at DESC
        LIMIT 1
      `,
      [listingId]
    )

    if (activeBoost) {
      await connection.rollback()
      return res.status(409).json({ error: "Nguồn hàng này đang được ghim, vui lòng đợi hết hạn rồi mua tiếp" })
    }

    // 1. Kiểm tra Ví Nông Xu
    let [[wallet]] = await connection.query(
      "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
      [userId]
    )

    if (!wallet) {
      await connection.query(
        "INSERT INTO wallets (user_id, balance, bonus_balance) VALUES (?, 0, 0)",
        [userId]
      );
      wallet = { balance: 0, bonus_balance: 0 };
    }

    let currentBonus = Number(wallet.bonus_balance)
    let currentBalance = Number(wallet.balance)

    if (currentBonus + currentBalance < planPrice) {
      await connection.rollback()
      return res.status(400).json({ error: "Số dư Ví Nông Xu không đủ để thanh toán gói ghim này" })
    }

    let deductBonus = 0
    let deductBalance = 0

    if (currentBonus >= planPrice) {
      deductBonus = planPrice
    } else {
      deductBonus = currentBonus
      deductBalance = planPrice - currentBonus
    }

    // 2. Trừ tiền
    await connection.query(
      "UPDATE wallets SET bonus_balance = bonus_balance - ?, balance = balance - ? WHERE user_id = ?",
      [deductBonus, deductBalance, userId]
    )

    // 3. Ghi log ví
    if (deductBonus > 0) {
      await connection.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
         VALUES (?, ?, 'deduct', 'boost_pin', 'bonus_balance', ?)`,
        [userId, deductBonus, `Thanh toán gói Ghim tin ${planDuration} ngày (trừ tiền thưởng)`]
      )
    }
    if (deductBalance > 0) {
      await connection.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
         VALUES (?, ?, 'deduct', 'boost_pin', 'balance', ?)`,
        [userId, deductBalance, `Thanh toán gói Ghim tin ${planDuration} ngày (trừ tiền nạp)`]
      )
    }

    // 4. Active gói ghim luôn (Bỏ plan_id, payment_id)
    const [boostResult] = await connection.query(
      `
        INSERT INTO listing_boosts (listing_id, user_id, status, boost_start_at, boost_end_at)
        VALUES (?, ?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))
      `,
      [listingId, userId, planDuration]
    )

    await connection.commit()

    const [[boost]] = await connection.query(
      "SELECT * FROM listing_boosts WHERE id = ?",
      [boostResult.insertId]
    )

    res.status(201).json({
      success: true,
      message: "Thanh toán thành công và đã kích hoạt gói ghim",
      boost,
      payment: {
        amount: planPrice,
        status: "paid"
      }
    })
  } catch (error) {
    await connection.rollback()
    console.error("POST /listing-boosts/create-payment error:", error)
    res.status(500).json({ error: "Không thể thanh toán gói ghim tin" })
  } finally {
    connection.release()
  }
})

export default router
