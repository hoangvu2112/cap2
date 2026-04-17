import express from "express"
import pool from "../db.js"
import { authenticateToken, isAdmin } from "../middleware/auth.js"

const router = express.Router()

// Lấy tin tức đã published (User)
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM news WHERE status = 'published' ORDER BY published_at DESC"
    )
    res.json(rows)
  } catch (error) {
    console.error("❌ Lỗi lấy tin tức:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// Lấy tất cả tin tức kể cả draft (Admin)
router.get("/admin", authenticateToken, isAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM news ORDER BY created_at DESC"
    )
    res.json(rows)
  } catch (error) {
    console.error("❌ Lỗi lấy tin tức admin:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// Tạo tin tức mới (Admin)
router.post("/", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, content, source, url, status } = req.body

    if (!title?.trim()) {
      return res.status(400).json({ error: "Tiêu đề không được để trống" })
    }

    const publishedAt = status === "published" ? new Date() : null

    const [result] = await pool.query(
      `INSERT INTO news (title, content, source, url, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, content || "", source || "AgriTrend", url || "#", status || "draft", publishedAt]
    )

    const [[newNews]] = await pool.query("SELECT * FROM news WHERE id = ?", [result.insertId])
    res.status(201).json(newNews)
  } catch (error) {
    console.error("❌ Lỗi tạo tin tức:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// Cập nhật tin tức (Admin)
router.put("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { title, content, source, url, status } = req.body
    const id = parseInt(req.params.id)

    const [[existing]] = await pool.query("SELECT * FROM news WHERE id = ?", [id])
    if (!existing) {
      return res.status(404).json({ error: "Không tìm thấy tin tức" })
    }

    // Nếu chuyển sang published lần đầu, set published_at
    let publishedAt = existing.published_at
    if (status === "published" && existing.status !== "published") {
      publishedAt = new Date()
    }

    await pool.query(
      `UPDATE news SET title = ?, content = ?, source = ?, url = ?, status = ?, published_at = ? WHERE id = ?`,
      [
        title ?? existing.title,
        content ?? existing.content,
        source ?? existing.source,
        url ?? existing.url,
        status ?? existing.status,
        publishedAt,
        id
      ]
    )

    const [[updated]] = await pool.query("SELECT * FROM news WHERE id = ?", [id])
    res.json(updated)
  } catch (error) {
    console.error("❌ Lỗi cập nhật tin tức:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// Xoá tin tức (Admin)
router.delete("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const [result] = await pool.query("DELETE FROM news WHERE id = ?", [id])

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy tin tức" })
    }

    res.json({ message: "Đã xoá tin tức thành công" })
  } catch (error) {
    console.error("❌ Lỗi xoá tin tức:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

export default router
