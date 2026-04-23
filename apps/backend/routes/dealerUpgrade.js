import express from "express"
import pool from "../db.js"
import { authenticateToken, isAdmin } from "../middleware/auth.js"
import dotenv from "dotenv"
import path from "path"

// Nạp .env với đường dẫn tuyệt đối để chắc chắn luôn tìm thấy
dotenv.config({ path: path.join(process.cwd(), "apps/backend/.env") })

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const PayOSLib = require('@payos/node');

const router = express.Router()

// Tìm đúng class PayOS
const PayOS = PayOSLib.PayOS || (PayOSLib.default && PayOSLib.default.PayOS) || PayOSLib

let payos = null
const isSimulate = process.env.PAYMENT_SIMULATE === 'true'

// Chỉ khởi tạo PayOS thật nếu không phải chế độ giả lập
if (!isSimulate) {
  try {
    payos = new PayOS(
      process.env.PAYMENT_CLIENT_ID,
      process.env.PAYMENT_API_KEY,
      process.env.PAYMENT_CHECKSUM_KEY
    )
    console.log("✅ [PayOS] Đã khởi tạo thành công.");
  } catch (err) {
    console.error("⚠️ [PayOS] Khởi tạo thất bại (vui lòng kiểm tra Key trong .env):", err.message);
  }
} else {
  console.log("🧪 [PayOS] Đang chạy ở chế độ GIẢ LẬP (Simulation Mode).");
}

const OPEN_REQUEST_STATUSES = ["pending_payment", "pending_review"]

async function getOpenRequestForUser(userId) {
  const [rows] = await pool.query(
    `
      SELECT r.*, p.name AS plan_name, p.price_vnd, p.duration_days
      FROM dealer_upgrade_requests r
      JOIN dealer_plans p ON p.id = r.plan_id
      WHERE r.user_id = ?
        AND r.status IN ('pending_payment', 'pending_review')
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 1
    `,
    [userId]
  )

  return rows[0] || null
}

