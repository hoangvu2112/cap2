import express from "express"
import { authenticateToken, isAdmin } from "../middleware/auth.js"
import pool from "../db.js"

const router = express.Router()

// ≡ƒºæΓÇì≡ƒÆ╗ Lß║Ñy th├┤ng tin c├í nh├ón hiß╗çn tß║íi
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, avatar_url, region, role, status FROM users WHERE id = ?",
      [req.user.id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy ng╞░ß╗¥i d├╣ng" })
    }
    res.json(rows[0])
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi lß║Ñy th├┤ng tin user:", error)
    res.status(500).json({ error: "Lß╗ùi server khi lß║Ñy th├┤ng tin" })
  }
})

// ≡ƒºæΓÇì≡ƒÆ╗ Lß║Ñy danh s├ích ─æß║íi l├╜ (Public)
router.get("/dealers", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, avatar_url, region, status FROM users WHERE role = 'dealer' ORDER BY name ASC"
    )
    res.json(rows)
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi lß║Ñy danh s├ích ─æß║íi l├╜:", error)
    res.status(500).json({ error: "Lß╗ùi server" })
  }
})

const normalizeSupplyStatus = (status) => {
  const value = String(status || "available").trim().toLowerCase()
  return ["available", "soon", "partial", "sold"].includes(value) ? value : "available"
}

router.get("/me/source-listings", authenticateToken, async (req, res) => {
  try {
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
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          p.currentPrice AS current_price,
          p.previousPrice AS previous_price,
          CASE WHEN lb.id IS NOT NULL THEN 1 ELSE 0 END AS is_boosted,
          lb.boost_start_at,
          lb.boost_end_at
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        LEFT JOIN listing_boosts lb
          ON lb.listing_id = usl.id
          AND lb.status = 'active'
          AND lb.boost_end_at > NOW()
        WHERE usl.user_id = ?
        ORDER BY usl.created_at DESC, usl.id DESC
      `,
      [req.user.id]
    )

    res.json(rows)
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi lß║Ñy nguß╗ôn h├áng c├í nh├ón:", error)
    res.status(500).json({ error: "Lß╗ùi server" })
  }
})

router.post("/me/source-listings", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const productId = Number(req.body.product_id)
    const quantityAvailable = Number(req.body.quantity_available)
    const harvestStart = req.body.harvest_start || null
    const harvestEnd = req.body.harvest_end || null
    const supplyStatus = normalizeSupplyStatus(req.body.supply_status)
    const note = req.body.note?.trim() || null

    if (!productId || !Number.isFinite(quantityAvailable) || quantityAvailable <= 0) {
      return res.status(400).json({ error: "Dß╗» liß╗çu nguß╗ôn h├áng kh├┤ng hß╗úp lß╗ç" })
    }

    const [result] = await pool.query(
      `
        INSERT INTO user_supply_listings
          (user_id, product_id, quantity_available, harvest_start, harvest_end, supply_status, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [userId, productId, quantityAvailable, harvestStart, harvestEnd, supplyStatus, note]
    )

    const [[created]] = await pool.query(
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
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          p.currentPrice AS current_price,
          p.previousPrice AS previous_price
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        WHERE usl.id = ?
      `,
      [result.insertId]
    )

    res.status(201).json(created)
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi tß║ío nguß╗ôn h├áng:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Bß║ín ─æ├ú tß║ío nguß╗ôn h├áng cho sß║ún phß║⌐m n├áy rß╗ôi. Vui l├▓ng chß╗ënh sß╗¡a thay v├¼ tß║ío mß╗¢i." })
    }
    res.status(500).json({ error: error.message || "Lß╗ùi server" })
  }
})

router.put("/me/source-listings/:id", authenticateToken, async (req, res) => {
  try {
    const listingId = Number(req.params.id)
    const userId = req.user.id
    const productId = Number(req.body.product_id)
    const quantityAvailable = Number(req.body.quantity_available)
    const harvestStart = req.body.harvest_start || null
    const harvestEnd = req.body.harvest_end || null
    const supplyStatus = normalizeSupplyStatus(req.body.supply_status)
    const note = req.body.note?.trim() || null

    if (!listingId || !productId || !Number.isFinite(quantityAvailable) || quantityAvailable <= 0) {
      return res.status(400).json({ error: "Dß╗» liß╗çu nguß╗ôn h├áng kh├┤ng hß╗úp lß╗ç" })
    }

    const [result] = await pool.query(
      `
        UPDATE user_supply_listings
        SET product_id = ?, quantity_available = ?, harvest_start = ?, harvest_end = ?, supply_status = ?, note = ?
        WHERE id = ? AND user_id = ?
      `,
      [productId, quantityAvailable, harvestStart, harvestEnd, supplyStatus, note, listingId, userId]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy nguß╗ôn h├áng" })
    }

    const [[updated]] = await pool.query(
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
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          p.currentPrice AS current_price,
          p.previousPrice AS previous_price
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        WHERE usl.id = ?
      `,
      [listingId]
    )

    res.json(updated)
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi cß║¡p nhß║¡t nguß╗ôn h├áng:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Sß║ún phß║⌐m n├áy ─æ├ú tß╗ôn tß║íi trong danh s├ích cß╗ºa bß║ín." })
    }
    res.status(500).json({ error: error.message || "Lß╗ùi server" })
  }
})

