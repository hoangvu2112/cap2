import pool from "../db.js"
import { createEmbeddings, cosineSimilarity, normalizeForRag } from "./embeddings.js"

function summarizeText(value, maxLength = 220) {
  const text = String(value || "").replace(/\s+/g, " ").trim()
  if (text.length <= maxLength) return text
  return `${text.slice(0, maxLength).trim()}...`
}

function summarizeRecentMessages(messages = [], maxItems = 6) {
  return messages
    .slice(-maxItems)
    .map((message) => `${message.role === "assistant" ? "Bot" : "Người dùng"}: ${summarizeText(message.message, 180)}`)
    .join("\n")
}

async function loadEmbeddedChunks(role) {
  const [rows] = await pool.query(
    `
      SELECT
        c.id,
        c.content,
        c.embedding_json,
        c.token_count,
        c.role_scope,
        c.metadata_json,
        d.title,
        d.source_url,
        d.external_id,
        s.source_key,
        s.name AS source_name,
        s.source_type,
        s.role_scope AS source_role_scope
      FROM chatbot_chunks c
      JOIN chatbot_documents d ON d.id = c.document_id
      JOIN chatbot_sources s ON s.id = d.source_id
      WHERE s.enabled = TRUE
        AND (c.role_scope = 'shared' OR c.role_scope = ? OR d.role_scope = 'shared' OR s.role_scope = 'shared')
      ORDER BY c.updated_at DESC, c.id DESC
      LIMIT 1500
    `,
    [role]
  )

  return rows
    .map((row) => {
      let embedding = null
      try {
        embedding = row.embedding_json ? JSON.parse(row.embedding_json) : null
      } catch {
        embedding = null
      }

      let metadata = {}
      try {
        metadata = row.metadata_json ? JSON.parse(row.metadata_json) : {}
      } catch {
        metadata = {}
      }

      return {
        ...row,
        embedding,
        metadata,
        text: `${row.title}\n${row.content}`,
      }
    })
    .filter((row) => row.content)
}

function scoreByLexicalMatch(query, chunk) {
  const queryNormalized = normalizeForRag(query)
  const text = normalizeForRag(`${chunk.title}\n${chunk.content}`)
  const tokens = queryNormalized.split(/[^a-z0-9]+/g).filter(Boolean)
  let score = 0

  for (const token of tokens) {
    if (token.length < 2) continue
    if (text.includes(token)) score += 2
  }

  if (chunk.metadata?.productName && queryNormalized.includes(normalizeForRag(chunk.metadata.productName))) {
    score += 4
  }

  if (chunk.metadata?.region && queryNormalized.includes(normalizeForRag(chunk.metadata.region))) {
    score += 3
  }

  if (text.includes(queryNormalized)) score += 4
  return score
}

async function loadLiveRoleContext(role, userId) {
  const chunks = []

  if (role === "dealer") {
    const [requests] = await pool.query(
      `
        SELECT
          pr.id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.created_at,
          p.name AS product_name,
          p.region,
          farmer.name AS farmer_name
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users farmer ON farmer.id = pr.farmer_id
        WHERE pr.buyer_id = ?
        ORDER BY pr.created_at DESC, pr.id DESC
        LIMIT 20
      `,
      [userId]
    )

    for (const request of requests) {
      chunks.push({
        title: `Yêu cầu mua #${request.id}`,
        content: [
          `Sản phẩm: ${request.product_name}`,
          `Khu vực: ${request.region || "không rõ"}`,
          `Nông dân: ${request.farmer_name}`,
          `Số lượng: ${Number(request.quantity || 0).toLocaleString("vi-VN")}`,
          `Giá đề xuất: ${Number(request.proposed_price || 0).toLocaleString("vi-VN")} đ`,
          `Trạng thái: ${request.status}`,
          `Ghi chú: ${summarizeText(request.note || "")}`,
        ].join("\n"),
        source_name: "purchase_requests",
        source_key: "live-request",
        source_type: "database",
        metadata: { requestId: request.id, productName: request.product_name, region: request.region },
      })
    }
  }

  if (role === "user") {
    const [requests] = await pool.query(
      `
        SELECT
          pr.id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.created_at,
          p.name AS product_name,
          p.region,
          buyer.name AS buyer_name
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users buyer ON buyer.id = pr.buyer_id
        WHERE pr.farmer_id = ?
        ORDER BY pr.created_at DESC, pr.id DESC
        LIMIT 20
      `,
      [userId]
    )

    for (const request of requests) {
      chunks.push({
        title: `Yêu cầu thương lượng #${request.id}`,
        content: [
          `Sản phẩm: ${request.product_name}`,
          `Khu vực: ${request.region || "không rõ"}`,
          `Người mua: ${request.buyer_name}`,
          `Số lượng: ${Number(request.quantity || 0).toLocaleString("vi-VN")}`,
          `Giá đề xuất: ${Number(request.proposed_price || 0).toLocaleString("vi-VN")} đ`,
          `Trạng thái: ${request.status}`,
          `Ghi chú: ${summarizeText(request.note || "")}`,
        ].join("\n"),
        source_name: "purchase_requests",
        source_key: "live-request",
        source_type: "database",
        metadata: { requestId: request.id, productName: request.product_name, region: request.region },
      })
    }
  }

  return chunks
}

export async function buildKnowledgeContext({ query, role, userId, limit = 8 }) {
  const [embeddedChunks, liveRoleChunks, embeddingVector] = await Promise.all([
    loadEmbeddedChunks(role),
    loadLiveRoleContext(role, userId),
    createEmbeddings([query]).then((items) => items[0]).catch(() => null),
  ])

  const scoredEmbedded = embeddedChunks.map((chunk) => {
    const similarity = embeddingVector && Array.isArray(chunk.embedding) ? cosineSimilarity(embeddingVector, chunk.embedding) : 0
    const lexical = scoreByLexicalMatch(query, chunk) / 10
    return {
      ...chunk,
      score: similarity > 0 ? similarity : lexical,
      matchType: similarity > 0 ? "embedding" : "lexical",
    }
  })

  const scoredLive = liveRoleChunks.map((chunk) => ({
    ...chunk,
    score: scoreByLexicalMatch(query, chunk) / 8 + 0.4,
    matchType: "live",
  }))

  const topChunks = [...scoredLive, ...scoredEmbedded]
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return {
    chunks: topChunks,
    text: topChunks.length
      ? topChunks
          .map((chunk, index) => `${index + 1}. [${chunk.source_key || chunk.source_name || chunk.matchType}] ${chunk.title}\n${chunk.content}`)
          .join("\n\n")
      : "Không có dữ liệu phù hợp từ nguồn tri thức hiện tại.",
  }
}

export { summarizeRecentMessages }
