import express from "express"
import pool from "../db.js"
import { authenticateToken, isAdmin } from "../middleware/auth.js"
import { buildKnowledgeContext, summarizeRecentMessages } from "./retrieval.js"
import { buildSystemPrompt } from "./prompts.js"
import { ingestChatbotKnowledge } from "./ingest.js"

const router = express.Router()
const sessionCache = new Map()

function resolveBotMode(role) {
  return role === "dealer" ? "dealer" : "user"
}

async function callGroqChat(messages) {
  if (!process.env.GROQ_API_KEY) {
    return null
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages,
      temperature: 0.2,
    }),
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message || "GROQ_ERROR")
  }

  return data.choices?.[0]?.message?.content?.trim() || null
}

async function callOpenAIChat(messages) {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      messages,
      temperature: 0.2,
    }),
  })

  const data = await response.json()
  if (data.error) {
    throw new Error(data.error.message || "OPENAI_ERROR")
  }

  return data.choices?.[0]?.message?.content?.trim() || null
}

async function callAiChat(messages) {
  if (process.env.GROQ_API_KEY) {
    try {
      const groqReply = await callGroqChat(messages)
      if (groqReply) return groqReply
    } catch (error) {
      console.warn("⚠️ Groq chat lỗi, thử fallback provider khác:", error.message)
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiReply = await callOpenAIChat(messages)
      if (openaiReply) return openaiReply
    } catch (error) {
      console.warn("⚠️ OpenAI chat lỗi, fallback về câu trả lời mặc định:", error.message)
    }
  }

  return null
}

async function getSessionOrThrow(sessionId, userId) {
  const [[session]] = await pool.query(
    `
      SELECT id, user_id, bot_mode, title, created_at
      FROM conversation_sessions
      WHERE id = ?
      LIMIT 1
    `,
    [sessionId]
  )

  if (!session) {
    const error = new Error("SESSION_NOT_FOUND")
    error.status = 404
    throw error
  }

  if (Number(session.user_id) !== Number(userId)) {
    const error = new Error("FORBIDDEN")
    error.status = 403
    throw error
  }

  return session
}

router.post("/session", authenticateToken, async (req, res) => {
  try {
    const botMode = resolveBotMode(req.user.role)
    const title = req.body?.title?.trim() || (botMode === "dealer" ? "Chat đại lý" : "Chat người dùng")

    const [result] = await pool.query(
      `
        INSERT INTO conversation_sessions (user_id, bot_mode, title)
        VALUES (?, ?, ?)
      `,
      [req.user.id, botMode, title]
    )

    res.status(201).json({
      success: true,
      session_id: result.insertId,
      bot_mode: botMode,
      title,
    })
  } catch (error) {
    console.error("POST /chat/session error:", error)
    res.status(500).json({ error: "Lỗi tạo session" })
  }
})

router.get("/sessions/me", authenticateToken, async (req, res) => {
  try {
    const botMode = resolveBotMode(req.user.role)
    const [rows] = await pool.query(
      `
        SELECT id, title, bot_mode, is_archived, is_pinned, created_at, updated_at
        FROM conversation_sessions
        WHERE user_id = ? AND bot_mode = ?
        ORDER BY is_pinned DESC, updated_at DESC, created_at DESC, id DESC
      `,
      [req.user.id, botMode]
    )

    res.json({ success: true, sessions: rows })
  } catch (error) {
    console.error("GET /chat/sessions/me error:", error)
    res.status(500).json({ error: "Lỗi lấy session" })
  }
})

router.get("/sessions/:user_id", authenticateToken, async (req, res) => {
  try {
    if (Number(req.params.user_id) !== Number(req.user.id) && req.user.role !== "admin") {
      return res.status(403).json({ error: "Bạn không có quyền truy cập" })
    }

    const botMode = resolveBotMode(req.user.role)
    const [rows] = await pool.query(
      `
        SELECT id, title, bot_mode, is_archived, is_pinned, created_at, updated_at
        FROM conversation_sessions
        WHERE user_id = ? AND bot_mode = ?
        ORDER BY is_pinned DESC, updated_at DESC, created_at DESC, id DESC
      `,
      [req.user.id, botMode]
    )

    res.json({ success: true, sessions: rows })
  } catch (error) {
    console.error("GET /chat/sessions/:user_id error:", error)
    res.status(500).json({ error: "Lỗi lấy session" })
  }
})

router.get("/:session_id/messages", authenticateToken, async (req, res) => {
  try {
    const sessionId = Number(req.params.session_id)
    if (!sessionId) {
      return res.status(400).json({ error: "Mã session không hợp lệ" })
    }

    await getSessionOrThrow(sessionId, req.user.id)

    const [rows] = await pool.query(
      `
        SELECT id, role, message, created_at
        FROM conversation_messages
        WHERE session_id = ?
        ORDER BY id ASC
      `,
      [sessionId]
    )

    res.json({ success: true, messages: rows })
  } catch (error) {
    const status = error.status || 500
    if (status !== 500) {
      return res.status(status).json({ error: status === 403 ? "Không có quyền truy cập" : "Không tìm thấy session" })
    }
    console.error("GET /chat/:session_id/messages error:", error)
    res.status(500).json({ error: "Lỗi lấy tin nhắn" })
  }
})

