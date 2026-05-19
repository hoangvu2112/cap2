import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole } from "../middleware/auth.js"

const router = express.Router()

// Tạo cảnh báo mới
router.post("/", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
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

// Lấy danh sách thông báo và cảnh báo của người dùng (tích hợp cả cảnh báo giá và thương lượng mua hàng)
router.get("/", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const userId = req.user.id;
    const { type } = req.query; // 'alert' nếu chỉ muốn lấy cảnh báo giá

    // 1. Lấy danh sách cảnh báo giá
    const [priceAlerts] = await pool.query(`
      SELECT 
        a.id,
        'alert' AS type,
        a.product_id,
        a.target_price,
        a.alert_condition,
        a.email,
        a.notified,
        a.created_at,
        p.name AS product_name, 
        p.currentPrice,
        p.previousPrice,
        p.trend
      FROM price_alerts a
      JOIN products p ON a.product_id = p.id
      WHERE a.user_id = ?
      ORDER BY a.created_at DESC
    `, [userId]);

    // Nếu frontend chỉ yêu cầu 'alert' (ví dụ trang cấu hình cảnh báo)
    if (type === 'alert') {
      return res.json(priceAlerts.map(item => ({ ...item, notified: Boolean(item.notified) })));
    }

    // 2. Lấy thông báo thương lượng / yêu cầu mua mới
    // - Nông dân (user): nhận yêu cầu status 'pending' từ đại lý
    // - Đại lý (dealer): nhận phản hồi status 'responded' từ nông dân
    const [negotiationRequests] = await pool.query(`
      SELECT 
        pr.id,
        'negotiation_request' AS type,
        pr.product_id,
        pr.status,
        pr.created_at,
        p.name AS product_name,
        buyer.name AS buyer_name,
        farmer.name AS farmer_name,
        CASE 
          WHEN pr.farmer_id = ? THEN 'incoming'
          ELSE 'outgoing'
        END AS direction
      FROM purchase_requests pr
      JOIN products p ON p.id = pr.product_id
      JOIN users buyer ON buyer.id = pr.buyer_id
      JOIN users farmer ON farmer.id = pr.farmer_id
      WHERE (pr.farmer_id = ? AND pr.status = 'pending')
         OR (pr.buyer_id = ? AND pr.status = 'responded')
      ORDER BY pr.updated_at DESC
    `, [userId, userId, userId]);

    // 3. Lấy tin nhắn thương lượng mới (chưa đọc - tin nhắn cuối không phải do mình gửi)
    const [negotiationMessages] = await pool.query(`
      SELECT 
        pr.id AS request_id,
        'negotiation_message' AS type,
        pr.product_id,
        pr.status,
        p.name AS product_name,
        m.content AS message_content,
        m.created_at,
        sender.name AS sender_name,
        sender.role AS sender_role
      FROM purchase_requests pr
      JOIN products p ON p.id = pr.product_id
      JOIN purchase_request_messages m ON m.request_id = pr.id
      JOIN users sender ON sender.id = m.sender_id
      WHERE pr.status IN ('pending', 'responded', 'closed')
        AND (pr.buyer_id = ? OR pr.farmer_id = ?)
        AND m.sender_id != ?
        AND m.id = (
          SELECT MAX(id) 
          FROM purchase_request_messages 
          WHERE request_id = pr.id
        )
      ORDER BY m.created_at DESC
    `, [userId, userId, userId]);

    // Trộn và sắp xếp theo created_at giảm dần
    const allNotifications = [
      ...priceAlerts.map(item => ({ 
        ...item, 
        notified: Boolean(item.notified) 
      })),
      ...negotiationRequests.map(item => ({
        id: `req-${item.id}`,
        requestId: item.id,
        type: item.type,
        product_name: item.product_name,
        created_at: item.created_at,
        notified: true, // Luôn hiển thị ở Bell
        message: item.direction === 'incoming' 
          ? `Yêu cầu thương lượng mới từ đại lý ${item.buyer_name}`
          : `Phản hồi thương lượng mới từ nông dân ${item.farmer_name}`
      })),
      ...negotiationMessages.map(item => ({
        id: `msg-${item.request_id}-${new Date(item.created_at).getTime()}`,
        requestId: item.request_id,
        type: item.type,
        product_name: item.product_name,
        created_at: item.created_at,
        notified: true, // Luôn hiển thị ở Bell
        message: `Tin nhắn mới từ ${item.sender_name}: "${item.message_content.substring(0, 30)}${item.message_content.length > 30 ? '...' : ''}"`
      }))
    ];

    // Sắp xếp theo ngày giảm dần
    allNotifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(allNotifications);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách thông báo tổng hợp:", error);
    res.status(500).json({ error: "Lỗi khi lấy danh sách thông báo." });
  }
});

// Trạng thái cấu hình SMTP (để frontend hiển thị cảnh báo phù hợp)
router.get("/config-status", authenticateToken, requireRole("user", "dealer"), async (_req, res) => {
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
router.delete("/:id", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
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