router.delete("/me/source-listings/:id", authenticateToken, async (req, res) => {
  try {
    const listingId = Number(req.params.id)

    const [result] = await pool.query(
      "DELETE FROM user_supply_listings WHERE id = ? AND user_id = ?",
      [listingId, req.user.id]
    )

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy nguß╗ôn h├áng" })
    }

    res.json({ message: "─É├ú x├│a nguß╗ôn h├áng" })
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi x├│a nguß╗ôn h├áng:", error)
    res.status(500).json({ error: "Lß╗ùi server" })
  }
})

// ≡ƒºæΓÇì≡ƒÆ╗ Ng╞░ß╗¥i d├╣ng tß╗▒ cß║¡p nhß║¡t th├┤ng tin c├í nh├ón
// ΓÜá∩╕Å ─Éß║╖t TR╞»ß╗ÜC c├íc route c├│ "/:id"
router.put("/me", authenticateToken, async (req, res) => {
  try {
    console.log("≡ƒôÑ Dß╗» liß╗çu nhß║¡n ─æ╞░ß╗úc:", req.body)
    console.log("≡ƒæñ User ID:", req.user.id)

    const { name, avatar_url, region } = req.body
    const [result] = await pool.query(
      `UPDATE users SET 
        name = COALESCE(?, name),
        avatar_url = COALESCE(?, avatar_url),
        region = COALESCE(?, region)
       WHERE id = ?`,
      [name, avatar_url, region, req.user.id]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy ng╞░ß╗¥i d├╣ng ─æß╗â cß║¡p nhß║¡t" })
    }

    const [rows] = await pool.query(
      "SELECT id, name, email, avatar_url, region, role, status FROM users WHERE id = ?",
      [req.user.id]
    )
    res.json(rows[0])
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi cß║¡p nhß║¡t user:", error)
    res.status(500).json({ error: "Lß╗ùi server khi cß║¡p nhß║¡t th├┤ng tin" })
  }
})

// ≡ƒº⌐ Lß║Ñy danh s├ích tß║Ñt cß║ú ng╞░ß╗¥i d├╣ng (Admin)
router.get("/", authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, email, role, status, joinDate, created_at FROM users")
    res.json(rows)
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi lß║Ñy danh s├ích ng╞░ß╗¥i d├╣ng:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º khi lß║Ñy danh s├ích ng╞░ß╗¥i d├╣ng" })
  }
})

// Cß║¡p nhß║¡t th├┤ng tin ng╞░ß╗¥i d├╣ng (Admin)
router.put("/:id", authenticateToken, isAdmin, async (req, res) => {
  const { name, email, role, status } = req.body
  const id = parseInt(req.params.id)

  try {
    const [result] = await pool.query(
      `UPDATE users SET 
        name = COALESCE(?, name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        status = COALESCE(?, status)
      WHERE id = ?`,
      [name, email, role, status, id]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy ng╞░ß╗¥i d├╣ng" })
    }

    const [updatedUser] = await pool.query(
      "SELECT id, name, email, role, status, joinDate FROM users WHERE id = ?",
      [id]
    )

    res.json(updatedUser[0])
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi cß║¡p nhß║¡t ng╞░ß╗¥i d├╣ng:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º khi cß║¡p nhß║¡t ng╞░ß╗¥i d├╣ng" })
  }
})

// X├│a ng╞░ß╗¥i d├╣ng (Admin)
router.delete("/:id", authenticateToken, isAdmin, async (req, res) => {
  const id = parseInt(req.params.id)

  try {
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy ng╞░ß╗¥i d├╣ng" })
    }

    res.json({ message: "─É├ú x├│a ng╞░ß╗¥i d├╣ng th├ánh c├┤ng" })
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi x├│a ng╞░ß╗¥i d├╣ng:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º khi x├│a ng╞░ß╗¥i d├╣ng" })
  }
})



export default router
