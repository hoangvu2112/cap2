import pool from "../db.js"

function toYmd(date) {
  return date.toISOString().slice(0, 10)
}

function addDays(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

async function run() {
  const [farmers] = await pool.query(
    "SELECT id FROM users WHERE role = 'user' AND status = 'active' ORDER BY id ASC"
  )

  if (!farmers.length) {
    console.log("Khong co tai khoan nong dan active de gan source info")
    return
  }

  const [products] = await pool.query(
    "SELECT id, name, category_id, region FROM products ORDER BY id ASC"
  )

  if (!products.length) {
    console.log("Khong co san pham de seed")
    return
  }

  const baseDate = new Date()
  const updates = []

  for (let i = 0; i < products.length; i += 1) {
    const p = products[i]
    const farmerId = farmers[i % farmers.length].id

    // Quantity pattern 800kg -> 5000kg to make UI clearly visible
    const quantity = 800 + ((p.id * 173) % 4200)

    // Spread harvest windows in near future for realistic testing
    const startOffset = (p.id * 5) % 40
    const duration = 20 + ((p.id * 7) % 35)
    const harvestStart = toYmd(addDays(baseDate, startOffset))
    const harvestEnd = toYmd(addDays(baseDate, startOffset + duration))

    updates.push([
      quantity,
      harvestStart,
      harvestEnd,
      farmerId,
      p.id,
    ])
  }

  for (const row of updates) {
    await pool.query(
      `
      UPDATE products
      SET
        quantity_available = ?,
        harvest_start = ?,
        harvest_end = ?,
        farmer_user_id = ?
      WHERE id = ?
      `,
      row
    )
  }

  console.log(`Da cap nhat source info cho ${updates.length} san pham`)
}

run()
  .catch((error) => {
    console.error("Seed source info loi:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    try {
      await pool.end()
    } catch {
      // ignore
    }
  })
