import express from "express"
import pool from "../db.js"
import { authenticateToken, isAdmin } from "../middleware/auth.js"

const router = express.Router()


router.get("/advanced", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { range = "7d" } = req.query
    let interval = 7
    if (range === "30d") interval = 30
    if (range === "90d") interval = 90
    if (range === "1y") interval = 365

    
    const [topGainers] = await pool.query(`
      SELECT id, name, region, currentPrice, previousPrice,
      ROUND(((currentPrice - previousPrice) / NULLIF(previousPrice, 0) * 100), 1) as percent
      FROM products
      WHERE currentPrice > previousPrice
      ORDER BY percent DESC
      LIMIT 3
    `)

    // 2. Top Giảm giá (Top Losers)
    const [topLosers] = await pool.query(`
      SELECT id, name, region, currentPrice, previousPrice,
      ROUND(((currentPrice - previousPrice) / NULLIF(previousPrice, 0) * 100), 1) as percent
      FROM products
      WHERE currentPrice < previousPrice
      ORDER BY percent ASC
      LIMIT 3
    `)

    // 3. Phân bổ theo Khu vực
    const [regions] = await pool.query(`
      SELECT region, COUNT(*) as count, AVG(currentPrice) as avgPrice
      FROM products
      WHERE region IS NOT NULL AND region != ''
      GROUP BY region
      ORDER BY count DESC
      LIMIT 10
    `)

    // 4. Cơ cấu Danh mục (Categories)
    const [categories] = await pool.query(`
      SELECT c.name, COUNT(p.id) as value
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id
      GROUP BY c.id, c.name
      HAVING value > 0
      ORDER BY value DESC
    `)

   // 5. Biến động giá (Price Volatility Data)
    const [keyProducts] = await pool.query(`
        SELECT id, name FROM products ORDER BY lastUpdate DESC LIMIT 3
    `)
    
    let chartData = []
    if (keyProducts.length > 0) {
        const ids = keyProducts.map(p => p.id)
        
        const [history] = await pool.query(`
            SELECT 
                p.name, 
                DATE_FORMAT(ph.updated_at, '%d/%m') as dateStr,
                MAX(ph.price) as price
            FROM price_history ph
            JOIN products p ON ph.product_id = p.id
            WHERE ph.product_id IN (?) 
            AND ph.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY p.name, DATE(ph.updated_at), dateStr
            ORDER BY DATE(ph.updated_at) ASC  
        `, [ids, interval])

        const dataMap = {}
        history.forEach(row => {
            if (!dataMap[row.dateStr]) dataMap[row.dateStr] = { date: row.dateStr }
            dataMap[row.dateStr][row.name] = Number(row.price)
        })
        chartData = Object.values(dataMap)
    }

    res.json({
      topGainers,
      topLosers,
      regionData: regions,
      categoryData: categories,
      priceVolatilityData: chartData
    })

  } catch (error) {
    console.error("❌ Lỗi thống kê nâng cao:", error)
    res.status(500).json({ error: "Lỗi server khi lấy thống kê" })
  }
})

export default router