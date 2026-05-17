import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole, isAdmin } from "../middleware/auth.js"
import { checkActiveRole } from "../middleware/checkActiveRole.js"

const router = express.Router()

// Bản đồ phân vùng 34 tỉnh thành theo miền (sau sáp nhập 2025)
const REGION_GROUPS = {
  "Bắc Bộ": [
    "Hà Nội", "Hải Phòng", "Quảng Ninh", "Cao Bằng", "Lạng Sơn",
    "Lai Châu", "Điện Biên", "Sơn La", "Tuyên Quang", "Lào Cai",
    "Thái Nguyên", "Phú Thọ", "Bắc Ninh", "Hưng Yên",
  ],
  "Trung Bộ": [
    "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Ninh Bình", "Quảng Trị",
    "Huế", "Đà Nẵng", "Quảng Ngãi", "Gia Lai", "Khánh Hòa",
    "Lâm Đồng", "Đắk Lắk",
  ],
  "Nam Bộ": [
    "Hồ Chí Minh", "Đồng Nai", "Tây Ninh", "Cần Thơ",
    "Vĩnh Long", "Đồng Tháp", "An Giang", "Cà Mau",
  ],
}

function getRegionGroup(province) {
  for (const [group, provinces] of Object.entries(REGION_GROUPS)) {
    if (provinces.includes(province)) return group
  }
  return null
}

