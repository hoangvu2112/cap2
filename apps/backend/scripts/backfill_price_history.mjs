import pool from "../db.js"

const DAYS = Number(process.argv[2] || 365)
const MAX_VARIATION_RATIO = 0.08

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function toSqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ")
}

async function backfill() {
  if (!Number.isFinite(DAYS) || DAYS < 30) {
    throw new Error("Số ngày backfill phải >= 30")
  }

  const [products] = await pool.query("SELECT id, currentPrice FROM products")

  if (!products.length) {
    console.log("Không có sản phẩm nào để backfill")
    return
  }

  const now = new Date()

  for (const product of products) {
    const productId = Number(product.id)
    const currentPrice = Number(product.currentPrice || 0)
    if (!currentPrice) continue

    const [existingRows] = await pool.query(
      "SELECT DATE(updated_at) AS d FROM price_history WHERE product_id = ?",
      [productId]
    )

    const existingDates = new Set(
      existingRows.map((row) => {
        const date = new Date(row.d)
        return date.toISOString().slice(0, 10)
      })
    )

    const inserts = []

    for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
      const date = new Date(now)
      date.setDate(now.getDate() - offset)
      const dateKey = date.toISOString().slice(0, 10)
      if (existingDates.has(dateKey)) continue

      const wave = Math.sin((offset / DAYS) * Math.PI * 4)
      const noise = (Math.random() - 0.5) * 0.04
      const variation = clamp(wave * MAX_VARIATION_RATIO + noise, -MAX_VARIATION_RATIO, MAX_VARIATION_RATIO)
      const generatedPrice = Math.max(500, Math.round(currentPrice * (1 - variation)))

      date.setHours(8, 0, 0, 0)
      inserts.push([productId, generatedPrice, toSqlDate(date)])
    }

    if (inserts.length > 0) {
      await pool.query(
        "INSERT INTO price_history (product_id, price, updated_at) VALUES ?",
        [inserts]
      )
      console.log(`Product #${productId}: inserted ${inserts.length} rows`)
    } else {
      console.log(`Product #${productId}: no missing dates`)
    }
  }

  console.log(`Backfill hoàn tất cho ${DAYS} ngày`) 
}

backfill()
  .catch((error) => {
    console.error("Backfill lỗi:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await pool.end()
    } catch {
      // ignore close error
    }
  })
