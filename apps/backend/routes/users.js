import express from "express"
import { authenticateToken, isAdmin } from "../middleware/auth.js"
import pool from "../db.js"
import multer from "multer"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

// Cấu hình multer cho avatar upload
const avatarUploadDir = path.join(__dirname, "../uploads/avatars")
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true })
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarUploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`)
  },
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/
    const ext = allowed.test(path.extname(file.originalname).toLowerCase())
    const mime = allowed.test(file.mimetype)
    if (ext && mime) return cb(null, true)
    cb(new Error("Chỉ chấp nhận file ảnh (jpg, png, gif, webp)"))
  },
})

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
    const { name, region } = req.body
    const userId = req.user.id

    // Lấy thông tin hiện tại
    const [[currentUser]] = await pool.query(
      "SELECT name, name_changed_at, name_change_count FROM users WHERE id = ?",
      [userId]
    )

    if (!currentUser) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" })
    }

    // === Logic giới hạn đổi tên ===
    let finalName = currentUser.name
    if (name && name.trim() !== currentUser.name) {
      const now = new Date()
      const lastChanged = currentUser.name_changed_at ? new Date(currentUser.name_changed_at) : null
      const changeCount = currentUser.name_change_count || 0

      // Kiểm tra cooldown 30 ngày (nếu đã hết 15 phút window trước đó)
      if (lastChanged) {
        const diffMs = now - lastChanged
        const diffMinutes = diffMs / (1000 * 60)
        const diffDays = diffMs / (1000 * 60 * 60 * 24)

        // Nếu đã quá 15 phút kể từ lần đổi đầu tiên trong window → khóa 30 ngày
        if (diffMinutes > 15 && diffDays < 30 && changeCount >= 3) {
          const unlockDate = new Date(lastChanged.getTime() + 30 * 24 * 60 * 60 * 1000)
          return res.status(429).json({
            error: `Bạn đã hết lượt đổi tên. Có thể đổi lại sau ${unlockDate.toLocaleDateString("vi-VN")}`,
            unlock_at: unlockDate.toISOString()
          })
        }

        // Nếu đã quá 30 ngày → reset counter, cho phép đổi lại
        if (diffDays >= 30) {
          // Reset window mới
          await pool.query(
            "UPDATE users SET name = ?, name_changed_at = NOW(), name_change_count = 1 WHERE id = ?",
            [name.trim(), userId]
          )
          finalName = name.trim()
        } else if (diffMinutes <= 15) {
          // Trong window 15 phút, kiểm tra còn lượt không
          if (changeCount >= 3) {
            return res.status(429).json({
              error: "Bạn đã đổi tên 3 lần trong 15 phút. Vui lòng đợi hết thời gian hoặc giữ nguyên tên hiện tại."
            })
          }
          // Còn lượt → tăng counter
          await pool.query(
            "UPDATE users SET name = ?, name_change_count = name_change_count + 1 WHERE id = ?",
            [name.trim(), userId]
          )
          finalName = name.trim()
        } else {
          // Quá 15 phút nhưng chưa đủ 30 ngày, và count < 3 → khóa (window đã đóng)
          if (changeCount > 0) {
            const unlockDate = new Date(lastChanged.getTime() + 30 * 24 * 60 * 60 * 1000)
            return res.status(429).json({
              error: `Thời gian đổi tên đã hết. Có thể đổi lại sau ${unlockDate.toLocaleDateString("vi-VN")}`,
              unlock_at: unlockDate.toISOString()
            })
          }
          // Chưa từng đổi trong window này (count = 0) → bắt đầu window mới
          await pool.query(
            "UPDATE users SET name = ?, name_changed_at = NOW(), name_change_count = 1 WHERE id = ?",
            [name.trim(), userId]
          )
          finalName = name.trim()
        }
      } else {
        // Chưa từng đổi tên → bắt đầu window mới
        await pool.query(
          "UPDATE users SET name = ?, name_changed_at = NOW(), name_change_count = 1 WHERE id = ?",
          [name.trim(), userId]
        )
        finalName = name.trim()
      }
    }

    // Cập nhật region (không giới hạn)
    if (region !== undefined) {
      await pool.query("UPDATE users SET region = ? WHERE id = ?", [region, userId])
    }

    const [rows] = await pool.query(
      "SELECT id, name, email, avatar_url, region, role, status, name_changed_at, name_change_count FROM users WHERE id = ?",
      [userId]
    )
    res.json(rows[0])
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật user:", error)
    res.status(500).json({ error: "Lỗi server khi cập nhật thông tin" })
  }
})

// Upload avatar
router.post("/me/avatar", authenticateToken, avatarUpload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Vui lòng chọn file ảnh" })
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`

    // Xóa avatar cũ nếu có (chỉ xóa file local, không xóa URL external)
    const [[currentUser]] = await pool.query("SELECT avatar_url FROM users WHERE id = ?", [req.user.id])
    if (currentUser?.avatar_url && currentUser.avatar_url.startsWith("/uploads/avatars/")) {
      const oldPath = path.join(__dirname, "..", currentUser.avatar_url)
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath)
      }
    }

    await pool.query("UPDATE users SET avatar_url = ? WHERE id = ?", [avatarUrl, req.user.id])

    const [rows] = await pool.query(
      "SELECT id, name, email, avatar_url, region, role, status FROM users WHERE id = ?",
      [req.user.id]
    )
    res.json(rows[0])
  } catch (error) {
    console.error("❌ Lỗi upload avatar:", error)
    res.status(500).json({ error: "Lỗi server khi upload avatar" })
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