router.get("/plans", authenticateToken, async (_req, res) => {
  try {
    let [rows] = await pool.query(
      `
        SELECT id, code, name, price_vnd, duration_days, is_active
        FROM dealer_plans
        ORDER BY price_vnd ASC, id ASC
      `
    )
    
    // Nếu DB trống (vì lý do gì đó), trả về dữ liệu cứng để đảm bảo giao diện luôn có gói
    if (rows.length === 0) {
      console.log("--- [DEBUG] DB trả về 0 gói, đang dùng dữ liệu dự phòng ---");
      rows = [
        { id: 2, code: 'dealer_30', name: 'Gói Đại lý 30 ngày', price_vnd: 100000, duration_days: 30, is_active: 1 },
        { id: 3, code: 'dealer_90', name: 'Gói Đại lý 90 ngày', price_vnd: 250000, duration_days: 90, is_active: 1 },
        { id: 4, code: 'dealer_365', name: 'Gói Đại lý 1 năm', price_vnd: 800000, duration_days: 365, is_active: 1 }
      ];
    }

    res.json({ success: true, plans: rows })
  } catch (error) {
    console.error("GET /dealer-upgrade/plans error:", error)
    res.status(500).json({ error: "Không thể lấy danh sách gói đại lý" })
  }
})

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          r.*,
          p.name AS plan_name,
          p.price_vnd,
          p.duration_days
        FROM dealer_upgrade_requests r
        JOIN dealer_plans p ON p.id = r.plan_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 20
      `,
      [req.user.id]
    )

    res.json({ success: true, requests: rows })
  } catch (error) {
    console.error("GET /dealer-upgrade/me error:", error)
    res.status(500).json({ error: "Không thể lấy lịch sử nâng cấp đại lý" })
  }
})

router.post("/apply", authenticateToken, async (req, res) => {
  try {
    if (req.user.role === "admin") {
      return res.status(400).json({ error: "Tài khoản quản trị không cần nâng cấp đại lý" })
    }

    if (req.user.role === "dealer") {
      return res.status(400).json({ error: "Tài khoản đã là đại lý" })
    }

    const planId = Number(req.body?.plan_id)
    const {
      business_name,
      tax_code,
      business_address,
      representative_name,
      phone_contact,
      business_items,
      note
    } = req.body

    if (!planId) {
      return res.status(400).json({ error: "Thiếu plan_id" })
    }

    // Validation các trường bắt buộc theo quy định
    if (!business_name || !tax_code || !business_address || !representative_name || !phone_contact) {
      return res.status(400).json({ error: "Vui lòng cung cấp đầy đủ thông tin pháp lý đại lý" })
    }

    const [[plan]] = await pool.query(
      "SELECT id, name, price_vnd, duration_days, is_active FROM dealer_plans WHERE id = ? LIMIT 1",
      [planId]
    )

    if (!plan || !plan.is_active) {
      return res.status(404).json({ error: "Gói đại lý không tồn tại hoặc đã ngưng" })
    }

    const openRequest = await getOpenRequestForUser(req.user.id)
    if (openRequest) {
      return res.status(409).json({
        error: "Bạn đang có yêu cầu nâng cấp đang xử lý",
        request: openRequest,
      })
    }

    const [result] = await pool.query(
      `
        INSERT INTO dealer_upgrade_requests
          (user_id, plan_id, status, payment_status, business_name, tax_code, business_address, representative_name, phone_contact, business_items, note)
        VALUES (?, ?, 'pending_payment', 'unpaid', ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id, 
        planId, 
        business_name.trim(), 
        tax_code.trim(), 
        business_address.trim(), 
        representative_name.trim(), 
        phone_contact.trim(), 
        business_items?.trim() || null, 
        note?.trim() || null
      ]
    )

    const [[created]] = await pool.query(
      `
        SELECT
          r.*,
          p.name AS plan_name,
          p.price_vnd,
          p.duration_days
        FROM dealer_upgrade_requests r
        JOIN dealer_plans p ON p.id = r.plan_id
        WHERE r.id = ?
      `,
      [result.insertId]
    )

    // Tạo link thanh toán PayOS hoặc Giả lập
    try {
      const orderCode = result.insertId
      const isSimulate = process.env.PAYMENT_SIMULATE === 'true'
      
      let checkoutUrl = ""

      if (isSimulate) {
        console.log(`--- [SIMULATE] Tạo yêu cầu giả lập cho ID: ${orderCode} ---`)
        checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?status=success&id=${orderCode}&simulate=true`
      } else {
        const paymentLinkRequest = {
          orderCode: orderCode,
          amount: Number(plan.price_vnd),
          description: `Upgrade ${orderCode}`,
          returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?status=success&id=${orderCode}`,
          cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?status=cancel&id=${orderCode}`,
        }
        const paymentLinkData = await payos.createPaymentLink(paymentLinkRequest)
        checkoutUrl = paymentLinkData.checkoutUrl
      }
      
      // Lưu checkoutUrl vào DB
      await pool.query(
        "UPDATE dealer_upgrade_requests SET payment_ref = ? WHERE id = ?",
        [checkoutUrl, orderCode]
      )

      res.status(201).json({ 
        success: true, 
        request: { ...created, checkoutUrl } 
      })
    } catch (payosError) {
      console.error("Payment Create Error:", payosError)
      res.status(201).json({ success: true, request: created })
    }
  } catch (error) {
    console.error("POST /dealer-upgrade/apply error:", error)
    res.status(500).json({ error: "Không thể tạo yêu cầu nâng cấp đại lý" })
  }
})

// Route giả lập thanh toán thành công (Chỉ dùng khi test)
router.post("/simulate-success/:id", authenticateToken, async (req, res) => {
  if (process.env.PAYMENT_SIMULATE !== 'true') {
    return res.status(403).json({ error: "Chế độ giả lập chưa được bật" })
  }
  
  try {
    const orderCode = Number(req.params.id)
    
    // Giả lập dữ liệu PayOS gửi về Webhook
    const mockData = {
      orderCode: orderCode,
      paymentLinkId: `SIM-LNK-${Date.now()}`,
      amount: 100000,
      description: "Thanh toán giả lập"
    }

    // Gọi trực tiếp logic nâng cấp (giống như Webhook làm)
    // Tận dụng lại logic đã viết ở trên hoặc copy sang
    const [[requestRow]] = await pool.query(
      "SELECT r.*, p.duration_days FROM dealer_upgrade_requests r JOIN dealer_plans p ON p.id = r.plan_id WHERE r.id = ? AND r.status = 'pending_payment'",
      [orderCode]
    )

    if (!requestRow) return res.status(404).json({ error: "Yêu cầu không khả dụng" })

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + requestRow.duration_days)

    await pool.query("UPDATE dealer_upgrade_requests SET status = 'approved', payment_status = 'paid', payment_ref = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ["SIMULATED", expiresAt, orderCode])
    await pool.query("UPDATE users SET role = 'dealer' WHERE id = ?", [requestRow.user_id])

    res.json({ success: true, message: "✅ Giả lập thành công! Bạn đã là Đại lý." })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post("/:id/mark-paid", authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    if (!requestId) {
      return res.status(400).json({ error: "Mã yêu cầu không hợp lệ" })
    }

    const [[requestRow]] = await pool.query(
      `
        SELECT r.*, p.duration_days, p.price_vnd
        FROM dealer_upgrade_requests r
        JOIN dealer_plans p ON p.id = r.plan_id
        WHERE r.id = ?
        LIMIT 1
      `,
      [requestId]
    )

    if (!requestRow) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu nâng cấp" })
    }

    if (Number(requestRow.user_id) !== Number(req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền cập nhật yêu cầu này" })
    }

    if (requestRow.status !== "pending_payment") {
      return res.status(400).json({ error: "Yêu cầu không ở trạng thái chờ thanh toán" })
    }

    const paymentRef = `SIM-${Date.now()}-${requestId}`

    await pool.query(
      `
        UPDATE dealer_upgrade_requests
        SET
          payment_status = 'paid',
          payment_ref = ?,
          status = 'pending_review',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [paymentRef, requestId]
    )

    const [[updated]] = await pool.query(
      `
        SELECT
          r.*,
          p.name AS plan_name,
          p.price_vnd,
          p.duration_days
        FROM dealer_upgrade_requests r
        JOIN dealer_plans p ON p.id = r.plan_id
        WHERE r.id = ?
      `,
      [requestId]
    )

    res.json({ success: true, request: updated })
  } catch (error) {
    console.error("POST /dealer-upgrade/:id/mark-paid error:", error)
    res.status(500).json({ error: "Không thể xác nhận thanh toán" })
  }
})

