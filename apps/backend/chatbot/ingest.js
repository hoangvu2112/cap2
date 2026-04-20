import crypto from "crypto"
import pool from "../db.js"
import { chatbotSourceAdapters } from "./sources/index.js"
import { chunkText, createEmbeddings, estimateTokenCount, normalizeForRag } from "./embeddings.js"

function sha256(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex")
}

async function upsertSource(adapter) {
  const [result] = await pool.query(
    `
      INSERT INTO chatbot_sources (source_key, name, source_type, source_url, role_scope, enabled)
      VALUES (?, ?, ?, ?, ?, TRUE)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        source_type = VALUES(source_type),
        source_url = VALUES(source_url),
        role_scope = VALUES(role_scope),
        enabled = TRUE,
        updated_at = CURRENT_TIMESTAMP
    `,
    [adapter.sourceKey, adapter.name, adapter.sourceType, adapter.sourceUrl || null, adapter.roleScope || "shared"]
  )

  const [rows] = await pool.query("SELECT id FROM chatbot_sources WHERE source_key = ?", [adapter.sourceKey])
  return rows[0]?.id || result.insertId
}

async function upsertDocument(sourceId, doc) {
  const contentHash = sha256(doc.content)
  const [existingRows] = await pool.query(
    `SELECT id, content_hash FROM chatbot_documents WHERE source_id = ? AND external_id = ? LIMIT 1`,
    [sourceId, doc.externalId]
  )

  if (existingRows.length > 0 && existingRows[0].content_hash === contentHash) {
    return { id: existingRows[0].id, changed: false }
  }

  if (existingRows.length > 0) {
    await pool.query(
      `
        UPDATE chatbot_documents
        SET title = ?, source_url = ?, role_scope = ?, content_hash = ?, content = ?, metadata_json = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        doc.title,
        doc.sourceUrl || null,
        doc.roleScope || "shared",
        contentHash,
        doc.content,
        JSON.stringify(doc.metadata || {}),
        doc.publishedAt || null,
        existingRows[0].id,
      ]
    )
    return { id: existingRows[0].id, changed: true }
  }

  const [result] = await pool.query(
    `
      INSERT INTO chatbot_documents
        (source_id, external_id, title, source_url, role_scope, content_hash, content, metadata_json, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      sourceId,
      doc.externalId,
      doc.title,
      doc.sourceUrl || null,
      doc.roleScope || "shared",
      contentHash,
      doc.content,
      JSON.stringify(doc.metadata || {}),
      doc.publishedAt || null,
    ]
  )

  return { id: result.insertId, changed: true }
}

async function replaceDocumentChunks(documentId, roleScope, content, metadata) {
  const chunks = chunkText(content, { chunkSize: 1200, overlap: 180 })
  await pool.query("DELETE FROM chatbot_chunks WHERE document_id = ?", [documentId])

  if (chunks.length === 0) return 0

  const embeddings = await createEmbeddings(chunks)
  const rows = chunks.map((chunk, index) => ({
    documentId,
    chunkIndex: index,
    roleScope: roleScope || "shared",
    content: chunk,
    embeddingJson: embeddings[index] ? JSON.stringify(embeddings[index]) : null,
    tokenCount: estimateTokenCount(chunk),
    metadataJson: JSON.stringify({
      ...(metadata || {}),
      chunkIndex: index,
      chunkNormalized: normalizeForRag(chunk),
    }),
  }))

  for (const row of rows) {
    await pool.query(
      `
        INSERT INTO chatbot_chunks
          (document_id, chunk_index, role_scope, content, embedding_json, token_count, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [row.documentId, row.chunkIndex, row.roleScope, row.content, row.embeddingJson, row.tokenCount, row.metadataJson]
    )
  }

  return rows.length
}

export async function ingestChatbotKnowledge() {
  const ingestionSummary = []

  for (const adapter of chatbotSourceAdapters) {
    const sourceId = await upsertSource(adapter)
    const documents = await adapter.collectDocuments()
    let processed = 0
    let chunksInserted = 0

    for (const doc of documents) {
      if (!doc?.content?.trim()) continue
      const documentRow = await upsertDocument(sourceId, doc)
      if (!documentRow.changed) continue
      const inserted = await replaceDocumentChunks(documentRow.id, doc.roleScope || adapter.roleScope || "shared", doc.content, doc.metadata)
      processed += 1
      chunksInserted += inserted
    }

    await pool.query("UPDATE chatbot_sources SET last_crawled_at = NOW() WHERE id = ?", [sourceId])
    ingestionSummary.push({ sourceKey: adapter.sourceKey, documents: processed, chunks: chunksInserted })
  }

  return ingestionSummary
}
