import express from "express"
import pool from "../db.js"
import { authenticateToken } from "../middleware/auth.js"
import multer from "multer"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const router = express.Router()

export const ioRef = { io: null }

const uploadDir = path.join(__dirname, "../uploads/community")

const ensureUploadDir = () => {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
}

const parseImages = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value.filter(Boolean)

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
      if (typeof parsed === "string" && parsed.trim()) return [parsed.trim()]
    } catch {
      return value.split(",").map((item) => item.trim()).filter(Boolean)
    }
  }

  return []
}

const normalizePost = (post) => {
  if (!post) return post

  const images = parseImages(post.images ?? post.image_url)
  post.images = images
  post.image_url = JSON.stringify(images)
  post.tags = parseTags(post.tags)
  return post
}

// Cß║Ñu h├¼nh Multer ─æß╗â l╞░u ß║únh
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir()
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`)
  },
})

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 } // Giß╗¢i hß║ín 20MB
})

const parseTags = (value) => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return typeof value === "string"
      ? value.split(",").map((item) => item.trim()).filter(Boolean)
      : []
  }
}

const normalizeConversationPair = (firstUserId, secondUserId) => {
  const a = Number(firstUserId)
  const b = Number(secondUserId)

  if (!Number.isInteger(a) || !Number.isInteger(b) || a <= 0 || b <= 0 || a === b) {
    return null
  }

  return a < b ? [a, b] : [b, a]
}

const ensureConversation = async (currentUserId, otherUserId) => {
  const pair = normalizeConversationPair(currentUserId, otherUserId)
  if (!pair) return null

  const [userOneId, userTwoId] = pair

  const [[existing]] = await pool.query(
    `
      SELECT id, user_one_id, user_two_id, created_at, updated_at
      FROM direct_message_conversations
      WHERE user_one_id = ? AND user_two_id = ?
    `,
    [userOneId, userTwoId]
  )

  if (existing) return existing

  const [result] = await pool.query(
    `
      INSERT INTO direct_message_conversations (user_one_id, user_two_id)
      VALUES (?, ?)
    `,
    [userOneId, userTwoId]
  )

  const [[created]] = await pool.query(
    `
      SELECT id, user_one_id, user_two_id, created_at, updated_at
      FROM direct_message_conversations
      WHERE id = ?
    `,
    [result.insertId]
  )

  return created
}

const getConversationMeta = async (conversationId, currentUserId) => {
  const [rows] = await pool.query(
    `
      SELECT
        c.id,
        c.created_at,
        c.updated_at,
        other.id AS other_user_id,
        other.name AS other_user_name,
        other.avatar_url AS other_user_avatar
      FROM direct_message_conversations c
      JOIN users other
        ON other.id = CASE
          WHEN c.user_one_id = ? THEN c.user_two_id
          ELSE c.user_one_id
        END
      WHERE c.id = ?
        AND (? IN (c.user_one_id, c.user_two_id))
    `,
    [currentUserId, conversationId, currentUserId]
  )

  return rows[0] || null
}

router.get("/users", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id
    const search = req.query.search?.trim()
    const limit = Math.min(Number(req.query.limit) || 20, 50)

    const whereClauses = ["u.id != ?"]
    const params = [currentUserId]

    if (search) {
      whereClauses.push("(u.name LIKE ? OR u.email LIKE ?)")
      params.push(`%${search}%`, `%${search}%`)
    }

    const [rows] = await pool.query(
      `
        SELECT
          u.id,
          u.name,
          u.email,
          u.avatar_url,
          c.id AS conversation_id
        FROM users u
        LEFT JOIN direct_message_conversations c
          ON (
            (c.user_one_id = LEAST(?, u.id) AND c.user_two_id = GREATEST(?, u.id))
          )
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY u.name ASC
        LIMIT ?
      `,
      [currentUserId, currentUserId, ...params, limit]
    )

    res.json({ data: rows })
  } catch (error) {
    console.error("GET /community/users error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/messages/conversations", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id

    const [rows] = await pool.query(
      `
        SELECT
          c.id,
          c.created_at,
          c.updated_at,
          other.id AS other_user_id,
          other.name AS other_user_name,
          other.avatar_url AS other_user_avatar,
          last_message.id AS last_message_id,
          last_message.content AS last_message_content,
          last_message.created_at AS last_message_created_at,
          last_message.sender_id AS last_message_sender_id,
          COALESCE(unread.unread_count, 0) AS unread_count
        FROM direct_message_conversations c
        JOIN users other
          ON other.id = CASE
            WHEN c.user_one_id = ? THEN c.user_two_id
            ELSE c.user_one_id
          END
        LEFT JOIN direct_messages last_message
          ON last_message.id = (
            SELECT dm.id
            FROM direct_messages dm
            WHERE dm.conversation_id = c.id
            ORDER BY dm.created_at DESC, dm.id DESC
            LIMIT 1
          )
        LEFT JOIN (
          SELECT conversation_id, COUNT(*) AS unread_count
          FROM direct_messages
          WHERE recipient_id = ? AND is_read = FALSE
          GROUP BY conversation_id
        ) unread ON unread.conversation_id = c.id
        WHERE ? IN (c.user_one_id, c.user_two_id)
        ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC, c.id DESC
      `,
      [currentUserId, currentUserId, currentUserId]
    )

    res.json({ data: rows })
  } catch (error) {
    console.error("GET /messages/conversations error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/messages/conversations/:conversationId/messages", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id
    const conversationId = Number(req.params.conversationId)

    const conversation = await getConversationMeta(conversationId, currentUserId)
    if (!conversation) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy cuß╗Öc tr├▓ chuyß╗çn" })
    }

    const [rows] = await pool.query(
      `
        SELECT
          dm.id,
          dm.conversation_id,
          dm.sender_id,
          dm.recipient_id,
          dm.content,
          dm.is_read,
          dm.read_at,
          dm.created_at,
          sender.name AS sender_name,
          sender.avatar_url AS sender_avatar_url
        FROM direct_messages dm
        JOIN users sender ON sender.id = dm.sender_id
        WHERE dm.conversation_id = ?
        ORDER BY dm.created_at ASC, dm.id ASC
      `,
      [conversationId]
    )

    res.json({ conversation, data: rows })
  } catch (error) {
    console.error("GET /messages/conversations/:conversationId/messages error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.post("/messages", authenticateToken, async (req, res) => {
  try {
    const senderId = req.user.id
    const recipientId = Number(req.body.recipientId)
    const content = req.body.content?.trim()

    if (!content) {
      return res.status(400).json({ error: "Nß╗Öi dung kh├┤ng ─æ╞░ß╗úc ─æß╗â trß╗æng" })
    }

    if (!recipientId || recipientId === senderId) {
      return res.status(400).json({ error: "Ng╞░ß╗¥i nhß║¡n kh├┤ng hß╗úp lß╗ç" })
    }

    const [[recipient]] = await pool.query(
      "SELECT id, name, avatar_url FROM users WHERE id = ?",
      [recipientId]
    )

    if (!recipient) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy ng╞░ß╗¥i nhß║¡n" })
    }

    const conversation = await ensureConversation(senderId, recipientId)
    if (!conversation) {
      return res.status(400).json({ error: "Kh├┤ng thß╗â tß║ío cuß╗Öc tr├▓ chuyß╗çn" })
    }

    const [result] = await pool.query(
      `
        INSERT INTO direct_messages (conversation_id, sender_id, recipient_id, content)
        VALUES (?, ?, ?, ?)
      `,
      [conversation.id, senderId, recipientId, content]
    )

    await pool.query(
      "UPDATE direct_message_conversations SET updated_at = NOW() WHERE id = ?",
      [conversation.id]
    )

    const [[message]] = await pool.query(
      `
        SELECT
          dm.id,
          dm.conversation_id,
          dm.sender_id,
          dm.recipient_id,
          dm.content,
          dm.is_read,
          dm.read_at,
          dm.created_at,
          sender.name AS sender_name,
          sender.avatar_url AS sender_avatar_url
        FROM direct_messages dm
        JOIN users sender ON sender.id = dm.sender_id
        WHERE dm.id = ?
      `,
      [result.insertId]
    )

    const senderConversation = await getConversationMeta(conversation.id, senderId)
    const recipientConversation = await getConversationMeta(conversation.id, recipientId)

    ioRef.io?.to(`user:${senderId}`).emit("community:dm:new", {
      conversation: { ...senderConversation, unread_count: 0 },
      message,
    })

    ioRef.io?.to(`user:${recipientId}`).emit("community:dm:new", {
      conversation: { ...recipientConversation, unread_count: 1 },
      message,
    })

    res.status(201).json({
      conversation: { ...senderConversation, unread_count: 0 },
      data: message,
    })
  } catch (error) {
    console.error("POST /messages error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.patch("/messages/conversations/:conversationId/read", authenticateToken, async (req, res) => {
  try {
    const currentUserId = req.user.id
    const conversationId = Number(req.params.conversationId)

    const conversation = await getConversationMeta(conversationId, currentUserId)
    if (!conversation) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy cuß╗Öc tr├▓ chuyß╗çn" })
    }

    await pool.query(
      `
        UPDATE direct_messages
        SET is_read = TRUE, read_at = NOW()
        WHERE conversation_id = ? AND recipient_id = ? AND is_read = FALSE
      `,
      [conversationId, currentUserId]
    )

    ioRef.io?.to(`user:${conversation.other_user_id}`).emit("community:dm:read", {
      conversationId,
      readerId: currentUserId,
    })

    res.json({ success: true })
  } catch (error) {
    console.error("PATCH /messages/conversations/:conversationId/read error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/posts", async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10
    const page = Number(req.query.page) || 1
    const offset = (page - 1) * limit

    const search = req.query.search ? `%${req.query.search}%` : null
    const where = search ? "WHERE p.content LIKE ? OR p.tags LIKE ?" : ""
    const params = search ? [search, search] : []

    const [[countRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM community_posts p ${where}`,
      params
    )

    const [rows] = await pool.query(
      `
        SELECT p.*, u.name AS author_name, u.avatar_url,
        (SELECT COUNT(*) FROM community_comments WHERE post_id = p.id AND deleted_at IS NULL) as comments_count
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        ${where}
        ORDER BY p.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    )

    res.json({
      page,
      limit,
      total: countRow.total,
      totalPages: Math.ceil(countRow.total / limit),
      data: rows.map((post) => normalizePost(post)),
    })
  } catch (error) {
    console.error("GET /posts error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.post("/posts", authenticateToken, upload.array("images", 5), async (req, res) => {
  try {
    const userId = req.user.id
    const { content, tags } = req.body

    let imageUrls = []
    if (req.files && req.files.length > 0) {
      imageUrls = req.files.map((file) => `/uploads/community/${file.filename}`)
    }

    if (!content?.trim()) {
      return res.status(400).json({ error: "Nß╗Öi dung kh├┤ng ─æ╞░ß╗úc ─æß╗â trß╗æng" })
    }

    const tagsToSave = typeof tags === "string" ? tags : JSON.stringify(tags || [])
    const imagesToSave = JSON.stringify(imageUrls)

    const [result] = await pool.query(
      "INSERT INTO community_posts (user_id, content, tags, images) VALUES (?, ?, ?, ?)",
      [userId, content, tagsToSave, imagesToSave]
    )

    const [[newPost]] = await pool.query(
      `
        SELECT p.*, p.images AS image_url, u.name AS author_name, u.avatar_url
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `,
      [result.insertId]
    )

    normalizePost(newPost)
    ioRef.io?.emit("community:new_post", newPost)

    res.status(201).json({ message: "─É├ú tß║ío b├ái viß║┐t", data: newPost })
  } catch (error) {
    console.error("POST /posts error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/posts/featured", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 10)

    const [rows] = await pool.query(
      `
        SELECT
          p.*, p.images AS image_url,
          u.name AS author_name,
          u.avatar_url,
          (SELECT COUNT(*) FROM community_comments WHERE post_id = p.id AND deleted_at IS NULL) as comments_count
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY COALESCE(p.likes, 0) DESC, comments_count DESC, p.id DESC
        LIMIT ?
      `,
      [limit]
    )

    res.json({ data: rows.map((post) => normalizePost(post)) })
  } catch (error) {
    console.error("GET /posts/featured error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/posts/:id", async (req, res) => {
  try {
    const postId = req.params.id

    const [[post]] = await pool.query(
      `
        SELECT p.*, p.images AS image_url, u.name AS author_name, u.avatar_url
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `,
      [postId]
    )

    if (!post) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy b├ái" })
    }

    normalizePost(post)

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
  } catch (error) {
    console.error("GET /posts/:id error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.put("/posts/:id", authenticateToken, upload.array("images", 5), async (req, res) => {
  try {
    const postId = req.params.id
    const userId = req.user.id
    const { content, tags, image_url, images } = req.body

    const [[post]] = await pool.query(
      "SELECT user_id FROM community_posts WHERE id = ?",
      [postId]
    )

    if (!post) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy b├ái" })
    }

    if (post.user_id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Kh├┤ng c├│ quyß╗ün sß╗¡a b├ái" })
    }

    // 1. Lß║Ñy danh s├ích ß║únh c┼⌐ ─æ╞░ß╗úc giß╗» lß║íi
    let finalImageUrls = parseImages(images || image_url)

    // 2. Th├¬m c├íc ß║únh mß╗¢i ─æ╞░ß╗úc upload (nß║┐u c├│)
    if (req.files && req.files.length > 0) {
      const newUrls = req.files.map((file) => `/uploads/community/${file.filename}`)
      finalImageUrls = [...finalImageUrls, ...newUrls]
    }

    const tagsToSave = typeof tags === "string" ? tags : JSON.stringify(tags || [])

    await pool.query(
      "UPDATE community_posts SET content = ?, tags = ?, images = ? WHERE id = ?",
      [content, tagsToSave, JSON.stringify(finalImageUrls), postId]
    )

    const [[updated]] = await pool.query(
      `
        SELECT p.*, p.images AS image_url, u.name AS author_name, u.avatar_url
        FROM community_posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `,
      [postId]
    )

    normalizePost(updated)
    ioRef.io?.emit("community:post_updated", updated)

    res.json({ message: "─É├ú cß║¡p nhß║¡t b├ái", data: updated })
  } catch (error) {
    console.error("PUT /posts/:id error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.delete("/posts/:id", authenticateToken, async (req, res) => {
  try {
    const postId = req.params.id
    const userId = req.user.id

    const [[post]] = await pool.query(
      "SELECT user_id FROM community_posts WHERE id = ?",
      [postId]
    )

    if (!post) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy b├ái" })
    }

    if (post.user_id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Kh├┤ng c├│ quyß╗ün xo├í b├ái" })
    }

    await pool.query("DELETE FROM community_posts WHERE id = ?", [postId])
    ioRef.io?.emit("community:post_deleted", { id: Number(postId) })

    res.json({ message: "─É├ú xo├í b├ái" })
  } catch (error) {
    console.error("DELETE /posts/:id error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.post("/posts/:postId/comments", authenticateToken, async (req, res) => {
  try {
    const postId = req.params.postId
    const userId = req.user.id
    const { content } = req.body

    if (!content?.trim()) {
      return res.status(400).json({ error: "Nß╗Öi dung trß╗æng" })
    }

    const [result] = await pool.query(
      `
        INSERT INTO community_comments (post_id, user_id, content)
        VALUES (?, ?, ?)
      `,
      [postId, userId, content]
    )

    const [[comment]] = await pool.query(
      `
        SELECT c.*, u.name AS author_name, u.avatar_url
        FROM community_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `,
      [result.insertId]
    )

    await pool.query(
      "UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = ?",
      [postId]
    )

    ioRef.io?.emit("community:comment_added", { postId: Number(postId), comment })

    res.status(201).json({ message: "─É├ú th├¬m b├¼nh luß║¡n", data: comment })
  } catch (error) {
    console.error("POST comment error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.put("/posts/:postId/comments/:commentId", authenticateToken, async (req, res) => {
  try {
    const postId = Number(req.params.postId)
    const commentId = Number(req.params.commentId)
    const userId = req.user.id
    const content = req.body.content?.trim()

    if (!content) {
      return res.status(400).json({ error: "Nß╗Öi dung trß╗æng" })
    }

    const [[commentRow]] = await pool.query(
      "SELECT id, post_id, user_id FROM community_comments WHERE id = ?",
      [commentId]
    )

    if (!commentRow || Number(commentRow.post_id) !== postId) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy b├¼nh luß║¡n" })
    }

    if (commentRow.user_id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Kh├┤ng c├│ quyß╗ün sß╗¡a b├¼nh luß║¡n" })
    }

    await pool.query(
      "UPDATE community_comments SET content = ? WHERE id = ?",
      [content, commentId]
    )

    const [[updatedComment]] = await pool.query(
      `
        SELECT c.*, u.name AS author_name, u.avatar_url
        FROM community_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `,
      [commentId]
    )

    ioRef.io?.emit("community:comment_updated", {
      postId,
      comment: updatedComment,
    })

    res.json({ message: "─É├ú cß║¡p nhß║¡t b├¼nh luß║¡n", data: updatedComment })
  } catch (error) {
    console.error("PUT comment error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.delete("/posts/:postId/comments/:commentId", authenticateToken, async (req, res) => {
  try {
    const postId = Number(req.params.postId)
    const commentId = Number(req.params.commentId)
    const userId = req.user.id

    const [[commentRow]] = await pool.query(
      "SELECT id, post_id, user_id FROM community_comments WHERE id = ?",
      [commentId]
    )

    if (!commentRow || Number(commentRow.post_id) !== postId) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy b├¼nh luß║¡n" })
    }

    if (commentRow.user_id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ error: "Kh├┤ng c├│ quyß╗ün xo├í b├¼nh luß║¡n" })
    }

    // 1. Soft Delete the comment
    await pool.query(
      "UPDATE community_comments SET deleted_at = NOW() WHERE id = ?",
      [commentId]
    );

    // 2. Decrement comments_count in post (legacy counter)
    await pool.query(
      "UPDATE community_posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = ?",
      [postId]
    );

    ioRef.io?.emit("community:comment_deleted", {
      postId,
      commentId,
    })

    res.json({ message: "─É├ú xo├í b├¼nh luß║¡n", data: { id: commentId } })
  } catch (error) {
    console.error("DELETE comment error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/posts/:postId/comments", async (req, res) => {
  try {
    const postId = req.params.postId
    const limit = Number(req.query.limit) || 10
    const offset = Number(req.query.offset) || 0

    const [rows] = await pool.query(
      `
        SELECT c.*, u.name AS author_name, u.avatar_url
        FROM community_comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.post_id = ? AND c.deleted_at IS NULL
        ORDER BY c.id DESC
        LIMIT ? OFFSET ?
      `,
      [postId, limit, offset]
    )

    res.json({ data: rows })
  } catch (error) {
    console.error("GET comments error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.post("/posts/:id/like", authenticateToken, async (req, res) => {
  try {
    const postId = Number(req.params.id)
    const userId = req.user.id

    const [[liked]] = await pool.query(
      "SELECT id FROM community_likes WHERE post_id = ? AND user_id = ?",
      [postId, userId]
    )

    if (liked) {
      await pool.query("DELETE FROM community_likes WHERE id = ?", [liked.id])
      await pool.query(
        "UPDATE community_posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?",
        [postId]
      )

      ioRef.io?.emit("community:unlike", { postId, userId })
      return res.json({ liked: false })
    }

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
  } catch (error) {
    console.error("POST like error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/posts/:id/like-status", authenticateToken, async (req, res) => {
  try {
    const postId = Number(req.params.id)
    const userId = req.user.id

    const [[liked]] = await pool.query(
      "SELECT id FROM community_likes WHERE post_id = ? AND user_id = ?",
      [postId, userId]
    )

    const [[post]] = await pool.query(
      "SELECT likes FROM community_posts WHERE id = ?",
      [postId]
    )

    res.json({ liked: !!liked, likes: Number(post?.likes || 0) })
  } catch (error) {
    console.error("GET like-status error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

// --- AI Comment Generation ---
async function callGroqChat(messages) {
  if (!process.env.GROQ_API_KEY) return null
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        temperature: 0.7,
        max_tokens: 150
      }),
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error("Groq AI Error:", err)
    return null
  }
}

async function callOpenAIChat(messages) {
  if (!process.env.OPENAI_API_KEY) return null
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 150
      }),
    })
    const data = await response.json()
    return data.choices?.[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error("OpenAI Error:", err)
    return null
  }
}

router.post("/ai-generate-comment", authenticateToken, async (req, res) => {
  try {
    const { postContent } = req.body
    if (!postContent) {
      return res.status(400).json({ error: "Thiß║┐u nß╗Öi dung b├ái viß║┐t" })
    }

    const systemPrompt = `
      Bß║ín l├á mß╗Öt n├┤ng d├ón Viß╗çt Nam th├ón thiß╗çn, am hiß╗âu vß╗ü n├┤ng nghiß╗çp.
      H├úy viß║┐t mß╗Öt b├¼nh luß║¡n ngß║»n gß╗ìn (d╞░ß╗¢i 30 tß╗½), t├¡ch cß╗▒c v├á li├¬n quan ─æß║┐n nß╗Öi dung b├ái ─æ─âng ─æ╞░ß╗úc cung cß║Ñp.
      Ng├┤n ngß╗»: Tiß║┐ng Viß╗çt, sß╗¡ dß╗Ñng v─ân phong gß║ºn g┼⌐i cß╗ºa ng╞░ß╗¥i n├┤ng d├ón.
      Kh├┤ng sß╗¡ dß╗Ñng hashtag, kh├┤ng sß╗¡ dß╗Ñng icon qu├í ─æ├á.
    `

    const userPrompt = `Nß╗Öi dung b├ái ─æ─âng: "${postContent}"`

    let reply = await callGroqChat([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ])

    if (!reply) {
      reply = await callOpenAIChat([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ])
    }

    if (!reply) {
      return res.status(503).json({ error: "Dß╗ïch vß╗Ñ AI hiß╗çn kh├┤ng khß║ú dß╗Ñng" })
    }

    res.json({ data: reply })
  } catch (error) {
    console.error("AI Generate Comment Error:", error)
    res.status(500).json({ error: "Lß╗ùi tß║ío b├¼nh luß║¡n AI" })
  }
})

export default router
