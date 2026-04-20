import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole, isAdmin } from "../middleware/auth.js"

const router = express.Router()

router.get("/farmers", authenticateToken, requireRole("dealer"), async (req, res) => {
  try {
    const productId = Number(req.query.productId)
    if (!productId) {
      return res.status(400).json({ error: "Thiếu productId" })
    }

    const [[product]] = await pool.query(
      "SELECT id, region, farmer_user_id FROM products WHERE id = ?",
      [productId]
    )

    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" })
    }

    const params = [req.user.id]
    let sql = `
      SELECT
        u.id,
        u.name,
        u.avatar_url,
        u.role,
        CASE WHEN p.region = ? THEN 1 ELSE 0 END AS same_region
      FROM users u
      LEFT JOIN products p ON p.farmer_user_id = u.id AND p.id = ?
      WHERE u.id != ?
        AND u.status = 'active'
        AND u.role IN ('user','dealer')
    `

    params.unshift(product.region || "")
    params.splice(1, 0, productId)

    if (product.farmer_user_id) {
      sql += " AND u.id = ?"
      params.push(product.farmer_user_id)
    }

    sql += " ORDER BY same_region DESC, u.created_at ASC LIMIT 20"

    const [rows] = await pool.query(sql, params)
    res.json(rows)
  } catch (error) {
    console.error("GET /purchase-requests/farmers error:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.post("/", authenticateToken, requireRole("dealer"), async (req, res) => {
  try {
    const buyerId = req.user.id
    const { product_id, farmer_id, quantity, proposed_price, note } = req.body

    if (!product_id || !farmer_id || !quantity || !proposed_price) {
      return res.status(400).json({ error: "Thiếu thông tin yêu cầu mua" })
    }

    if (Number(quantity) <= 0 || Number(proposed_price) <= 0) {
      return res.status(400).json({ error: "Số lượng và giá đề xuất phải lớn hơn 0" })
    }

    const [[product]] = await pool.query(
      "SELECT id, quantity_available FROM products WHERE id = ?",
      [product_id]
    )

    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" })
    }

    const [[farmer]] = await pool.query(
      "SELECT id FROM users WHERE id = ? AND status = 'active' AND role IN ('user','dealer')",
      [farmer_id]
    )

    if (!farmer) {
      return res.status(404).json({ error: "Không tìm thấy nông dân/nhà cung cấp" })
    }

    const [result] = await pool.query(
      `
        INSERT INTO purchase_requests (buyer_id, farmer_id, product_id, quantity, proposed_price, note, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `,
      [buyerId, farmer_id, product_id, Number(quantity), Number(proposed_price), note?.trim() || null]
    )

    const [[created]] = await pool.query(
      `
        SELECT
          pr.*,
          p.name AS product_name,
          p.unit AS product_unit,
          buyer.name AS buyer_name,
          farmer.name AS farmer_name
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users buyer ON buyer.id = pr.buyer_id
        JOIN users farmer ON farmer.id = pr.farmer_id
        WHERE pr.id = ?
      `,
      [result.insertId]
    )

    res.status(201).json(created)
  } catch (error) {
    console.error("POST /purchase-requests error:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.get("/sent", authenticateToken, requireRole("dealer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          pr.id,
          pr.product_id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.dealer_fee_status,
          pr.dealer_fee_amount,
          pr.dealer_action_at,
          pr.dealer_report_status,
          pr.created_at,
          pr.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          farmer.id AS farmer_id,
          farmer.name AS farmer_name,
          farmer.avatar_url AS farmer_avatar
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users farmer ON farmer.id = pr.farmer_id
        WHERE pr.buyer_id = ?
        ORDER BY pr.created_at DESC, pr.id DESC
      `,
      [req.user.id]
    )

    res.json(rows)
  } catch (error) {
    console.error("GET /purchase-requests/sent error:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.patch("/:id/dealer-confirm", authenticateToken, requireRole("dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    if (!requestId) {
      return res.status(400).json({ error: "Mã yêu cầu không hợp lệ" })
    }

    const [[request]] = await pool.query(
      `
        SELECT id, buyer_id, farmer_id, status, dealer_fee_status, dealer_fee_amount, dealer_action_at
        FROM purchase_requests
        WHERE id = ?
      `,
      [requestId]
    )

    if (!request) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu" })
    }

    if (request.buyer_id !== req.user.id) {
      return res.status(403).json({ error: "Bạn không có quyền thực hiện thao tác này" })
    }

    if (request.status !== "closed") {
      return res.status(400).json({ error: "Chỉ có thể xác nhận khi user đã chốt giao dịch" })
    }

    if (request.dealer_fee_status === "recorded") {
      return res.status(409).json({ error: "Phí đại lý của yêu cầu này đã được ghi nhận" })
    }

    await pool.query(
      `
        UPDATE purchase_requests
        SET
          dealer_fee_status = 'recorded',
          dealer_action_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [requestId]
    )

    await pool.query(
      `
        INSERT INTO dealer_fee_transactions (request_id, dealer_id, amount, status, note)
        VALUES (?, ?, ?, 'recorded', 'Ghi nhận phí đại lý khi xác nhận đơn')
      `,
      [requestId, req.user.id, Number(request.dealer_fee_amount || 30000)]
    )

    const [[updated]] = await pool.query(
      `
        SELECT
          pr.id,
          pr.product_id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.dealer_fee_status,
          pr.dealer_fee_amount,
          pr.dealer_action_at,
          pr.created_at,
          pr.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          farmer.id AS farmer_id,
          farmer.name AS farmer_name,
          farmer.avatar_url AS farmer_avatar
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users farmer ON farmer.id = pr.farmer_id
        WHERE pr.id = ?
      `,
      [requestId]
    )

    res.json(updated)
  } catch (error) {
    console.error("PATCH /purchase-requests/:id/dealer-confirm error:", error)
    res.status(500).json({ error: "Không thể ghi nhận phí đại lý" })
  }
})

