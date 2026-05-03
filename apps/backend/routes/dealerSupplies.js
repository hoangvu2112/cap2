import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole } from "../middleware/auth.js"

const router = express.Router()

router.get("/listings", authenticateToken, requireRole("dealer"), async (req, res) => {
  try {
    const status = String(req.query.status || "").trim().toLowerCase()
    const productId = Number(req.query.product_id)
    const region = String(req.query.region || "").trim()

    const where = []
    const params = []

    if (status && ["available", "soon", "partial", "sold"].includes(status)) {
      where.push("usl.supply_status = ?")
      params.push(status)
    }

    if (productId) {
      where.push("usl.product_id = ?")
      params.push(productId)
    }

    if (region) {
      where.push("p.region = ?")
      params.push(region)
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : ""

    const [rows] = await pool.query(
      `
        SELECT
          usl.id,
          usl.user_id,
          usl.product_id,
          usl.quantity_available,
          usl.harvest_start,
          usl.harvest_end,
          usl.supply_status,
          usl.note,
          usl.created_at,
          usl.updated_at,
          u.name AS user_name,
          u.avatar_url AS user_avatar,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          p.currentPrice AS current_price,
          p.previousPrice AS previous_price,
          c.name AS category_name,
          CASE WHEN lb.id IS NOT NULL THEN 1 ELSE 0 END AS is_boosted,
          lb.boost_start_at,
          lb.boost_end_at,
          bp.name AS boost_plan_name
        FROM user_supply_listings usl
        JOIN users u ON u.id = usl.user_id
        JOIN products p ON p.id = usl.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN listing_boosts lb
          ON lb.listing_id = usl.id
          AND lb.status = 'active'
          AND lb.boost_end_at > NOW()
        LEFT JOIN boost_plans bp ON bp.id = lb.plan_id
        ${whereSql}
        ORDER BY is_boosted DESC, lb.boost_end_at DESC, usl.updated_at DESC, usl.created_at DESC, usl.id DESC
        LIMIT 50
      `,
      params
    )

    const stats = rows.reduce(
      (acc, item) => {
        acc.total += 1
        acc[item.supply_status] = (acc[item.supply_status] || 0) + 1
        return acc
      },
      { total: 0, available: 0, soon: 0, partial: 0, sold: 0 }
    )

    res.json({ success: true, listings: rows, stats })
  } catch (error) {
    console.error("GET /dealer-supplies/listings error:", error)
    res.status(500).json({ error: "Không thể lấy danh sách nguồn hàng" })
  }
})

export default router