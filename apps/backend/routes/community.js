// routes/community.js
import express from "express"
import pool from "../db.js"
import { authenticateToken } from "../middleware/auth.js"

const router = express.Router()

// Realtime socket holder
export const ioRef = { io: null }

/* ------------------------------
 Helper: parse JSON safe for tags
------------------------------- */
const parseTags = (v) => {
  if (!v) return []
  try {
    const arr = JSON.parse(v)
    return Array.isArray(arr) ? arr : []
  } catch {
    return typeof v === "string"
      ? v.split(",").map((x) => x.trim()).filter(Boolean)
      : []
  }
}

/* ------------------------------
 GET /api/community/posts
------------------------------- */
router.get("/posts", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10
    const page = Number(req.query.page) || 1
    const offset = (page - 1) * limit

    const search = req.query.search ? `%${req.query.search}%` : null
    const where = search
      ? "WHERE p.content LIKE ? OR p.tags LIKE ?"
      : ""
    const params = search ? [search, search] : []

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM community_posts p ${where}`,
      params
    )

    const [rows] = await pool.query(
      `
      SELECT p.*, u.name AS author_name, u.avatar_url 
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      ${where}
      ORDER BY p.id DESC
      LIMIT ? OFFSET ?
    `,
      [...params, limit, offset]
    )

    // ✔ Convert tags from string → array
    const data = rows.map((p) => ({
      ...p,
      tags: parseTags(p.tags),
    }))

    res.json({
      page,
      limit,
      total: countRow.total,
      totalPages: Math.ceil(countRow.total / limit),
      data,
    })
  } catch (err) {
    console.error("GET /posts error:", err)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

/* ------------------------------
 POST /api/community/posts
------------------------------- */
router.post("/posts", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id
    const { content, tags } = req.body

    if (!content?.trim())
      return res.status(400).json({ error: "Nội dung không được để trống" })

    const tagJson = JSON.stringify(tags || [])

    const [result] = await pool.query(
      `INSERT INTO community_posts (user_id, content, tags) VALUES (?, ?, ?)`,
      [userId, content, tagJson]
    )

    const insertedId = result.insertId

    const [[newPost]] = await pool.query(
      `
      SELECT p.*, u.name AS author_name, u.avatar_url
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `,
      [insertedId]
    )

    newPost.tags = parseTags(newPost.tags)

    // Emit realtime
    ioRef.io?.emit("community:new_post", newPost)

    res.status(201).json({ message: "Đã tạo bài viết", data: newPost })
  } catch (err) {
    console.error("POST /posts error:", err)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

/* ------------------------------
 GET /api/community/posts/:id
------------------------------- */
router.get("/posts/:id", async (req, res) => {
  try {
    const postId = req.params.id

    const [[post]] = await pool.query(
      `
      SELECT p.*, u.name AS author_name, u.avatar_url
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `,
      [postId]
    )

    if (!post) return res.status(404).json({ error: "Không tìm thấy bài" })

    post.tags = parseTags(post.tags)

    // load latest 10 comments
    const [comments] = await pool.query(
      `
      SELECT c.*, u.name AS author_name, u.avatar_url
      FROM community_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.id ASC
      LIMIT 10
    `,
      [postId]
    )

    res.json({ post, comments })
  } catch (err) {
    console.error("GET /posts/:id error:", err)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

/* ------------------------------
 PUT /api/community/posts/:id
------------------------------- */
router.put("/posts/:id", authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id
    const userId = req.user.id
    const { content, tags } = req.body

    const [[post]] = await pool.query(
      "SELECT user_id FROM community_posts WHERE id = ?",
      [postId]
    )
    if (!post) return res.status(404).json({ error: "Không tìm thấy bài" })

    if (post.user_id !== userId && req.user.role !== "admin")
      return res.status(403).json({ error: "Không có quyền sửa bài" })

    await pool.query(
      "UPDATE community_posts SET content = ?, tags = ? WHERE id = ?",
      [content, JSON.stringify(tags || []), postId]
    )

    const [[updated]] = await pool.query(
      `
      SELECT p.*, u.name AS author_name, u.avatar_url
      FROM community_posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `,
      [postId]
    )

    updated.tags = parseTags(updated.tags)

    ioRef.io?.emit("community:post_updated", updated)

    res.json({ message: "Đã cập nhật bài", data: updated })
  } catch (err) {
    console.error("PUT /posts/:id error:", err)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

/* ------------------------------
 DELETE /api/community/posts/:id
------------------------------- */
router.delete("/posts/:id", authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id
    const userId = req.user.id

    const [[post]] = await pool.query(
      "SELECT user_id FROM community_posts WHERE id = ?",
      [postId]
    )

    if (!post) return res.status(404).json({ error: "Không tìm thấy bài" })

    if (post.user_id !== userId && req.user.role !== "admin")
      return res.status(403).json({ error: "Không có quyền xoá bài" })

    await pool.query("DELETE FROM community_posts WHERE id = ?", [postId])

    ioRef.io?.emit("community:post_deleted", { id: Number(postId) })

    res.json({ message: "Đã xoá bài" })
  } catch (err) {
    console.error("DELETE /posts/:id error:", err)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

/* ------------------------------
 POST comment
------------------------------- */
router.post("/posts/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const postId = req.params.postId
    const userId = req.user.id
    const { content } = req.body

    if (!content?.trim())
      return res.status(400).json({ error: "Nội dung trống" })

    const [result] = await pool.query(
      `INSERT INTO community_comments (post_id, user_id, content)
       VALUES (?, ?, ?)`,
      [postId, userId, content]
    )

    const insertedId = result.insertId

    const [[comment]] = await pool.query(
      `
      SELECT c.*, u.name AS author_name, u.avatar_url
      FROM community_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `,
      [insertedId]
    )

    // Auto update counter
    await pool.query(`
      UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = ?
    `, [postId])

    // ioRef.io?.emit("community:new_comment", comment)
    console.log("🔥 EMIT COMMENT:", postId, comment);
    ioRef.io?.emit("community:comment_added", { postId, comment });



    res.status(201).json({ message: "Đã thêm bình luận", data: comment })
  } catch (err) {
    console.error("POST comment error:", err)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

/* ------------------------------
 GET comments with pagination
------------------------------- */
router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = req.params.postId;
    const limit = Number(req.query.limit) || 10;
    const offset = Number(req.query.offset) || 0;

    const [rows] = await pool.query(
      `
      SELECT c.*, u.name AS author_name, u.avatar_url
      FROM community_comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.id DESC
      LIMIT ? OFFSET ?
      `,
      [postId, limit, offset]
    );

    res.json({ data: rows });
  } catch (err) {
    console.error("GET comments error:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});


/* ------------------------------
 LIKE / UNLIKE toggle
------------------------------- */
router.post("/posts/:id/like", authenticateToken, async (req, res) => {
  try {
    const postId = Number(req.params.id)
    const userId = req.user.id

    const [[liked]] = await pool.query(
      `SELECT id FROM community_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId]
    )

    if (liked) {
      // unlike
      await pool.query("DELETE FROM community_likes WHERE id = ?", [liked.id])
      await pool.query(
        `UPDATE community_posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?`,
        [postId]
      )

      ioRef.io?.emit("community:unlike", { postId, userId })

      return res.json({ liked: false })
    }

    // like
    await pool.query(
      "INSERT INTO community_likes (post_id, user_id) VALUES (?, ?)",
      [postId, userId]
    )
    await pool.query(
      "UPDATE community_posts SET likes = likes + 1 WHERE id = ?",
      [postId]
    )

    ioRef.io?.emit("community:like", { postId, userId })

    res.json({ liked: true })
  } catch (err) {
    console.error("POST like error:", err)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

/* ------------------------------
 GET like status (user liked?)
------------------------------- */
router.get("/posts/:id/like-status", authenticateToken, async (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.id;

    const [[liked]] = await pool.query(
      `SELECT id FROM community_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId]
    );

    res.json({ liked: !!liked });
  } catch (err) {
    console.error("GET like-status error:", err);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});


export default router
