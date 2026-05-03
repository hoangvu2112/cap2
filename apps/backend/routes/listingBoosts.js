import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole } from "../middleware/auth.js"

const router = express.Router()

const toMoney = (value) => Number(value || 0)

// Lấy danh sách gói ghim đang bật
router.get("/plans", authenticateToken, requireRole("user", "admin"), async (req, res) => {
  try {
    const [rawPlans] = await pool.query(
      `
        SELECT id, name, description, duration_days, price
        FROM boost_plans
        WHERE is_active = TRUE
        ORDER BY duration_days ASC, price ASC
      `
    )

    // Deduplicate by duration and keep the most practical option for UI:
    // prefer paid plan over accidental 0-price duplicates.
    const planByDuration = new Map()
    for (const plan of rawPlans) {
      const key = Number(plan.duration_days)
      const current = planByDuration.get(key)

      if (!current) {
        planByDuration.set(key, plan)
        continue
      }

      const currentPrice = Number(current.price || 0)
      const nextPrice = Number(plan.price || 0)
      const currentIsFree = currentPrice === 0
      const nextIsFree = nextPrice === 0

      if (currentIsFree && !nextIsFree) {
        planByDuration.set(key, plan)
        continue
      }

      if (currentIsFree === nextIsFree && nextPrice < currentPrice) {
        planByDuration.set(key, plan)
      }
    }

    const plans = Array.from(planByDuration.values()).sort(
      (a, b) => Number(a.duration_days) - Number(b.duration_days)
    )

    res.json({ success: true, plans })
  } catch (error) {
    console.error("GET /listing-boosts/plans error:", error)
    res.status(500).json({ error: "Không thể lấy danh sách gói ghim" })
  }
})

