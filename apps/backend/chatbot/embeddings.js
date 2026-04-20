const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"
let hasLoggedEmbeddingFallback = false

export function normalizeForRag(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
}

export function chunkText(text, { chunkSize = 1200, overlap = 180 } = {}) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim()
  if (!cleaned) return []

  const chunks = []
  let start = 0

  while (start < cleaned.length) {
    const end = Math.min(cleaned.length, start + chunkSize)
    const segment = cleaned.slice(start, end).trim()
    if (segment) chunks.push(segment)
    if (end >= cleaned.length) break
    start = Math.max(0, end - overlap)
  }

  return chunks
}

export function estimateTokenCount(text) {
  return Math.max(1, Math.ceil(String(text || "").split(/\s+/).filter(Boolean).length * 1.3))
}

export function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length !== vectorB.length) {
    return 0
  }

  let dot = 0
  let magnitudeA = 0
  let magnitudeB = 0

  for (let index = 0; index < vectorA.length; index += 1) {
    const a = Number(vectorA[index]) || 0
    const b = Number(vectorB[index]) || 0
    dot += a * b
    magnitudeA += a * a
    magnitudeB += b * b
  }

  if (!magnitudeA || !magnitudeB) return 0
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
}

export async function createEmbeddings(texts) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return texts.map(() => null)
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data?.error?.message || "OPENAI_EMBEDDING_ERROR")
    }

    hasLoggedEmbeddingFallback = false
    return data.data.map((item) => item.embedding)
  } catch (error) {
    if (!hasLoggedEmbeddingFallback) {
      console.warn("⚠️ Fallback về lexical-only vì không tạo được embedding:", error.message)
      hasLoggedEmbeddingFallback = true
    }
    return texts.map(() => null)
  }
}
