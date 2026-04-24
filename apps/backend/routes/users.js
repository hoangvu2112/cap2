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
