import express from "express"
import pool from "../db.js"
import { authenticateToken, isAdmin } from "../middleware/auth.js"

const router = express.Router()
export const ioRef = { io: null }

/**
 * Phân tích dữ liệu và tạo tóm tắt
 * @param {object} product - Thông tin sản phẩm (currentPrice, trend)
 * @param {object} stats - Thống kê (high_30d, low_30d, avg_30d)
 * @param {Array} history - Lịch sử (chứa 'forecast' SMA)
 * @param {Array} news - Tin tức liên quan
 * @returns {object} - Gồm { summary: string, sentiment: string }
 */
function generateAnalysis(product, stats, history, news) {
  const analysisPoints = [];
  let sentimentScore = 0; 
  const currentPrice = Number(product.currentPrice);
  const avg_30d = Number(stats.avg_30d);
  const diff = currentPrice - avg_30d;

  // Nhận diện loại hàng để phân tích có tâm hơn
  const isSầuRiêng = product.name.toLowerCase().includes("sầu riêng");

  if (product.trend === 'up') {
    analysisPoints.push(`Xu hướng ${product.name} tại ${product.region} đang ghi nhận đà tăng trưởng tích cực.`);
    sentimentScore++;
  } else if (product.trend === 'down') {
    analysisPoints.push(`Thị trường ${product.name} đang đối mặt với áp lực giảm giá ngắn hạn.`);
    sentimentScore--;
  }

  if (avg_30d > 0) {
    if (currentPrice > avg_30d * 1.05) {
      analysisPoints.push("Mức giá hiện tại đang neo ở vùng cao so với trung bình 30 ngày qua.");
    } else if (currentPrice < avg_30d * 0.95) {
      analysisPoints.push("Giá đang điều chỉnh về vùng hỗ trợ thấp, tạo cơ hội tích lũy cho nhà đầu tư.");
    }
  }

  if (isSầuRiêng) {
    analysisPoints.push("Nhu cầu tiêu thụ nội địa và xuất khẩu đang ảnh hưởng mạnh đến biến động giá sầu riêng.");
  }

  const direction = sentimentScore >= 1 ? "up" : sentimentScore <= -1 ? "down" : "side";
  const change_amount = Math.abs(Math.round(diff * 0.08 / 100) * 100) || 1500;

  return {
    summary: analysisPoints.join(" ") || "Thị trường đang trong trạng thái cân bằng, các nhà giao dịch đang chờ đợi những tín hiệu mới từ nhu cầu xuất khẩu.",
    sentiment: sentimentScore >= 1 ? "Tích cực" : sentimentScore <= -1 ? "Tiêu cực" : "Trung tính",
    predictedPrice: direction === "up" ? currentPrice + change_amount : currentPrice - change_amount,
    confidence: 75,
    volatility: "Trung bình",
    signal: direction === "up" ? "Duy trì vị thế mua" : direction === "down" ? "Thận trọng quan sát" : "Ưu tiên tích lũy",
    direction: direction,
    change_amount: change_amount,
    recommendation: sentimentScore >= 1 ? "Mua" : sentimentScore <= -1 ? "Bán" : "Giữ"
  };
}
// --- KẾT THÚC BỘ NÃO AI (RULE-BASED FALLBACK) ---