router.post("/message", authenticateToken, async (req, res) => {
  try {
    const sessionId = Number(req.body.session_id)
    const message = String(req.body.message || "").trim()

    if (!sessionId) {
      return res.status(400).json({ error: "Thiếu session_id" })
    }

    if (!message) {
      return res.status(400).json({ error: "Tin nhắn không được để trống" })
    }

    const session = await getSessionOrThrow(sessionId, req.user.id)
    const botMode = session.bot_mode || resolveBotMode(req.user.role)

    await pool.query(
      `
        INSERT INTO conversation_messages (session_id, user_id, role, message)
        VALUES (?, ?, 'user', ?)
      `,
      [sessionId, req.user.id, message]
    )

    const [historyRows] = await pool.query(
      `
        SELECT role, message
        FROM conversation_messages
        WHERE session_id = ?
        ORDER BY id DESC
        LIMIT 8
      `,
      [sessionId]
    )

    const history = historyRows.reverse()
    const knowledge = await buildKnowledgeContext({
      query: message,
      role: botMode,
      userId: req.user.id,
      limit: 6,
    })

    const recentSummary = summarizeRecentMessages(history)
    const systemPrompt = buildSystemPrompt({
      role: botMode,
      knowledgeContext: knowledge.text,
      recentSummary,
    })

    const aiReply = await callAiChat([
      { role: "system", content: systemPrompt },
      ...history.map((entry) => ({
        role: entry.role === "assistant" ? "assistant" : "user",
        content: entry.message,
      })),
      { role: "user", content: message },
    ])

    const finalReply =
      aiReply ||
      (botMode === "dealer"
        ? "Hiện tôi chưa có đủ dữ liệu RAG cho câu hỏi này. Hãy hỏi cụ thể hơn về nguồn hàng, giá đề xuất, trạng thái yêu cầu mua, hoặc vùng trồng."
        : "Hiện tôi chưa có đủ dữ liệu RAG cho câu hỏi này. Hãy hỏi cụ thể hơn về giá, xu hướng, lịch sử giá hoặc khu vực cần tra cứu.")

    await pool.query(
      `
        INSERT INTO conversation_messages (session_id, role, message, tokens_used)
        VALUES (?, 'assistant', ?, ?)
      `,
      [sessionId, finalReply, 0]
    )

    sessionCache.set(sessionId, {
      botMode,
      lastMessageAt: Date.now(),
    })

    res.json({
      success: true,
      reply: finalReply,
      knowledge: knowledge.chunks,
      bot_mode: botMode,
    })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.status === 403 ? "Không có quyền truy cập" : "Không tìm thấy session" })
    }
    console.error("POST /chat/message error:", error)
    res.status(500).json({ error: "Lỗi gửi tin nhắn" })
  }
})

router.patch("/session/title", authenticateToken, async (req, res) => {
  try {
    const sessionId = Number(req.body.session_id)
    const title = String(req.body.title || "").trim()

    if (!sessionId || !title) {
      return res.status(400).json({ error: "Thiếu session_id hoặc title" })
    }

    await getSessionOrThrow(sessionId, req.user.id)

    await pool.query(
      `
        UPDATE conversation_sessions
        SET title = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [title, sessionId]
    )

    res.json({ success: true, message: "Đã đổi tên phiên chat." })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.status === 403 ? "Không có quyền truy cập" : "Không tìm thấy session" })
    }
    console.error("PATCH /chat/session/title error:", error)
    res.status(500).json({ error: "Lỗi đổi tên session" })
  }
})

router.patch("/session/:session_id/pin", authenticateToken, async (req, res) => {
  try {
    const sessionId = Number(req.params.session_id)
    const pinned = Boolean(req.body?.pinned)

    if (!sessionId) {
      return res.status(400).json({ error: "Mã session không hợp lệ" })
    }

    await getSessionOrThrow(sessionId, req.user.id)

    await pool.query(
      `
        UPDATE conversation_sessions
        SET is_pinned = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [pinned ? 1 : 0, sessionId]
    )

    res.json({ success: true, pinned })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.status === 403 ? "Không có quyền truy cập" : "Không tìm thấy session" })
    }
    console.error("PATCH /chat/session/:session_id/pin error:", error)
    res.status(500).json({ error: "Không thể ghim session" })
  }
})

router.patch("/session/:session_id/archive", authenticateToken, async (req, res) => {
  try {
    const sessionId = Number(req.params.session_id)
    const archived = Boolean(req.body?.archived)

    if (!sessionId) {
      return res.status(400).json({ error: "Mã session không hợp lệ" })
    }

    await getSessionOrThrow(sessionId, req.user.id)

    await pool.query(
      `
        UPDATE conversation_sessions
        SET is_archived = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [archived ? 1 : 0, sessionId]
    )

    res.json({ success: true, archived })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.status === 403 ? "Không có quyền truy cập" : "Không tìm thấy session" })
    }
    console.error("PATCH /chat/session/:session_id/archive error:", error)
    res.status(500).json({ error: "Không thể ẩn session" })
  }
})

router.delete("/session/:session_id", authenticateToken, async (req, res) => {
  try {
    const sessionId = Number(req.params.session_id)

    if (!sessionId) {
      return res.status(400).json({ error: "Mã session không hợp lệ" })
    }

    await getSessionOrThrow(sessionId, req.user.id)

    await pool.query("DELETE FROM conversation_sessions WHERE id = ?", [sessionId])

    res.json({ success: true })
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.status === 403 ? "Không có quyền truy cập" : "Không tìm thấy session" })
    }
    console.error("DELETE /chat/session/:session_id error:", error)
    res.status(500).json({ error: "Không thể xoá session" })
  }
})

router.post("/reindex", authenticateToken, isAdmin, async (_req, res) => {
  try {
    const summary = await ingestChatbotKnowledge()
    res.json({ success: true, summary })
  } catch (error) {
    console.error("POST /chat/reindex error:", error)
    res.status(500).json({ error: "Không thể cập nhật kho tri thức" })
  }
})

export default router
