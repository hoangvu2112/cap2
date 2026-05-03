import { ingestChatbotKnowledge } from "../chatbot/ingest.js"

let isChatbotSyncing = false

export async function syncChatbotKnowledge({ reason = "scheduled", io = null } = {}) {
  if (isChatbotSyncing) {
    console.log("⚠️ Chatbot ingest đang chạy, bỏ qua lần kích hoạt mới.")
    return null
  }

  isChatbotSyncing = true
  const startedAt = Date.now()

  try {
    console.log(`🧠 Bắt đầu đồng bộ chatbot RAG (${reason})...`)
    const summary = await ingestChatbotKnowledge()
    const durationMs = Date.now() - startedAt

    console.log("🧠 Đồng bộ chatbot RAG hoàn tất:", summary)

    if (io) {
      io.emit("chatbot:knowledge_updated", {
        reason,
        summary,
        durationMs,
      })
    }

    return summary
  } catch (error) {
    console.error("❌ Lỗi đồng bộ chatbot RAG:", error)
    return null
  } finally {
    isChatbotSyncing = false
  }
}