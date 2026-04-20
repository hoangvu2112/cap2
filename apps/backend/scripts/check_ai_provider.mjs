import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, "../.env") })

function maskKey(value) {
  const key = String(value || "")
  if (!key) return "(missing)"
  if (key.length <= 10) return "***"
  return `${key.slice(0, 6)}...${key.slice(-4)}`
}

function printHeader() {
  console.log("=== AI Provider Key Check ===")
  console.log(`GROQ_API_KEY: ${maskKey(process.env.GROQ_API_KEY)}`)
  console.log(`OPENAI_API_KEY: ${maskKey(process.env.OPENAI_API_KEY)}`)
  console.log("")
}

async function checkGroq() {
  const key = process.env.GROQ_API_KEY
  if (!key) {
    return { ok: false, provider: "groq", reason: "Missing GROQ_API_KEY" }
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
        temperature: 0,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        provider: "groq",
        reason: data?.error?.message || `HTTP ${response.status}`,
      }
    }

    return { ok: true, provider: "groq", reason: "Key works" }
  } catch (error) {
    return { ok: false, provider: "groq", reason: error.message }
  }
}

async function checkOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    return { ok: false, provider: "openai", reason: "Missing OPENAI_API_KEY" }
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
        temperature: 0,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return {
        ok: false,
        provider: "openai",
        reason: data?.error?.message || `HTTP ${response.status}`,
      }
    }

    return { ok: true, provider: "openai", reason: "Key works" }
  } catch (error) {
    return { ok: false, provider: "openai", reason: error.message }
  }
}

function printResult(result) {
  const status = result.ok ? "PASS" : "FAIL"
  console.log(`[${status}] ${result.provider}: ${result.reason}`)
}

async function run() {
  printHeader()
  const [groq, openai] = await Promise.all([checkGroq(), checkOpenAI()])
  printResult(groq)
  printResult(openai)

  const success = groq.ok || openai.ok
  console.log("")
  console.log(success ? "At least one provider is ready." : "No provider is ready. Please update .env keys.")

  process.exit(success ? 0 : 1)
}

run()