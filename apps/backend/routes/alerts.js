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

// Lấy danh sách cảnh báo của người dùng
router.get("/", authenticateToken, requireRole("user"), async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(`
  SELECT 
    a.*, 
    p.name AS product_name, 
 p.currentPrice,
p.previousPrice,
p.trend

  FROM price_alerts a
  JOIN products p ON a.product_id = p.id
  WHERE a.user_id = ?
  ORDER BY a.created_at DESC
`, [userId])


    res.json(rows);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách cảnh báo:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách cảnh báo." });
  }
});

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