// ===========================================
// --- 🚀 BỘ NÃO PHÂN TÍCH GỘP (BATCH ANALYSIS - TIẾT KIỆM CREDIT) ---
// ===========================================
async function generateBatchAnalysisWithGroq(productsData) {
  try {
    if (!process.env.GROQ_API_KEY) throw new Error("Chưa có GROQ_API_KEY");

    // Tạo danh sách sản phẩm cho prompt
    const productListText = productsData.map((p, i) => `
    SẢN PHẨM #${i + 1} (ID: ${p.id}):
    - Tên: ${p.name} | Vùng: ${p.region}
    - Giá hiện tại: ${p.currentPrice} đ/${p.unit}
    - Thống kê 30 ngày: Cao nhất ${p.stats.high_30d}, Thấp nhất ${p.stats.low_30d}, TB ${Math.round(p.stats.avg_30d)}
    `).join("\n");

    const prompt = `Bạn là chuyên gia phân tích thị trường nông sản chuyên nghiệp. 
Hãy phân tích danh sách ${productsData.length} sản phẩm sau đây và trả về kết quả dưới dạng MẢNG JSON.

DANH SÁCH:
${productListText}

YÊU CẦU CHO MỖI SẢN PHẨM:
1. Summary: Phân tích 3-4 câu sắc bén về xu hướng.
2. predictedPrice: Giá dự báo phiên tới.
3. signal: Nhận định kỹ thuật (10 từ).

ĐỊNH DẠNG TRẢ VỀ (CHỈ TRẢ VỀ JSON):
[
  {
    "id": <ID sản phẩm>,
    "summary": "...",
    "sentiment": "Tích cực" | "Tiêu cực" | "Trung tính",
    "predictedPrice": <số>,
    "confidence": <50-98>,
    "volatility": "Thấp" | "Trung bình" | "Cao",
    "signal": "...",
    "direction": "up" | "down" | "side",
    "change_amount": <số>,
    "recommendation": "Mua" | "Bán" | "Giữ"
  },
  ...
]`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "llama-3.3-70b-versatile",
        "messages": [{ "role": "user", "content": prompt }],
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const content = data.choices[0].message.content;
    const results = JSON.parse(content);
    
    // Nếu AI không trả về mảng trực tiếp, hãy tìm mảng trong object
    return Array.isArray(results) ? results : results.results || results.analyses || [];
  } catch (err) {
    console.error("❌ Lỗi Phân tích Gộp Groq:", err.message);
    return null;
  }
}

/**
 * Hàm điều phối cập nhật hàng loạt cho một nhóm ID sản phẩm
 */
const calculateSMA = (data, window, key = "price") => {
  return data.map((item, index, arr) => {
    if (index < window - 1) {
      return { ...item, forecast: null };
    }
    const slice = arr.slice(index - window + 1, index + 1);
    const sum = slice.reduce((acc, val) => acc + Number(val[key]), 0);
    const sma = sum / window;
    return { ...item, forecast: sma };
  });
};

async function performBatchUpdate(productIds) {
    try {
        console.log(`📦 [Batch Update] Đang chuẩn bị dữ liệu cho nhóm ${productIds.length} sản phẩm: ${productIds.join(", ")}`);
        
        const productsData = [];
        for (const id of productIds) {
            const [pRows] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
            if (pRows.length === 0) continue;
            const product = pRows[0];

            const [sRows] = await pool.query(
                "SELECT MAX(price) AS high_30d, MIN(price) AS low_30d, AVG(price) AS avg_30d FROM price_history WHERE product_id = ? AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
                [id]
            );
            const stats = sRows[0] || { high_30d: 0, low_30d: 0, avg_30d: 0 };
            
            productsData.push({ ...product, stats });
        }

        if (productsData.length === 0) return;

        // 1. Gọi AI Phân tích Gộp
        let batchResults = await generateBatchAnalysisWithGroq(productsData);

        // 2. Nếu AI lỗi, fallback về từng cái (Rule-based)
        for (const product of productsData) {
            let analysis = batchResults ? batchResults.find(r => r.id == product.id) : null;
            
            if (!analysis) {
                console.log(`💡 [Fallback] Sử dụng Rule-based cho sản phẩm #${product.id}`);
                analysis = generateAnalysis(product, product.stats, [], []);
            }

            // 3. Cơ chế "Di cư dữ liệu": Cất bản cũ vào Lịch sử trước khi lưu bản mới
            const [oldAnalysis] = await pool.query("SELECT analysis_json FROM analysis_data WHERE product_id = ?", [product.id]);
            if (oldAnalysis.length > 0) {
                // Ép kiểu JSON thành string để tránh lỗi "Column count doesn't match"
                const oldDataStr = typeof oldAnalysis[0].analysis_json === 'string' 
                    ? oldAnalysis[0].analysis_json 
                    : JSON.stringify(oldAnalysis[0].analysis_json);
                await pool.query("INSERT INTO analysis_history (product_id, analysis_json) VALUES (?, ?)", [product.id, oldDataStr]);
            }

            // 4. Lưu bản mới vào analysis_data (Upsert)
            const analysisJson = JSON.stringify(analysis);
            await pool.query(
                "INSERT INTO analysis_data (product_id, analysis_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE analysis_json = ?", 
                [product.id, analysisJson, analysisJson]
            );
            
            // Cập nhật timestamp ở bảng products
            await pool.query("UPDATE products SET analysis_at = NOW() WHERE id = ?", [product.id]);
        }
        
        console.log(`✅ [Batch Update] Hoàn thành cập nhật cho nhóm ${productIds.length} sản phẩm.`);
    } catch (err) {
        console.error("❌ Lỗi performBatchUpdate:", err.message);
    }
}