router.get("/partners", authenticateToken, async (req, res) => {
  try {
    const productId = Number(req.query.productId)
    if (!productId) {
      return res.status(400).json({ error: "Thiếu productId" })
    }

    // 1. Lấy thông tin khu vực của CHÍNH NGƯỜI DÙNG HIỆN TẠI
    const [[currentUser]] = await pool.query(
      "SELECT region FROM users WHERE id = ?",
      [req.user.id]
    )

    const userRegion = currentUser?.region || ""
    const userGroup = getRegionGroup(userRegion)

    // 2. Lấy danh sách tỉnh cùng miền để dùng trong SQL
    const sameGroupProvinces = userGroup ? REGION_GROUPS[userGroup] : []

    // 3. Xác định vai trò hiện tại từ DB để tránh dùng JWT cũ
    const [[currentRoleRow]] = await pool.query(
      "SELECT role FROM users WHERE id = ? AND status = 'active'",
      [req.user.id]
    )

    const isDealer = currentRoleRow?.role === 'dealer'

    // 4. Lấy category_id của sản phẩm đang xem
    const [[product]] = await pool.query(
      "SELECT category_id FROM products WHERE id = ?",
      [productId]
    )

    const productCategoryId = product?.category_id || null

    // 5. Truy vấn với 3 cấp ưu tiên + ràng buộc danh mục thu mua
    //    priority 1 = cùng tỉnh, priority 2 = cùng miền, priority 3 = miền khác
    let sql
    let params

    if (isDealer) {
      // Đại lý xem sản phẩm → hiển thị nông dân cung ứng (không cần lọc theo dealer_categories)
      sql = `
        SELECT 
          u.id, 
          u.name, 
          u.avatar_url, 
          u.role,
          u.region AS user_region,
          CASE 
            WHEN u.region = ? AND u.region IS NOT NULL AND u.region != '' THEN 1
            WHEN u.region IN (${sameGroupProvinces.map(() => '?').join(',') || "''"}) THEN 2
            ELSE 3
          END AS priority_level
        FROM users u
        WHERE u.id != ?
          AND u.status = 'active'
          AND u.role IN ('user', 'dealer')
        ORDER BY priority_level ASC, u.created_at ASC 
        LIMIT 20
      `
      params = [userRegion, ...sameGroupProvinces, req.user.id]
    } else {
      // Nông dân xem sản phẩm → chỉ hiển thị đại lý CÓ ĐĂNG KÝ thu mua danh mục này
      if (productCategoryId) {
        sql = `
          SELECT 
            u.id, 
            u.name, 
            u.avatar_url, 
            u.role,
            u.region AS user_region,
            CASE 
              WHEN u.region = ? AND u.region IS NOT NULL AND u.region != '' THEN 1
              WHEN u.region IN (${sameGroupProvinces.map(() => '?').join(',') || "''"}) THEN 2
              ELSE 3
            END AS priority_level
          FROM users u
          INNER JOIN dealer_categories dc ON dc.user_id = u.id AND dc.category_id = ?
          WHERE u.id != ?
            AND u.status = 'active'
            AND u.role = 'dealer'
          ORDER BY priority_level ASC, u.created_at ASC 
          LIMIT 20
        `
        params = [userRegion, ...sameGroupProvinces, productCategoryId, req.user.id]
      } else {
        // Sản phẩm không có category → fallback hiển thị tất cả đại lý (tương thích ngược)
        sql = `
          SELECT 
            u.id, 
            u.name, 
            u.avatar_url, 
            u.role,
            u.region AS user_region,
            CASE 
              WHEN u.region = ? AND u.region IS NOT NULL AND u.region != '' THEN 1
              WHEN u.region IN (${sameGroupProvinces.map(() => '?').join(',') || "''"}) THEN 2
              ELSE 3
            END AS priority_level
          FROM users u
          WHERE u.id != ?
            AND u.status = 'active'
            AND u.role = 'dealer'
          ORDER BY priority_level ASC, u.created_at ASC 
          LIMIT 20
        `
        params = [userRegion, ...sameGroupProvinces, req.user.id]
      }
    }

    const [rows] = await pool.query(sql, params)

    // 6. Thêm thông tin region_group cho mỗi đối tác
    const result = rows.map(row => ({
      ...row,
      region_group: getRegionGroup(row.user_region) || "Khác",
      user_group: userGroup || "Chưa xác định",
    }))

    res.json(result)
  } catch (error) {
    console.error("GET /purchase-requests/partners error:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.post("/", authenticateToken, async (req, res) => {
  try {
    const initiatorId = req.user.id
    const { product_id, partner_id, quantity, proposed_price, note } = req.body

    if (!product_id || !partner_id || !quantity || !proposed_price) {
      return res.status(400).json({ error: "Thiếu thông tin yêu cầu" })
    }

    const [[product]] = await pool.query(
      "SELECT id, farmer_user_id FROM products WHERE id = ?",
      [product_id]
    )

    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" })
    }

    const [[partner]] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND status = 'active'",
      [partner_id]
    )

    if (!partner) {
      return res.status(404).json({ error: "Không tìm thấy đối tác" })
    }

    const [[initiator]] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND status = 'active'",
      [initiatorId]
    )

    if (!initiator) {
      return res.status(404).json({ error: "Không tìm thấy người khởi tạo" })
    }

    // Xác định ai là người mua, ai là nông dân dựa trên vai trò của người khởi tạo
    let buyer_id, farmer_id;
    if (initiator.role === 'dealer') {
      buyer_id = initiatorId;
      farmer_id = partner_id;
    } else {
      buyer_id = partner_id; // Dealer là người mua
      farmer_id = initiatorId; // User là nông dân
    }

    const [result] = await pool.query(
      `
        INSERT INTO purchase_requests (buyer_id, farmer_id, product_id, quantity, proposed_price, note, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `,
      [buyer_id, farmer_id, product_id, Number(quantity), Number(proposed_price), note?.trim() || null]
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

router.get("/all", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          pr.id,
          pr.product_id,
          pr.buyer_id,
          pr.farmer_id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.created_at,
          pr.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          buyer.name AS buyer_name,
          buyer.avatar_url AS buyer_avatar,
          farmer.name AS farmer_name,
          farmer.avatar_url AS farmer_avatar,
          c.farmer_status,
          c.buyer_status
        FROM purchase_requests pr
        LEFT JOIN products p ON p.id = pr.product_id
        LEFT JOIN users buyer ON buyer.id = pr.buyer_id
        LEFT JOIN users farmer ON farmer.id = pr.farmer_id
        LEFT JOIN commissions c ON c.request_id = pr.id
        WHERE pr.buyer_id = ? OR pr.farmer_id = ?
        ORDER BY pr.created_at DESC, pr.id DESC
      `,
      [req.user.id, req.user.id]
    )

    res.json(rows)
  } catch (error) {
    console.error("GET /purchase-requests/all error:", error)
    res.status(500).json({ error: "Lỗi hệ thống khi tải danh sách thương lượng" })
  }
})

router.get("/sent", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
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
          farmer.avatar_url AS farmer_avatar,
          c.farmer_status,
          c.buyer_status
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users farmer ON farmer.id = pr.farmer_id
        LEFT JOIN commissions c ON c.request_id = pr.id
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

router.patch("/:id/dealer-confirm", authenticateToken, checkActiveRole("dealer"), async (req, res) => {
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

router.post("/:id/report", authenticateToken, checkActiveRole("dealer"), async (req, res) => {
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

router.get("/incoming", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
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
          buyer.avatar_url AS buyer_avatar,
          c.farmer_status,
          c.buyer_status
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users buyer ON buyer.id = pr.buyer_id
        LEFT JOIN commissions c ON c.request_id = pr.id
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
          pr.proposed_price,
          c.farmer_status,
          c.buyer_status,
          c.fee_amount
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        LEFT JOIN commissions c ON c.request_id = pr.id
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
