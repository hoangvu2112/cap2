import express from "express"
import { authenticateToken, isAdmin } from "../middleware/auth.js"
import pool from "../db.js"

const router = express.Router()

// 🧑‍💻 Lấy thông tin cá nhân hiện tại
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, avatar_url, region, role, status FROM users WHERE id = ?",
      [req.user.id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" })
    }
    res.json(rows[0])
  } catch (error) {
    console.error("❌ Lỗi khi lấy thông tin user:", error)
    res.status(500).json({ error: "Lỗi server khi lấy thông tin" })
  }
})

// 🧑‍💻 Lấy danh sách đại lý (Public)
router.get("/dealers", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, avatar_url, region, status FROM users WHERE role = 'dealer' ORDER BY name ASC"
    )
    res.json(rows)
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách đại lý:", error)
    res.status(500).json({ error: "Lỗi server" })
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
    console.error("❌ Lỗi khi lấy nguồn hàng cá nhân:", error)
    res.status(500).json({ error: "Lỗi server" })
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
      return res.status(400).json({ error: "Dữ liệu nguồn hàng không hợp lệ" })
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
    console.error("❌ Lỗi khi tạo nguồn hàng:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Bạn đã tạo nguồn hàng cho sản phẩm này rồi. Vui lòng chỉnh sửa thay vì tạo mới." })
    }
    res.status(500).json({ error: error.message || "Lỗi server" })
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
      return res.status(400).json({ error: "Dữ liệu nguồn hàng không hợp lệ" })
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
      return res.status(404).json({ error: "Không tìm thấy nguồn hàng" })
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
    console.error("❌ Lỗi khi cập nhật nguồn hàng:", error)
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ error: "Sản phẩm này đã tồn tại trong danh sách của bạn." })
    }
    res.status(500).json({ error: error.message || "Lỗi server" })
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
      return res.status(404).json({ error: "Không tìm thấy nguồn hàng" })
    }

    res.json({ message: "Đã xóa nguồn hàng" })
  } catch (error) {
    console.error("❌ Lỗi khi xóa nguồn hàng:", error)
    res.status(500).json({ error: "Lỗi server" })
  }
})

// 🧑‍💻 Người dùng tự cập nhật thông tin cá nhân
// ⚠️ Đặt TRƯỚC các route có "/:id"
router.put("/me", authenticateToken, async (req, res) => {
  try {
    console.log("📥 Dữ liệu nhận được:", req.body)
    console.log("👤 User ID:", req.user.id)

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
      return res.status(404).json({ error: "Không tìm thấy người dùng để cập nhật" })
    }

    const [rows] = await pool.query(
      "SELECT id, name, email, avatar_url, region, role, status FROM users WHERE id = ?",
      [req.user.id]
    )
    res.json(rows[0])
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật user:", error)
    res.status(500).json({ error: "Lỗi server khi cập nhật thông tin" })
  }
})

// 🧩 Lấy danh sách tất cả người dùng (Admin)
router.get("/", authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, email, role, status, joinDate, created_at FROM users")
    res.json(rows)
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách người dùng:", error)
    res.status(500).json({ error: "Lỗi máy chủ khi lấy danh sách người dùng" })
  }
})

// Cập nhật thông tin người dùng (Admin)
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
      return res.status(404).json({ error: "Không tìm thấy người dùng" })
    }

    const [updatedUser] = await pool.query(
      "SELECT id, name, email, role, status, joinDate FROM users WHERE id = ?",
      [id]
    )

    res.json(updatedUser[0])
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật người dùng:", error)
    res.status(500).json({ error: "Lỗi máy chủ khi cập nhật người dùng" })
  }
})

// Xóa người dùng (Admin)
router.delete("/:id", authenticateToken, isAdmin, async (req, res) => {
  const id = parseInt(req.params.id)

  try {
    const [result] = await pool.query("DELETE FROM users WHERE id = ?", [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" })
    }

    res.json({ message: "Đã xóa người dùng thành công" })
  } catch (error) {
    console.error("❌ Lỗi khi xóa người dùng:", error)
    res.status(500).json({ error: "Lỗi máy chủ khi xóa người dùng" })
  }
})



export default router
