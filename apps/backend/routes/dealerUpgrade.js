import express from "express"
import pool from "../db.js"
import { authenticateToken, isAdmin } from "../middleware/auth.js"

const router = express.Router()

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
    const [rows] = await pool.query(
      `
        SELECT id, code, name, price_vnd, duration_days, is_active
        FROM dealer_plans
        WHERE is_active = TRUE
        ORDER BY price_vnd ASC, id ASC
      `
    )

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
    const note = String(req.body?.note || "").trim()

    if (!planId) {
      return res.status(400).json({ error: "Thiếu plan_id" })
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
          (user_id, plan_id, status, payment_status, note)
        VALUES (?, ?, 'pending_payment', 'unpaid', ?)
      `,
      [req.user.id, planId, note || null]
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

    res.status(201).json({ success: true, request: created })
  } catch (error) {
    console.error("POST /dealer-upgrade/apply error:", error)
    res.status(500).json({ error: "Không thể tạo yêu cầu nâng cấp đại lý" })
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
        [adminNote || null, req.user.id, Number(requestRow.duration_days || 30), requestId]
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

export default router