// Tạo thanh toán mô phỏng cho một nguồn hàng cần ghim
router.post("/create-payment", authenticateToken, requireRole("user"), async (req, res) => {
  const connection = await pool.getConnection()

  try {
    const listingId = Number(req.body.listing_id)
    const planId = Number(req.body.plan_id)

    if (!listingId || !planId) {
      return res.status(400).json({ error: "Thiếu nguồn hàng hoặc gói ghim" })
    }

    await connection.beginTransaction()

    const [[listing]] = await connection.query(
      `
        SELECT usl.id, usl.user_id, usl.product_id, p.name AS product_name
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        WHERE usl.id = ? AND usl.user_id = ?
        LIMIT 1
      `,
      [listingId, req.user.id]
    )

    if (!listing) {
      await connection.rollback()
      return res.status(404).json({ error: "Không tìm thấy nguồn hàng hoặc bạn không có quyền ghim" })
    }

    const [[plan]] = await connection.query(
      `
        SELECT id, name, duration_days, price
        FROM boost_plans
        WHERE id = ? AND is_active = TRUE
        LIMIT 1
      `,
      [planId]
    )

    if (!plan) {
      await connection.rollback()
      return res.status(404).json({ error: "Gói ghim không tồn tại hoặc đã tắt" })
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

    const [boostResult] = await connection.query(
      `
        INSERT INTO listing_boosts (listing_id, user_id, plan_id, status)
        VALUES (?, ?, ?, 'pending')
      `,
      [listingId, req.user.id, planId]
    )

    const note = `Mô phỏng thanh toán ${plan.name} cho nguồn hàng ${listing.product_name}`
    const [paymentResult] = await connection.query(
      `
        INSERT INTO payments (user_id, amount, payment_type, status, reference_id, note)
        VALUES (?, ?, 'listing_boost', 'pending', ?, ?)
      `,
      [req.user.id, toMoney(plan.price), boostResult.insertId, note]
    )

    await connection.query(
      "UPDATE listing_boosts SET payment_id = ? WHERE id = ?",
      [paymentResult.insertId, boostResult.insertId]
    )

    await connection.commit()

    res.status(201).json({
      success: true,
      payment: {
        id: paymentResult.insertId,
        amount: toMoney(plan.price),
        status: "pending",
        payment_type: "listing_boost",
      },
      boost: {
        id: boostResult.insertId,
        listing_id: listingId,
        plan_id: planId,
        status: "pending",
      },
      plan,
    })
  } catch (error) {
    await connection.rollback()
    console.error("POST /listing-boosts/create-payment error:", error)
    res.status(500).json({ error: "Không thể tạo thanh toán ghim tin" })
  } finally {
    connection.release()
  }
})

// Mô phỏng thanh toán thành công và kích hoạt ghim
router.post("/payments/:id/simulate-success", authenticateToken, requireRole("user", "admin"), async (req, res) => {
  const connection = await pool.getConnection()

  try {
    const paymentId = Number(req.params.id)
    if (!paymentId) return res.status(400).json({ error: "Mã thanh toán không hợp lệ" })

    await connection.beginTransaction()

    const [[payment]] = await connection.query(
      `
        SELECT p.*, lb.id AS boost_id, lb.user_id AS boost_user_id, lb.listing_id, bp.duration_days, bp.name AS plan_name
        FROM payments p
        JOIN listing_boosts lb ON lb.id = p.reference_id
        JOIN boost_plans bp ON bp.id = lb.plan_id
        WHERE p.id = ? AND p.payment_type = 'listing_boost'
        LIMIT 1
      `,
      [paymentId]
    )

    if (!payment) {
      await connection.rollback()
      return res.status(404).json({ error: "Không tìm thấy thanh toán ghim tin" })
    }

    if (req.user.role !== "admin" && Number(payment.user_id) !== Number(req.user.id)) {
      await connection.rollback()
      return res.status(403).json({ error: "Bạn không có quyền xác nhận thanh toán này" })
    }

    if (payment.status === "paid") {
      await connection.rollback()
      return res.status(409).json({ error: "Thanh toán này đã được xác nhận trước đó" })
    }

    if (payment.status !== "pending") {
      await connection.rollback()
      return res.status(409).json({ error: "Chỉ có thể xác nhận thanh toán đang chờ" })
    }

    await connection.query(
      "UPDATE payments SET status = 'paid', paid_at = NOW() WHERE id = ?",
      [paymentId]
    )

    await connection.query(
      `
        UPDATE listing_boosts
        SET status = 'active', boost_start_at = NOW(), boost_end_at = DATE_ADD(NOW(), INTERVAL ? DAY)
        WHERE id = ?
      `,
      [Number(payment.duration_days), payment.boost_id]
    )

    const [[boost]] = await connection.query(
      `
        SELECT lb.*, bp.name AS plan_name, bp.duration_days, bp.price
        FROM listing_boosts lb
        JOIN boost_plans bp ON bp.id = lb.plan_id
        WHERE lb.id = ?
      `,
      [payment.boost_id]
    )

    await connection.commit()

    res.json({
      success: true,
      message: "Đã mô phỏng thanh toán thành công và kích hoạt ghim tin",
      boost,
    })
  } catch (error) {
    await connection.rollback()
    console.error("POST /listing-boosts/payments/:id/simulate-success error:", error)
    res.status(500).json({ error: "Không thể xác nhận thanh toán mô phỏng" })
  } finally {
    connection.release()
  }
})

// Mô phỏng thanh toán thất bại
router.post("/payments/:id/simulate-failed", authenticateToken, requireRole("user", "admin"), async (req, res) => {
  const connection = await pool.getConnection()

  try {
    const paymentId = Number(req.params.id)
    if (!paymentId) return res.status(400).json({ error: "Mã thanh toán không hợp lệ" })

    await connection.beginTransaction()

    const [[payment]] = await connection.query(
      `
        SELECT p.*, lb.id AS boost_id
        FROM payments p
        JOIN listing_boosts lb ON lb.id = p.reference_id
        WHERE p.id = ? AND p.payment_type = 'listing_boost'
        LIMIT 1
      `,
      [paymentId]
    )

    if (!payment) {
      await connection.rollback()
      return res.status(404).json({ error: "Không tìm thấy thanh toán" })
    }

    if (req.user.role !== "admin" && Number(payment.user_id) !== Number(req.user.id)) {
      await connection.rollback()
      return res.status(403).json({ error: "Bạn không có quyền cập nhật thanh toán này" })
    }

    if (payment.status !== "pending") {
      await connection.rollback()
      return res.status(409).json({ error: "Chỉ có thể đánh dấu thất bại với thanh toán đang chờ" })
    }

    await connection.query("UPDATE payments SET status = 'failed' WHERE id = ?", [paymentId])
    await connection.query("UPDATE listing_boosts SET status = 'cancelled' WHERE id = ?", [payment.boost_id])

    await connection.commit()
    res.json({ success: true, message: "Đã mô phỏng thanh toán thất bại" })
  } catch (error) {
    await connection.rollback()
    console.error("POST /listing-boosts/payments/:id/simulate-failed error:", error)
    res.status(500).json({ error: "Không thể cập nhật thanh toán" })
  } finally {
    connection.release()
  }
})

export default router
