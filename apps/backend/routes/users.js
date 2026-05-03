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
      "SELECT id, name, avatar_url, region FROM users WHERE role = 'dealer' AND status = 'active' LIMIT 5"
    )
    res.json(rows)
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách đại lý:", error)
    res.status(500).json({ error: "Lỗi server" })
  }
})

// 🧑‍💻 Người dùng tự cập nhật thông tin cá nhân
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

// Lấy danh sách nguồn hàng của user
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
          c.name AS category_name,
          CASE WHEN lb.id IS NOT NULL THEN 1 ELSE 0 END AS is_boosted,
          lb.boost_start_at,
          lb.boost_end_at,
          bp.name AS boost_plan_name
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN listing_boosts lb
          ON lb.listing_id = usl.id
          AND lb.status = 'active'
          AND lb.boost_end_at > NOW()
        LEFT JOIN boost_plans bp ON bp.id = lb.plan_id
        WHERE usl.user_id = ?
        ORDER BY is_boosted DESC, lb.boost_end_at DESC, usl.updated_at DESC, usl.id DESC
      `,
      [req.user.id]
    )

    res.json(rows)
  } catch (error) {
    console.error("❌ Lỗi khi lấy nguồn hàng của user:", error)
    res.status(500).json({ error: "Lỗi máy chủ khi lấy nguồn hàng" })
  }
})

// TẠO MỚI nguồn hàng (Luôn luôn INSERT thêm lô hàng mới)
router.post("/me/source-listings", authenticateToken, async (req, res) => {
  try {
    const { product_id, quantity_available, harvest_start, harvest_end, supply_status, note } = req.body

    const productId = Number(product_id)
    const quantity = Number(quantity_available)
    const status = String(supply_status || "available").trim().toLowerCase()

    if (!productId) {
      return res.status(400).json({ error: "Thiếu sản phẩm nguồn hàng" })
    }

    if (Number.isNaN(quantity) || quantity < 0) {
      return res.status(400).json({ error: "Sản lượng phải là số không âm" })
    }

    if (!["available", "soon", "partial", "sold"].includes(status)) {
      return res.status(400).json({ error: "Trạng thái nguồn hàng không hợp lệ" })
    }

    const [[product]] = await pool.query(
      "SELECT id, name, unit, region FROM products WHERE id = ?",
      [productId]
    )

    if (!product) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" })
    }

    const [result] = await pool.query(
      `
        INSERT INTO user_supply_listings
          (user_id, product_id, quantity_available, harvest_start, harvest_end, supply_status, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        req.user.id,
        productId,
        quantity,
        harvest_start || null,
        harvest_end || null,
        status,
        note?.trim() || null,
      ]
    )

    const [[saved]] = await pool.query(
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
          c.name AS category_name,
          0 AS is_boosted,
          NULL AS boost_start_at,
          NULL AS boost_end_at,
          NULL AS boost_plan_name
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE usl.id = ?
      `,
      [result.insertId]
    )

    res.status(201).json(saved)
  } catch (error) {
    console.error("❌ Lỗi khi lưu nguồn hàng:", error?.message || error)
    res.status(500).json({ error: error?.message || "Lỗi máy chủ khi lưu nguồn hàng" })
  }
})

// CẬP NHẬT nguồn hàng hiện có (Dùng cho nút Sửa)
router.put("/me/source-listings/:id", authenticateToken, async (req, res) => {
  try {
    const listingId = Number(req.params.id)
    const { product_id, quantity_available, harvest_start, harvest_end, supply_status, note } = req.body

    const productId = Number(product_id)
    const quantity = Number(quantity_available)
    const status = String(supply_status || "available").trim().toLowerCase()

    if (!listingId) {
      return res.status(400).json({ error: "Mã nguồn hàng không hợp lệ" })
    }

    if (!productId) return res.status(400).json({ error: "Thiếu sản phẩm nguồn hàng" })
    if (Number.isNaN(quantity) || quantity < 0) return res.status(400).json({ error: "Sản lượng phải là số không âm" })
    if (!["available", "soon", "partial", "sold"].includes(status)) return res.status(400).json({ error: "Trạng thái không hợp lệ" })

    const [result] = await pool.query(
      `
        UPDATE user_supply_listings
        SET
          product_id = ?,
          quantity_available = ?,
          harvest_start = ?,
          harvest_end = ?,
          supply_status = ?,
          note = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `,
      [
        productId,
        quantity,
        harvest_start || null,
        harvest_end || null,
        status,
        note?.trim() || null,
        listingId,
        req.user.id
      ]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy nguồn hàng để sửa hoặc bạn không có quyền" })
    }

    res.json({ message: "Đã cập nhật nguồn hàng thành công" })
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật nguồn hàng:", error)
    res.status(500).json({ error: "Lỗi máy chủ khi cập nhật" })
  }
})

// XOÁ nguồn hàng
router.delete("/me/source-listings/:id", authenticateToken, async (req, res) => {
  try {
    const listingId = Number(req.params.id)
    if (!listingId) {
      return res.status(400).json({ error: "Mã nguồn hàng không hợp lệ" })
    }

    const [result] = await pool.query(
      "DELETE FROM user_supply_listings WHERE id = ? AND user_id = ?",
      [listingId, req.user.id]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy nguồn hàng để xoá" })
    }

    res.json({ message: "Đã xoá nguồn hàng" })
  } catch (error) {
    console.error("❌ Lỗi khi xoá nguồn hàng:", error)
    res.status(500).json({ error: "Lỗi máy chủ khi xoá nguồn hàng" })
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

// 🧩 Lấy danh sách Đại lý (Dealer) cho trang Community
router.get("/dealers", authenticateToken, async (req, res) => {
  try {
    const [dealers] = await pool.query(
      `SELECT id, name, email, avatar_url, role 
       FROM users 
       WHERE role = 'dealer' AND status = 'active'
       ORDER BY created_at DESC 
       LIMIT 50`
    );
    res.json(dealers);
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách đại lý:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi lấy danh sách đại lý" });
  }
});

export default router