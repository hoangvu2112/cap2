import express from "express"
import pool from "../db.js"
import { authenticateToken } from "../middleware/auth.js"
import { checkActiveRole } from "../middleware/checkActiveRole.js"
import { SYSTEM_FEES } from "../utils/constants.js"

const router = express.Router()

router.post("/apply", authenticateToken, checkActiveRole("user"), async (req, res) => {
  const connection = await pool.getConnection()
  try {
    if (req.user.role === "admin") {
      return res.status(400).json({ error: "Tài khoản quản trị không cần nâng cấp đại lý" })
    }
    if (req.user.role === "dealer") {
      return res.status(400).json({ error: "Bạn đã là đại lý rồi" })
    }

    const planPrice = SYSTEM_FEES.DEALER_UPGRADE.price
    const planDuration = SYSTEM_FEES.DEALER_UPGRADE.duration_days

    await connection.beginTransaction()

    // 1. Kiểm tra Ví Nông Xu
    const [[wallet]] = await connection.query(
      "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
      [req.user.id]
    )

    if (!wallet) {
      await connection.rollback()
      return res.status(400).json({ error: "Bạn chưa có Ví Nông Xu, vui lòng nạp tiền trước" })
    }

    const currentBalance = Number(wallet.balance)

    if (currentBalance < planPrice) {
      await connection.rollback()
      return res.status(400).json({ error: "Số dư ví chính (balance) không đủ để thanh toán gói này. Nâng cấp đại lý không áp dụng trừ tiền thưởng." })
    }

    // 2. Trừ tiền (chỉ trừ balance)
    await connection.query(
      "UPDATE wallets SET balance = balance - ? WHERE user_id = ?",
      [planPrice, req.user.id]
    )

    // 3. Ghi log ví
    await connection.query(
      `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
       VALUES (?, ?, 'deduct', 'upgrade_dealer', 'balance', ?)`,
      [req.user.id, planPrice, `Thanh toán phí nâng cấp Đại lý (${planDuration} ngày)`]
    )

    // 4. Cập nhật role và ngày hết hạn trong bảng users
    await connection.query(
      "UPDATE users SET role = 'dealer', dealer_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY) WHERE id = ?", 
      [planDuration, req.user.id]
    )
    
    // 5. Khôi phục sản phẩm đại lý (nếu có)
    await connection.query(
      `
        UPDATE products
        SET
          dealer_visibility_status = 'visible',
          dealer_hidden_at = NULL,
          dealer_hidden_until = NULL
        WHERE farmer_user_id = ?
      `,
      [req.user.id]
    )

    await connection.commit()

    res.status(201).json({
      success: true,
      message: "Nâng cấp đại lý thành công. Bạn đã trở thành Đại lý."
    })
  } catch (error) {
    await connection.rollback()
    console.error("POST /dealer-upgrade/apply error:", error)
    res.status(500).json({ error: "Không thể nâng cấp đại lý" })
  } finally {
    connection.release()
  }
})

export default router