function getNewsKeywords(productName) {
  const lower = productName.toLowerCase();
  if (lower.includes("cà phê")) return "cà phê";
  if (lower.includes("lúa") || lower.includes("gạo")) return "lúa gạo";
  if (lower.includes("tiêu")) return "tiêu";
  if (lower.includes("xoài")) return "xoài";
  if (lower.includes("thanh long")) return "thanh long";
  if (lower.includes("cao su")) return "cao su";
  if (lower.includes("ca cao")) return "ca cao";
  return null;
}
// --- HẾT HÀM HELPER ---


router.get("/", async (req, res) => {
  try {
    const { search, category, region, ids, page = 1, limit = 12 } = req.query
    let baseQuery = `
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `
    const params = []
    if (ids) {
      const idList = ids.split(",").map(id => Number(id))
      baseQuery += ` AND p.id IN (${idList.map(() => "?").join(",")})`
      params.push(...idList)
    }
    if (search) {
      baseQuery += " AND p.name LIKE ?"
      params.push(`%${search}%`)
    }
    if (category) {
      baseQuery += " AND c.name = ?"
      params.push(category)
    }
    if (region) {
      baseQuery += " AND p.region = ?"
      params.push(region)
    }
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS count ${baseQuery}`,
      params
    )
    const total = countRows[0].count
    const totalPages = Math.ceil(total / limit)
    const offset = (page - 1) * limit
    baseQuery += " ORDER BY p.id DESC LIMIT ? OFFSET ?"
    params.push(Number(limit), Number(offset))
    const [rows] = await pool.query(
      `SELECT 
        p.*, 
        c.name AS category_name
       ${baseQuery}`,
      params
    )
    const products = rows.map(p => ({
      ...p,
      category: p.category_name,
      currentPrice: Number(p.currentPrice),
      previousPrice: Number(p.previousPrice),
    }))
    res.json({ page: Number(page), totalPages, data: products })
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// ===========================================
// --- 🚀 ĐÃ SỬA LỖI KÝ TỰ RÁC (SPACES) ---
// ===========================================
router.get("/all", async (req, res) => {
  try {
    // Đã xóa ký tự rác khỏi câu SQL
    const [rows] = await pool.query(`
      SELECT 
        p.*, 
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ORDER BY p.id DESC
    `)
    const products = rows.map(p => ({
      ...p,
      category: p.category_name,
      currentPrice: Number(p.currentPrice),
      previousPrice: Number(p.previousPrice),
    }))
    res.json(products)
  } catch (error) {
    console.error("❌ Lỗi khi lấy toàn bộ sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})
// ===========================================

router.get("/map-data", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        p.id, 
        p.name, 
        p.region, 
        p.currentPrice,
        c.name AS category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.region IS NOT NULL 
        AND p.region != 'Toàn quốc' 
        AND p.currentPrice > 0
    `);

    const mapData = rows.map(p => ({
      ...p,
      currentPrice: Number(p.currentPrice),
      regionKey: p.region.toLowerCase()
        .replace(/tỉnh /g, "")
        .replace(/thành phố /g, "")
        .replace(/tp. /g, "")
        .replace(/đ/g, "d")
        .replace(/ă/g, "a")
        .replace(/â/g, "a")
        .replace(/ê/g, "e")
        .replace(/ô/g, "o")
        .replace(/ơ/g, "o")
        .replace(/ư/g, "u")
        .trim()
    }));

    res.json(mapData);
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu bản đồ:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/categories", async (req, res) => {
  try {
    // Sửa lỗi: Chỉ lấy các category CÓ SẢN PHẨM
    const [rows] = await pool.query(`
      SELECT DISTINCT c.id, c.name
      FROM categories c
      INNER JOIN products p ON p.category_id = c.id
      ORDER BY c.name ASC
    `);
    res.json(rows)
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách loại:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

router.get("/categorie", async (req, res) => {
  try {
    // Sửa lỗi: Chỉ lấy các category CÓ SẢN PHẨM
    const [rows] = await pool.query(`
      SELECT DISTINCT c.id, c.name
      FROM categories c
    `);
    res.json(rows)
  } catch (error) {
    console.error("❌ Lỗi khi lấy danh sách loại:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// Thêm loại sản phẩm mới (chỉ admin)
router.post("/categories", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name } = req.body
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Tên loại sản phẩm không được để trống" })
    }
    const [exists] = await pool.query("SELECT id FROM categories WHERE name = ?", [name.trim()])
    if (exists.length > 0) {
      return res.status(400).json({ error: `Loại sản phẩm '${name}' đã tồn tại` })
    }
    const [result] = await pool.query(
      "INSERT INTO categories (name) VALUES (?)",
      [name.trim()]
    )
    const [newCat] = await pool.query(
      "SELECT id, name, created_at FROM categories WHERE id = ?",
      [result.insertId]
    )
    res.status(201).json({
      message: "✅ Đã tạo loại sản phẩm mới thành công",
      category: newCat[0],
    })
  } catch (error) {
    console.error("❌ Lỗi khi tạo loại sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// Cập nhật loại sản phẩm (chỉ admin)
router.put("/categories/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name } = req.body
    const { id } = req.params
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Tên loại sản phẩm không được để trống" })
    }
    const [exists] = await pool.query("SELECT id FROM categories WHERE id = ?", [id])
    if (exists.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy loại sản phẩm" })
    }
    const [dup] = await pool.query(
      "SELECT id FROM categories WHERE name = ? AND id != ?",
      [name.trim(), id]
    )
    if (dup.length > 0) {
      return res.status(400).json({ error: `Tên loại '${name}' đã tồn tại` })
    }
    await pool.query("UPDATE categories SET name = ? WHERE id = ?", [name.trim(), id])
    const [updated] = await pool.query("SELECT id, name, created_at FROM categories WHERE id = ?", [id])
    res.json({
      message: "✅ Đã cập nhật loại sản phẩm thành công",
      category: updated[0],
    })
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật loại sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// Xóa loại sản phẩm (chỉ admin)
router.delete("/categories/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const [exists] = await pool.query("SELECT * FROM categories WHERE id = ?", [id])
    if (exists.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy loại sản phẩm" })
    }
    const [related] = await pool.query("SELECT COUNT(*) AS c FROM products WHERE category_id = ?", [id])
    if (related[0].c > 0) {
      return res.status(400).json({
        error: "Không thể xóa loại vì vẫn còn sản phẩm thuộc loại này. Hãy xóa hoặc chuyển sản phẩm trước.",
      })
    }
    await pool.query("DELETE FROM categories WHERE id = ?", [id])
    res.json({
      message: "🗑️ Đã xóa loại sản phẩm thành công",
      deleted: exists[0],
    })
  } catch (error) {
    console.error("❌ Lỗi khi xóa loại sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.get("/ticker", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, name, currentPrice, previousPrice, trend 
       FROM products 
       ORDER BY lastUpdate DESC 
       LIMIT 10`
    )
    const data = rows.map(p => {
      const current = Number(p.currentPrice)
      const previous = Number(p.previousPrice)
      const change = previous ? ((current - previous) / previous) * 100 : 0
      return {
        id: p.id,
        name: p.name,
        price: current,
        change: Number(change.toFixed(1)),
        trend: current > previous ? "up" : current < previous ? "down" : "stable",
      }
    })
    res.json(data)
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu ticker:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// ===========================================
// --- 🚀 ROUTE GET /:id (ĐÃ NÂNG CẤP AI) ---
// ===========================================
router.get("/:id", async (req, res) => {
  try {
    const range = req.query.range || "30d"
    const productId = req.params.id

    // 1. Lấy thông tin sản phẩm
    const productPromise = pool.query(
      `
      SELECT 
        p.*, 
        c.name AS category_name,
        ad.analysis_json AS analysis_data
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN analysis_data ad ON p.id = ad.product_id
      WHERE p.id = ?
      `,
      [productId]
    )

    // 2. Lấy lịch sử giá cho BIỂU ĐỒ
    let historyQuery = ""
    const params = [productId]
    let interval = 30
    if (range === "1d") {
      historyQuery = `
        SELECT price, updated_at AS date
        FROM price_history
        WHERE product_id = ?
          AND updated_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
        ORDER BY updated_at ASC
      `
    } else {
      if (range === "7d") interval = 7
      if (range === "30d") interval = 30
      if (range === "6m") interval = 180
      if (range === "1y") interval = 365

      historyQuery = `
        SELECT DATE(updated_at) AS date, MAX(price) AS price
        FROM price_history
        WHERE product_id = ?
          AND updated_at >= DATE_SUB(NOW(), INTERVAL ${interval} DAY)
        GROUP BY DATE(updated_at)
        ORDER BY date ASC
      `
    }
    const historyPromise = pool.query(historyQuery, params)

    // 3. Lấy THỐNG KÊ 30 NGÀY
    const statsPromise = pool.query(
      `
      SELECT 
        MAX(price) AS high_30d,
        MIN(price) AS low_30d,
        AVG(price) AS avg_30d
      FROM price_history
      WHERE product_id = ? 
        AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `,
      [productId]
    );

    // Chạy 3 truy vấn song song
    const [[products], [historyRows], [statsRows]] = await Promise.all([
      productPromise,
      historyPromise,
      statsPromise
    ]);

    if (products.length === 0)
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" })

    // 4. Xử lý dữ liệu
    const history = historyRows.map(h => ({ ...h, price: Number(h.price) }))
    const historyWithForecast = calculateSMA(history, 7, "price");

    const product = {
      ...products[0],
      category: products[0].category_name,
      currentPrice: Number(products[0].currentPrice),
      previousPrice: Number(products[0].previousPrice),
      analysis_data: products[0].analysis_data ? (typeof products[0].analysis_data === 'string' ? JSON.parse(products[0].analysis_data) : products[0].analysis_data) : null,
      analysis_at: products[0].analysis_at
    }

    // 5. Lấy Tin tức
    // const productName = products[0].name;
    // const keyword = getNewsKeywords(productName);
    // let newsRows = [];
    // if (keyword) {
    //   const [fetchedNews] = await pool.query(
    //     `SELECT id, title, url, source, published_at, snippet
    //      FROM news_articles
    //      WHERE relevance_keywords LIKE ?
    //      ORDER BY published_at DESC
    //      LIMIT 5`,
    //     [`%${keyword}%`]
    //   );
    //   newsRows = fetchedNews;
    // }
    let newsRows = []; // ✅ Thêm dòng này
    const stats = statsRows[0] || { high_30d: 0, low_30d: 0, avg_30d: 0 };
    const percentChange = product.previousPrice > 0
      ? ((product.currentPrice - product.previousPrice) / product.previousPrice * 100).toFixed(2)
      : 0;

    // 7. Gộp kết quả (KHÔNG CÒN GỌI AI TRỰC TIẾP)
    res.json({
      ...product,
      history: historyWithForecast,
      statistics: {
        high_30d: Number(stats.high_30d) || 0,
        low_30d: Number(stats.low_30d) || 0,
        avg_30d: Number(stats.avg_30d) || 0,
      },
      relevantNews: newsRows,
      percentChange: Number(percentChange) 
    })
  } catch (error) {
    console.error("❌ Lỗi khi lấy chi tiết sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// ===========================================
// --- 🚀 API HIỂN THỊ: CHẾ ĐỘ DB-CENTRIC (Tốc độ tối đa) ---
// ===========================================
router.get("/:id/analysis", async (req, res) => {
  try {
    const productId = req.params.id;

    // Chỉ thực hiện truy vấn bảng phân tích chuyên biệt
    const [rows] = await pool.query(
      `SELECT ad.analysis_json AS analysis_data, p.analysis_at 
       FROM analysis_data ad
       JOIN products p ON ad.product_id = p.id
       WHERE ad.product_id = ?`,
      [productId]
    );

    if (rows.length === 0 || !rows[0].analysis_data) {
      return res.status(200).json({ 
        summary: "Đang phân tích dữ liệu thị trường...", 
        status: "pending" 
      });
    }

    // Trả về dữ liệu từ DB (Nhanh, ổn định)
    res.json(rows[0].analysis_data);

  } catch (error) {
    console.error("❌ Lỗi truy vấn phân tích từ DB:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi lấy dữ liệu" });
  }
});

/**
 * 🔄 HỆ THỐNG TỰ ĐỘNG HÓA AI (AGENTIC AUTOMATION)
 */

// 1. Hàm làm mới sản phẩm theo chế độ "NHỎ GIỌT" (Chạy mỗi 1 phút - Cực kỳ tiết kiệm và ổn định)
async function refreshAllProductsAnalysis() {
    console.log("🕒 [Automation] Đang kiểm tra sản phẩm cũ nhất để cập nhật (Drip Mode)...");
    try {
        // Tìm 1 sản phẩm có thời gian phân tích cũ nhất (hoặc chưa bao giờ phân tích)
        const [products] = await pool.query(
            "SELECT id, name FROM products ORDER BY analysis_at ASC LIMIT 1"
        );
        
        if (products.length === 0) return;

        const product = products[0];
        console.log(`📡 [Drip Update] Đang ưu tiên cập nhật cho: ${product.name} (#${product.id})`);
        
        // Thực hiện cập nhật phân tích (sử dụng BatchUpdate cho 1 cái để tận dụng logic Groq đã viết)
        await performBatchUpdate([product.id]);
        
    } catch (err) {
        console.error("❌ [Automation] Lỗi khi chạy cập nhật nhỏ giọt:", err.message);
    }
}

// 2. Hàm dọn dẹp dữ liệu cũ (Xóa sau 1 tuần)
async function cleanupOldAnalysisHistory() {
    console.log("🧹 [Automation] Đang quét dọn lịch sử phân tích cũ (> 1 tuần)...");
    try {
        const [result] = await pool.query(
            "DELETE FROM analysis_history WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
        );
        console.log(`🗑️ [Automation] Đã xóa ${result.affectedRows} bản ghi cũ.`);
    } catch (err) {
        console.error("❌ [Automation] Lỗi dọn dẹp lịch sử:", err.message);
    }
}

// 🚀 THIẾT LẬP BỘ HẸN GIỜ (CRON-LIKE)
const ONE_MINUTE = 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// Khởi chạy ngay khi server start (đợi 5s cho DB kết nối ổn định)
setTimeout(() => {
    refreshAllProductsAnalysis(); // Chạy ngay lần đầu
    cleanupOldAnalysisHistory();
    
    // Đặt lịch định kỳ: Cập nhật nhỏ giọt mỗi phút
    setInterval(refreshAllProductsAnalysis, ONE_MINUTE);
    setInterval(cleanupOldAnalysisHistory, TWENTY_FOUR_HOURS);
}, 5000);
;

// Tạo sản phẩm mới (Admin)
router.post("/", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, category, currentPrice, unit, region } = req.body
    if (!name || !category || !currentPrice || !unit || !region) {
      return res.status(400).json({ error: "Thiếu thông tin sản phẩm" })
    }
    const [catRows] = await pool.query("SELECT id FROM categories WHERE name = ?", [category])
    if (catRows.length === 0) {
      return res.status(400).json({ error: `Loại sản phẩm '${category}' không tồn tại` })
    }
    const category_id = catRows[0].id
    const [result] = await pool.query(
      `INSERT INTO products (name, category_id, currentPrice, previousPrice, unit, region, lastUpdate, trend)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), 'stable')`,
      [name, category_id, currentPrice, currentPrice, unit, region]
    )
    const [newProduct] = await pool.query(
      `
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ?
      `,
      [result.insertId]
    )
    const product = {
      ...newProduct[0],
      category: newProduct[0].category_name,
      currentPrice: Number(newProduct[0].currentPrice),
      previousPrice: Number(newProduct[0].previousPrice),
    }
    await pool.query("INSERT INTO price_history (product_id, price) VALUES (?, ?)", [
      result.insertId,
      currentPrice,
    ])
    if (ioRef.io) ioRef.io.emit("productAdded", product)
    res.status(201).json(product)
  } catch (error) {
    console.error("❌ Lỗi khi thêm sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// Cập nhật sản phẩm
router.put("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { name, category, currentPrice, unit, region } = req.body
    if (!name || !category || !currentPrice || !unit || !region) {
      return res.status(400).json({ error: "Thiếu thông tin sản phẩm" })
    }
    const [existing] = await pool.query("SELECT * FROM products WHERE id = ?", [req.params.id])
    if (existing.length === 0) return res.status(404).json({ error: "Không tìm thấy sản phẩm" })
    const old = existing[0]
    const trend =
      currentPrice > old.currentPrice ? "up" :
        currentPrice < old.currentPrice ? "down" : "stable"
    const [catRows] = await pool.query("SELECT id FROM categories WHERE name = ?", [category])
    if (catRows.length === 0) {
      return res.status(400).json({ error: "Loại sản phẩm không hợp lệ" })
    }
    const category_id = catRows[0].id
    await pool.query(
      `UPDATE products
       SET name=?, category_id=?, currentPrice=?, previousPrice=?, unit=?, region=?, trend=?, lastUpdate=NOW()
       WHERE id=?`,
      [name, category_id, currentPrice, old.currentPrice, unit, region, trend, req.params.id]
    )
    await pool.query("INSERT INTO price_history (product_id, price) VALUES (?, ?)", [
      req.params.id,
      currentPrice,
    ])
    const [updated] = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [req.params.id]
    )
    const product = {
      ...updated[0],
      category: updated[0].category_name,
      currentPrice: Number(updated[0].currentPrice),
      previousPrice: Number(updated[0].previousPrice),
    }
    if (ioRef.io) {
      ioRef.io.emit("productUpdated", product)
      ioRef.io.emit("priceUpdate", {
        id: product.id,
        newPrice: product.currentPrice,
        previousPrice: product.previousPrice,
      })
    }
    res.json(product)
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

// Xóa sản phẩm
router.delete("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const productId = req.params.id
    const [exists] = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ?`,
      [productId]
    )
    if (exists.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy sản phẩm" })
    }
    await pool.query("DELETE FROM products WHERE id = ?", [productId])
    if (ioRef.io) ioRef.io.emit("productDeleted", { id: Number(productId) })
    res.json({
      message: "Đã xóa sản phẩm thành công",
      deleted: {
        ...exists[0],
        category: exists[0].category_name,
        currentPrice: Number(exists[0].currentPrice),
        previousPrice: Number(exists[0].previousPrice),
      },
    })
  } catch (error) {
    console.error("❌ Lỗi khi xóa sản phẩm:", error)
    res.status(500).json({ error: "Lỗi máy chủ" })
  }
})

router.post("/compare", async (req, res) => {
  try {
    const { productIds, range = "30d" } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào (Tránh lỗi sập server)
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.json([]); // Trả về mảng rỗng nếu không có ID nào
    }

    console.log(`📊 Đang so sánh các ID: ${productIds} trong ${range}`);

    // 2. Lấy tên sản phẩm để làm Key cho biểu đồ
    const [products] = await pool.query(
      `SELECT id, name FROM products WHERE id IN (?)`,
      [productIds]
    );
    
    if (products.length === 0) return res.json([]);

    // Tạo Map để tra cứu nhanh: ID -> Tên
    const nameMap = new Map(products.map(p => [p.id, p.name]));

    // 3. Xác định khoảng thời gian truy vấn
    let interval = 30;
    if (range === "7d") interval = 7;
    if (range === "6m") interval = 180;
    if (range === "1y") interval = 365;

    // 4. Lấy lịch sử giá từ DB
    // GROUP BY DATE(updated_at) để lấy giá chốt mỗi ngày (tránh bị trùng nhiều giá trong 1 ngày)
    const [historyRows] = await pool.query(
      `
      SELECT 
        product_id, 
        DATE(updated_at) AS dateStr, 
        MAX(price) AS price
      FROM price_history
      WHERE product_id IN (?)
        AND updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY product_id, DATE(updated_at)
      ORDER BY dateStr ASC
      `,
      [productIds, interval]
    );

    // 5. Thuật toán "Chuẩn hóa Tăng trưởng" (Normalization)
    // Mục tiêu: Đưa tất cả về mốc 0% tại ngày đầu tiên xuất hiện để so sánh tốc độ tăng.
    
    const basePriceMap = new Map(); // Lưu giá gốc (giá ngày đầu tiên) của từng sản phẩm
    const normalizedDataMap = new Map(); // Lưu dữ liệu đã tính toán theo ngày

    // Bước 5a: Tìm giá gốc cho từng sản phẩm
    for (const id of productIds) {
      // Tìm bản ghi đầu tiên của sản phẩm này trong lịch sử lấy được
      const firstEntry = historyRows.find(h => h.product_id === id);
      if (firstEntry) {
        basePriceMap.set(id, Number(firstEntry.price));
      }
    }

    // Bước 5b: Duyệt qua lịch sử và tính % chênh lệch
    historyRows.forEach(row => {
      // Format ngày tháng cho đẹp (dd/mm)
      const dateObj = new Date(row.dateStr);
      const dateKey = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;

      // Khởi tạo object cho ngày này nếu chưa có
      if (!normalizedDataMap.has(dateKey)) {
        normalizedDataMap.set(dateKey, { date: dateKey });
      }

      const basePrice = basePriceMap.get(row.product_id);
      const productName = nameMap.get(row.product_id);

      // Chỉ tính nếu có giá gốc và giá hiện tại hợp lệ
      if (basePrice && productName && basePrice > 0) {
        const currentPrice = Number(row.price);
        
        // CÔNG THỨC: (Giá hiện tại / Giá gốc) * 100
        // Ví dụ: Gốc 100k, Nay 120k -> 120% (Tức là còn giữ 100% gốc + tăng 20%)
        // Frontend đang vẽ mốc 100%, nên ta dùng công thức này.
        const normalizedValue = (currentPrice / basePrice) * 100;

        // Gán vào object: { date: "25/11", "Cà phê": 120.5, "Tiêu": 98.2 }
        normalizedDataMap.get(dateKey)[productName] = Number(normalizedValue.toFixed(2));
      }
    });

    // 6. Chuyển Map thành Array để trả về cho Recharts
    const finalChartData = Array.from(normalizedDataMap.values());
    
    // Sort lại lần cuối để đảm bảo ngày tháng tăng dần (phòng trường hợp Map bị lộn xộn)
    finalChartData.sort((a, b) => {
        const [d1, m1] = a.date.split("/").map(Number);
        const [d2, m2] = b.date.split("/").map(Number);
        return m1 - m2 || d1 - d2; // So tháng trước, rồi so ngày
    });

    res.json(finalChartData);

  } catch (error) {
    console.error("❌ Lỗi API Compare:", error);
    // Trả về lỗi 500 nhưng kèm message rõ ràng để debug
    res.status(500).json({ error: "Lỗi máy chủ khi xử lý so sánh", details: error.message });
  }
});

// ... (các route khác giữ nguyên)

export default router