import express from "express"
import pool from "../db.js"
import { authenticateToken, isAdmin } from "../middleware/auth.js"

const router = express.Router()

router.get("/trends", async (req, res) => {
  try {
    const [topGainers] = await pool.query(`
      SELECT id, name, region, currentPrice, previousPrice,
      ROUND(((currentPrice - previousPrice) / NULLIF(previousPrice, 0) * 100), 1) as percent
      FROM products
      WHERE currentPrice > previousPrice
      ORDER BY percent DESC
      LIMIT 3
    `)

    const [topLosers] = await pool.query(`
      SELECT id, name, region, currentPrice, previousPrice,
      ROUND(((currentPrice - previousPrice) / NULLIF(previousPrice, 0) * 100), 1) as percent
      FROM products
      WHERE currentPrice < previousPrice
      ORDER BY percent ASC
      LIMIT 3
    `)

    res.json({ topGainers, topLosers })
  } catch (error) {
    console.error("❌ Lỗi lấy xu hướng:", error)
    res.status(500).json({ error: "Lỗi server" })
  }
})


router.get("/advanced", authenticateToken, isAdmin, async (req, res) => {
  try {
    const rangeType = req.query.range || "7d"
    let startDate = new Date()
    startDate.setHours(0,0,0,0)
    let endDate = new Date()
    endDate.setHours(23,59,59,999)

    if (rangeType === "7d") {
      startDate.setDate(startDate.getDate() - 6)
    } else if (rangeType === "month" || rangeType === "30d") {
      startDate.setDate(1)
    } else if (rangeType === "quarter" || rangeType === "90d") {
      const currentMonth = startDate.getMonth()
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3
      startDate.setMonth(quarterStartMonth, 1)
    } else if (rangeType === "year" || rangeType === "1y") {
      startDate.setMonth(0, 1)
    } else if (rangeType === "last_month") {
      startDate.setMonth(startDate.getMonth() - 1, 1)
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (rangeType === "last_quarter") {
      const currentMonth = startDate.getMonth()
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3
      startDate.setMonth(quarterStartMonth - 3, 1)
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 3, 0, 23, 59, 59, 999)
    } else if (rangeType === "last_year") {
      startDate.setFullYear(startDate.getFullYear() - 1, 0, 1)
      endDate = new Date(startDate.getFullYear(), 11, 31, 23, 59, 59, 999)
    }

    
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
    const categoryFilter = req.query.category || "";
    let keyProductsQuery = "";
    let keyProductsParams = [];
    
    if (categoryFilter && categoryFilter !== "all") {
        keyProductsQuery = `
          SELECT p.id, p.name 
          FROM products p
          JOIN categories c ON p.category_id = c.id
          WHERE c.name = ?
        `;
        keyProductsParams.push(categoryFilter);
    } else {
        keyProductsQuery = `SELECT id, name FROM products ORDER BY lastUpdate DESC LIMIT 3`;
    }

    const [keyProducts] = await pool.query(keyProductsQuery, keyProductsParams);
    
    let chartData = []
    if (keyProducts.length > 0) {
        const ids = keyProducts.map(p => p.id)
        
        const [history] = await pool.query(`
            SELECT 
                p.name, 
                DATE(ph.updated_at) as raw_date,
                MAX(ph.price) as price
            FROM price_history ph
            JOIN products p ON ph.product_id = p.id
            WHERE ph.product_id IN (?) 
            AND ph.updated_at >= ? AND ph.updated_at <= ?
            GROUP BY p.name, DATE(ph.updated_at)
            ORDER BY DATE(ph.updated_at) ASC  
        `, [ids, startDate, endDate])

        const dataMap = {}
        history.forEach(row => {
          const date = new Date(row.raw_date)
          let bucketLabel = ""
          let sortKey = 0

          if (rangeType === "7d") {
            const d = String(date.getDate()).padStart(2, '0')
            const m = String(date.getMonth() + 1).padStart(2, '0')
            bucketLabel = `${d}/${m}`
            sortKey = date.getTime()
          } else if (rangeType === "month" || rangeType === "30d" || rangeType === "last_month") {
            const d = date.getDate()
            let group = Math.min(Math.ceil(d / 5), 6)
            let start = (group - 1) * 5 + 1
            let end = group === 6 ? new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() : group * 5
            bucketLabel = `${start}-${end}/${date.getMonth()+1}`
            sortKey = group
          } else if (rangeType === "quarter" || rangeType === "90d" || rangeType === "last_quarter") {
            const weekIdx = Math.min(Math.floor((date.getDate() - 1) / 7) + 1, 4)
            bucketLabel = `Tuần ${weekIdx} T${date.getMonth() + 1}`
            sortKey = date.getMonth() * 10 + weekIdx
          } else if (rangeType === "year" || rangeType === "1y" || rangeType === "last_year") {
            const m = String(date.getMonth() + 1).padStart(2, '0')
            bucketLabel = `Tháng ${m}`
            sortKey = date.getMonth()
          }

          if (!dataMap[bucketLabel]) {
            dataMap[bucketLabel] = { date: bucketLabel, sortKey }
          }
          if (!dataMap[bucketLabel][row.name] || Number(row.price) > dataMap[bucketLabel][row.name]) {
            dataMap[bucketLabel][row.name] = Number(row.price)
          }
        })
        chartData = Object.values(dataMap).sort((a,b) => a.sortKey - b.sortKey)
        // clean up sortKey
        chartData.forEach(item => delete item.sortKey)
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