router.post("/:id/report", authenticateToken, requireRole("dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    const reason = String(req.body?.reason || "").trim()
    const note = String(req.body?.note || "").trim()

    if (!requestId) {
      return res.status(400).json({ error: "Mã yêu cầu không hợp lệ" })
    }
    if (!reason) {
      return res.status(400).json({ error: "Vui lòng nhập lý do báo cáo" })
    }

    const [[request]] = await pool.query(
      `
        SELECT id, buyer_id, farmer_id, status, dealer_report_status
        FROM purchase_requests
        WHERE id = ?
      `,
      [requestId]
    )

    if (!request) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu" })
    }

    if (request.buyer_id !== req.user.id) {
      return res.status(403).json({ error: "Bạn không có quyền báo cáo yêu cầu này" })
    }

    if (!["closed"].includes(request.status)) {
      return res.status(400).json({ error: "Chỉ báo cáo được khi đơn đã chốt" })
    }

    if (request.dealer_report_status === "reported") {
      return res.status(409).json({ error: "Yêu cầu này đã được báo cáo trước đó" })
    }

    await pool.query(
      `
        INSERT INTO dealer_reports (request_id, reporter_id, reported_user_id, reason, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      [requestId, req.user.id, request.farmer_id, reason, note || null]
    )

    await pool.query(
      `
        UPDATE purchase_requests
        SET dealer_report_status = 'reported', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [requestId]
    )

    res.status(201).json({ success: true })
  } catch (error) {
    console.error("POST /purchase-requests/:id/report error:", error)
    res.status(500).json({ error: "Không thể gửi báo cáo" })
  }
})

