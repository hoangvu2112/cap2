import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole } from "../middleware/auth.js"

const router = express.Router()

// Tạo cảnh báo mới
router.post("/", authenticateToken, requireRole("user"), async (req, res) => {
  try {
    const { product_id, target_price, alert_condition } = req.body
    
    if (!product_id || !target_price || !alert_condition) {
      return res.status(400).json({ error: "Thiếu thông tin cảnh báo." })
    }

    await pool.query(
      `INSERT INTO price_alerts (user_id, product_id, target_price, alert_condition, email)
   VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, product_id, target_price, alert_condition, req.user.email]
    )

    res.json({ message: "✅ Đã tạo cảnh báo giá thành công!" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Lỗi khi tạo cảnh báo." })
  }
})

// Lấy danh sách cảnh báo của người dùng (gộp: cảnh báo giá + thông báo giao dịch ví)
router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Cảnh báo giá nông sản
    const [priceAlerts] = await pool.query(`
      SELECT 
        a.id, a.product_id, a.target_price, a.alert_condition, a.notified, a.created_at,
        'price_alert' AS alert_type,
        p.name AS product_name, 
        p.currentPrice,
        p.previousPrice,
        p.trend
      FROM price_alerts a
      JOIN products p ON a.product_id = p.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `, [userId])

    // 2. Thông báo giao dịch ví (nạp tiền, ghim bài, nâng cấp đại lý)
    let walletNotifications = []
    try {
      const [txRows] = await pool.query(`
        SELECT 
          wt.id, wt.amount, wt.type, wt.purpose, wt.note, wt.created_at,
          'wallet_transaction' AS alert_type
        FROM wallet_transactions wt
        WHERE wt.user_id = ?
        ORDER BY wt.created_at DESC
        LIMIT 20
      `, [userId])
      walletNotifications = txRows.map(tx => ({
        ...tx,
        title: getPurposeLabel(tx.purpose, tx.type),
      }))
    } catch (e) {
      // Bảng wallet_transactions có thể chưa tồn tại
      console.warn("⚠️ Không thể lấy thông báo ví:", e.message)
    }

    // 3. Thông báo yêu cầu thương lượng (incoming)
    let negotiationAlerts = []
    try {
      const [negRows] = await pool.query(`
        SELECT 
          pr.id, pr.quantity, pr.proposed_price, pr.status, pr.note, pr.created_at,
          'negotiation' AS alert_type,
          p.name AS product_name,
          u.name AS sender_name
        FROM purchase_requests pr
        JOIN products p ON pr.product_id = p.id
        JOIN users u ON pr.buyer_id = u.id
        WHERE pr.farmer_id = ? AND pr.status = 'pending'
        ORDER BY pr.created_at DESC
        LIMIT 10
      `, [userId])
      negotiationAlerts = negRows
    } catch (e) {
      console.warn("⚠️ Không thể lấy thông báo thương lượng:", e.message)
    }

    // Gộp tất cả và sắp xếp theo thời gian mới nhất
    const allNotifications = [
      ...priceAlerts,
      ...walletNotifications,
      ...negotiationAlerts,
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    res.json(allNotifications);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách cảnh báo:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách cảnh báo." });
  }
});

function getPurposeLabel(purpose, type) {
  const labels = {
    deposit: "Nạp tiền vào ví Nông Xu",
    mock_deposit: "Nạp tiền vào ví Nông Xu",
    DEPOSIT: "Nạp tiền vào ví Nông Xu",
    boost_pin: "Thanh toán ghim bài viết",
    PIN_POST: "Thanh toán ghim bài viết",
    pin_post: "Thanh toán ghim bài viết",
    upgrade_dealer: "Nâng cấp tài khoản Đại lý",
    UPGRADE_ROLE: "Nâng cấp tài khoản Đại lý",
    upgrade_role: "Nâng cấp tài khoản Đại lý",
    commission: "Hoa hồng giao dịch",
    COMMISSION: "Hoa hồng giao dịch",
  }
  const label = labels[purpose] || purpose || "Giao dịch ví"
  return type === "deduct" ? `Trừ tiền: ${label}` : label
}

// Trạng thái cấu hình SMTP (để frontend hiển thị cảnh báo phù hợp)
router.get("/config-status", authenticateToken, requireRole("user"), async (_req, res) => {
  try {
    const smtpConfigured = Boolean(process.env.SMTP_EMAIL && process.env.SMTP_PASSWORD)
    res.json({
      smtpConfigured,
      message: smtpConfigured
        ? "SMTP đã cấu hình."
        : "SMTP chưa cấu hình đầy đủ (thiếu SMTP_EMAIL hoặc SMTP_PASSWORD).",
    })
  } catch (error) {
    console.error("❌ Lỗi kiểm tra cấu hình SMTP:", error)
    res.status(500).json({ error: "Không thể kiểm tra cấu hình SMTP." })
  }
})


// Xoá cảnh báo
router.delete("/:id", authenticateToken, requireRole("user"), async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM price_alerts WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy cảnh báo để xoá." })
    }

    res.json({ message: "🗑️ Đã xoá cảnh báo thành công" })
  } catch (error) {
    console.error("❌ Lỗi xoá cảnh báo:", error)
    res.status(500).json({ error: "Lỗi khi xoá cảnh báo." })
  }
})

export default router