router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    const userId = req.user.id

    const [rows] = await pool.query(
      "SELECT status FROM dealer_upgrade_requests WHERE id = ? AND user_id = ?",
      [requestId, userId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu" })
    }

    if (rows[0].status !== "pending_payment") {
      return res.status(400).json({ error: "Chỉ có thể hủy yêu cầu khi đang chờ thanh toán" })
    }

    await pool.query("DELETE FROM dealer_upgrade_requests WHERE id = ?", [requestId])
    res.json({ success: true, message: "Đã hủy yêu cầu thành công" })
  } catch (error) {
    console.error("DELETE /dealer-upgrade/:id error:", error)
    res.status(500).json({ error: "Lỗi hệ thống khi hủy yêu cầu" })
  }
})

router.get("/admin/requests", authenticateToken, isAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          r.*,
          p.name AS plan_name,
          p.price_vnd,
          p.duration_days,
          u.name AS applicant_name,
          u.email AS applicant_email,
          reviewer.name AS reviewer_name
        FROM dealer_upgrade_requests r
        JOIN dealer_plans p ON p.id = r.plan_id
        JOIN users u ON u.id = r.user_id
        LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 200
      `
    )

    res.json({ success: true, requests: rows })
  } catch (error) {
    console.error("GET /dealer-upgrade/admin/requests error:", error)
    res.status(500).json({ error: "Không thể lấy danh sách duyệt đại lý" })
  }
})

router.patch("/admin/requests/:id/review", authenticateToken, isAdmin, async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    const action = String(req.body?.action || "").trim().toLowerCase()
    const adminNote = String(req.body?.admin_note || "").trim()

    if (!requestId) {
      return res.status(400).json({ error: "Mã yêu cầu không hợp lệ" })
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ error: "action phải là approve hoặc reject" })
    }

    const [[requestRow]] = await pool.query(
      `
        SELECT r.*, p.duration_days
        FROM dealer_upgrade_requests r
        JOIN dealer_plans p ON p.id = r.plan_id
        WHERE r.id = ?
        LIMIT 1
      `,
      [requestId]
    )

    if (!requestRow) {
      return res.status(404).json({ error: "Không tìm thấy yêu cầu nâng cấp" })
    }

    if (!OPEN_REQUEST_STATUSES.includes(requestRow.status)) {
      return res.status(400).json({ error: "Yêu cầu này đã được xử lý trước đó" })
    }

    if (action === "approve") {
      if (requestRow.payment_status !== "paid") {
        return res.status(400).json({ error: "Chưa thể duyệt vì yêu cầu chưa thanh toán" })
      }

      await pool.query(
        `
          UPDATE dealer_upgrade_requests
          SET
            status = 'approved',
            admin_note = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            approved_at = NOW(),
            expires_at = DATE_ADD(NOW(), INTERVAL ? DAY),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [adminNote || null, req.user.id, Number(requestRow.duration_days || 60), requestId]
      )

      await pool.query("UPDATE users SET role = 'dealer' WHERE id = ?", [requestRow.user_id])
    } else {
      await pool.query(
        `
          UPDATE dealer_upgrade_requests
          SET
            status = 'rejected',
            admin_note = ?,
            reviewed_by = ?,
            reviewed_at = NOW(),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [adminNote || null, req.user.id, requestId]
      )
    }

    const [[updated]] = await pool.query(
      `
        SELECT
          r.*,
          p.name AS plan_name,
          p.price_vnd,
          p.duration_days,
          u.name AS applicant_name,
          u.email AS applicant_email,
          reviewer.name AS reviewer_name
        FROM dealer_upgrade_requests r
        JOIN dealer_plans p ON p.id = r.plan_id
        JOIN users u ON u.id = r.user_id
        LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by
        WHERE r.id = ?
        LIMIT 1
      `,
      [requestId]
    )

    res.json({ success: true, request: updated })
  } catch (error) {
    console.error("PATCH /dealer-upgrade/admin/requests/:id/review error:", error)
    res.status(500).json({ error: "Không thể duyệt yêu cầu đại lý" })
  }
})

// Webhook nhận thông báo từ PayOS
router.post("/webhook", async (req, res) => {
  try {
    const webhookData = req.body
    
    // 1. Xác thực dữ liệu webhook từ PayOS
    // Lưu ý: Trong thực tế bạn nên dùng verifyPaymentWebhookData của SDK để bảo mật tuyệt đối
    const data = payos.verifyPaymentWebhookData(webhookData)
    
    if (data.description === "ma giao dich thu" || data.amount === 0) {
      return res.json({ success: true })
    }

    const orderCode = data.orderCode
    
    // 2. Tìm yêu cầu trong DB
    const [[requestRow]] = await pool.query(
      `
        SELECT r.*, p.duration_days 
        FROM dealer_upgrade_requests r
        JOIN dealer_plans p ON p.id = r.plan_id
        WHERE r.id = ? AND r.status = 'pending_payment'
        LIMIT 1
      `,
      [orderCode]
    )

    if (!requestRow) {
      console.log(`[Webhook] Không tìm thấy yêu cầu pending cho orderCode: ${orderCode}`)
      return res.json({ success: true })
    }

    // 3. Tính toán ngày hết hạn (Cộng dồn nếu còn hạn)
    let expiresAt = new Date()
    
    // Kiểm tra xem người dùng này đã có ngày hết hạn cũ còn hiệu lực không
    const [[existingInfo]] = await pool.query(
      "SELECT expires_at FROM dealer_upgrade_requests WHERE user_id = ? AND status = 'approved' AND expires_at > NOW() ORDER BY expires_at DESC LIMIT 1",
      [requestRow.user_id]
    )

    if (existingInfo && existingInfo.expires_at) {
      // Nếu còn hạn, cộng dồn từ ngày hết hạn cũ
      expiresAt = new Date(existingInfo.expires_at)
    }
    
    expiresAt.setDate(expiresAt.getDate() + requestRow.duration_days)

    // 4. Cập nhật DB: Duyệt yêu cầu và Nâng cấp Role người dùng
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // Cập nhật yêu cầu
      await connection.query(
        `
          UPDATE dealer_upgrade_requests 
          SET 
            status = 'approved', 
            payment_status = 'paid',
            payment_ref = ?,
            expires_at = ?,
            reviewed_by = 0, -- Hệ thống tự duyệt
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [data.paymentLinkId, expiresAt, orderCode]
      )

      // Cập nhật vai trò người dùng
      await connection.query(
        "UPDATE users SET role = 'dealer' WHERE id = ?",
        [requestRow.user_id]
      )

      await connection.commit()
      console.log(`✅ [Webhook] Đã tự động nâng cấp Đại lý cho User ID: ${requestRow.user_id}`)
    } catch (dbError) {
      await connection.rollback()
      throw dbError
    } finally {
      connection.release()
    }

    res.json({ success: true })
  } catch (error) {
    console.error("PayOS Webhook Error:", error.message)
    // PayOS yêu cầu trả về lỗi 200 ngay cả khi xử lý thất bại để họ không gửi lại liên tục (tùy chính sách)
    // Nhưng thường nên trả về thành công nếu lỗi không phải do PayOS
    res.json({ success: false, error: error.message })
  }
})

export default router