router.get("/admin/reports", authenticateToken, isAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          r.id,
          r.request_id,
          r.reporter_id,
          r.reported_user_id,
          r.reason,
          r.note,
          r.status,
          r.admin_note,
          r.reviewed_by,
          r.reviewed_at,
          r.created_at,
          rep.name AS reporter_name,
          rep.email AS reporter_email,
          rep.role AS reporter_role,
          target.name AS reported_user_name,
          target.email AS reported_user_email,
          target.role AS reported_user_role,
          target.status AS reported_user_status,
          pr.status AS request_status,
          pr.dealer_fee_status,
          pr.dealer_fee_amount,
          pr.dealer_action_at,
          p.name AS product_name,
          p.unit AS product_unit
        FROM dealer_reports r
        JOIN users rep ON rep.id = r.reporter_id
        JOIN users target ON target.id = r.reported_user_id
        JOIN purchase_requests pr ON pr.id = r.request_id
        JOIN products p ON p.id = pr.product_id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 200
      `
    )

    res.json({ success: true, reports: rows })
  } catch (error) {
    console.error("GET /purchase-requests/admin/reports error:", error)
    res.status(500).json({ error: "Không thể lấy danh sách báo cáo" })
  }
})

router.patch("/admin/reports/:id/resolve", authenticateToken, isAdmin, async (req, res) => {
  try {
    const reportId = Number(req.params.id)
    const status = String(req.body?.status || "resolved").trim().toLowerCase()
    const adminNote = String(req.body?.admin_note || "").trim()

    if (!reportId) {
      return res.status(400).json({ error: "Mã báo cáo không hợp lệ" })
    }

    if (!["resolved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" })
    }

    const [[report]] = await pool.query(
      `
        SELECT id, reported_user_id, status
        FROM dealer_reports
        WHERE id = ?
      `,
      [reportId]
    )

    if (!report) {
      return res.status(404).json({ error: "Không tìm thấy báo cáo" })
    }

    await pool.query(
      `
        UPDATE dealer_reports
        SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW()
        WHERE id = ?
      `,
      [status, adminNote || null, req.user.id, reportId]
    )

    const [[updated]] = await pool.query(
      `
        SELECT
          r.id,
          r.request_id,
          r.reporter_id,
          r.reported_user_id,
          r.reason,
          r.note,
          r.status,
          r.admin_note,
          r.reviewed_by,
          r.reviewed_at,
          r.created_at,
          rep.name AS reporter_name,
          rep.email AS reporter_email,
          target.name AS reported_user_name,
          target.email AS reported_user_email,
          target.role AS reported_user_role,
          target.status AS reported_user_status
        FROM dealer_reports r
        JOIN users rep ON rep.id = r.reporter_id
        JOIN users target ON target.id = r.reported_user_id
        WHERE r.id = ?
      `,
      [reportId]
    )

    res.json({ success: true, report: updated })
  } catch (error) {
    console.error("PATCH /purchase-requests/admin/reports/:id/resolve error:", error)
    res.status(500).json({ error: "Không thể xử lý báo cáo" })
  }
})

router.get("/incoming", authenticateToken, requireRole("user"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          pr.id,
          pr.product_id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.created_at,
          pr.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          buyer.id AS buyer_id,
          buyer.name AS buyer_name,
          buyer.avatar_url AS buyer_avatar
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users buyer ON buyer.id = pr.buyer_id
        WHERE pr.farmer_id = ?
        ORDER BY pr.created_at DESC, pr.id DESC
      `,
      [req.user.id]
    )

    res.json(rows)
  } catch (error) {
    console.error("GET /purchase-requests/incoming error:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.get("/:id/messages", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    if (!requestId) {
      return res.status(400).json({ error: "Mã yêu cầu không hợp lệ" })
    }

    const [[request]] = await pool.query(
      `
        SELECT
          pr.id,
          pr.buyer_id,
          pr.farmer_id,
          pr.status,
          pr.product_id,
          p.name AS product_name,
          p.unit AS product_unit,
          pr.quantity,
          pr.proposed_price
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        WHERE pr.id = ?
      `,
      [requestId]
    )

    if (!request) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu" })
    }

    if (req.user.id !== request.buyer_id && req.user.id !== request.farmer_id) {
      return res.status(403).json({ error: "Không có quyền truy cập" })
    }

    const [messages] = await pool.query(
      `
        SELECT
          m.id,
          m.request_id,
          m.sender_id,
          m.content,
          m.created_at,
          u.name AS sender_name,
          u.role AS sender_role
        FROM purchase_request_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.request_id = ?
        ORDER BY m.created_at ASC, m.id ASC
      `,
      [requestId]
    )

    res.json({ request, messages })
  } catch (error) {
    console.error("GET /purchase-requests/:id/messages error:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.post("/:id/messages", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    const content = req.body.content?.trim()

    if (!requestId) {
      return res.status(400).json({ error: "Mã yêu cầu không hợp lệ" })
    }
    if (!content) {
      return res.status(400).json({ error: "Nội dung không được để trống" })
    }

    const [[request]] = await pool.query(
      "SELECT id, buyer_id, farmer_id, status FROM purchase_requests WHERE id = ?",
      [requestId]
    )

    if (!request) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu" })
    }
    if (request.status === "closed") {
      return res.status(400).json({ error: "Yêu cầu đã chốt, không thể nhắn thêm" })
    }
    if (req.user.id !== request.buyer_id && req.user.id !== request.farmer_id) {
      return res.status(403).json({ error: "Không có quyền nhắn trong yêu cầu này" })
    }

    const [result] = await pool.query(
      `
        INSERT INTO purchase_request_messages (request_id, sender_id, content)
        VALUES (?, ?, ?)
      `,
      [requestId, req.user.id, content]
    )

    // Khi nông dân phản hồi bằng tin nhắn đầu tiên/tiếp theo thì yêu cầu chuyển sang responded
    if (req.user.id === request.farmer_id && request.status === "pending") {
      await pool.query(
        "UPDATE purchase_requests SET status = 'responded' WHERE id = ?",
        [requestId]
      )
    }

    const [[message]] = await pool.query(
      `
        SELECT
          m.id,
          m.request_id,
          m.sender_id,
          m.content,
          m.created_at,
          u.name AS sender_name,
          u.role AS sender_role
        FROM purchase_request_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.id = ?
      `,
      [result.insertId]
    )

    const [[updatedRequest]] = await pool.query(
      "SELECT id, status, updated_at FROM purchase_requests WHERE id = ?",
      [requestId]
    )

    res.status(201).json({ message, request: updatedRequest })
  } catch (error) {
    console.error("POST /purchase-requests/:id/messages error:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.patch("/:id/status", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    const { status } = req.body

    if (!requestId) {
      return res.status(400).json({ error: "Mã yêu cầu không hợp lệ" })
    }

    if (!["pending", "responded", "closed"].includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ" })
    }

    const [[row]] = await pool.query(
      "SELECT id, buyer_id, farmer_id FROM purchase_requests WHERE id = ?",
      [requestId]
    )

    if (!row) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu" })
    }

    if (row.buyer_id !== req.user.id && row.farmer_id !== req.user.id) {
      return res.status(403).json({ error: "Không có quyền cập nhật yêu cầu này" })
    }

    if (status === "pending" || status === "responded") {
      return res.status(400).json({
        error: "Trạng thái pending/responded được cập nhật tự động theo luồng thương lượng",
      })
    }

    if (status === "closed" && row.farmer_id !== req.user.id) {
      return res.status(403).json({ error: "Chỉ nông dân mới có quyền chốt giao dịch" })
    }

    await pool.query(
      "UPDATE purchase_requests SET status = ? WHERE id = ?",
      [status, requestId]
    )

    res.json({ message: "Đã cập nhật trạng thái", status })
  } catch (error) {
    console.error("PATCH /purchase-requests/:id/status error:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

export default router
