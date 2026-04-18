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
function generateUniqueAnalysis(product, stats, history, news) {
  const analysisPoints = [];
  let sentimentScore = 0;
  const currentPrice = Number(product.currentPrice) || 0;
  const previousPrice = Number(product.previousPrice) || currentPrice;
  const avg30d = Number(stats.avg_30d) || currentPrice;
  const high30d = Number(stats.high_30d) || currentPrice;
  const low30d = Number(stats.low_30d) || currentPrice;
  const intradayChangePct = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
  const gapVsAvgPct = avg30d > 0 ? ((currentPrice - avg30d) / avg30d) * 100 : 0;
  const rangeWidth = Math.max(high30d - low30d, 1);
  const positionInRange = (currentPrice - low30d) / rangeWidth;
  const nameLower = product.name.toLowerCase();

  if (product.trend === "up") {
    analysisPoints.push(`Giá ${product.name} tại ${product.region} đang giữ nhịp tăng, cho thấy lực mua ngắn hạn vẫn nghiêng về phía chủ động.`);
    sentimentScore += 1;
  } else if (product.trend === "down") {
    analysisPoints.push(`Giá ${product.name} tại ${product.region} đang điều chỉnh giảm, phản ánh tâm lý giao dịch thận trọng hơn trong ngắn hạn.`);
    sentimentScore -= 1;
  } else {
    analysisPoints.push(`Giá ${product.name} tại ${product.region} đang đi ngang, cho thấy cung cầu tạm thời ở trạng thái cân bằng.`);
  }

  if (positionInRange >= 0.8) {
    analysisPoints.push(`Mức giá hiện tại đang áp sát vùng đỉnh 30 ngày (${high30d.toLocaleString("vi-VN")}đ), nên dư địa tăng thêm có nhưng vùng rủi ro cũng bắt đầu rõ hơn.`);
    sentimentScore += 1;
  } else if (positionInRange <= 0.2) {
    analysisPoints.push(`Giá hiện nằm gần vùng đáy 30 ngày (${low30d.toLocaleString("vi-VN")}đ), phù hợp hơn với góc nhìn chờ xác nhận nền giá thay vì mua đuổi.`);
    sentimentScore -= 1;
  } else {
    analysisPoints.push(`Giá vẫn đang ở giữa biên độ 30 ngày, cho thấy thị trường chưa rơi vào trạng thái quá nóng hoặc quá suy yếu.`);
  }

  if (gapVsAvgPct >= 6) {
    analysisPoints.push(`So với mức trung bình 30 ngày (${Math.round(avg30d).toLocaleString("vi-VN")}đ), giá hiện cao hơn khoảng ${gapVsAvgPct.toFixed(1)}%, thể hiện mặt bằng premium ngắn hạn.`);
    sentimentScore += 1;
  } else if (gapVsAvgPct <= -6) {
    analysisPoints.push(`Giá hiện thấp hơn trung bình 30 ngày khoảng ${Math.abs(gapVsAvgPct).toFixed(1)}%, cho thấy thị trường vẫn đang giao dịch dưới vùng cân bằng quen thuộc.`);
    sentimentScore -= 1;
  } else {
    analysisPoints.push(`Khoảng cách với giá trung bình 30 ngày chưa lớn, nên áp lực lệch pha hiện chưa thật sự cực đoan.`);
  }

  if (Math.abs(intradayChangePct) >= 2.5) {
    analysisPoints.push(`Biến động so với phiên trước đạt ${intradayChangePct > 0 ? "+" : ""}${intradayChangePct.toFixed(2)}%, xác nhận nhịp giao dịch trong ngày tương đối mạnh.`);
  } else {
    analysisPoints.push(`Biến động ngày chỉ quanh ${intradayChangePct > 0 ? "+" : ""}${intradayChangePct.toFixed(2)}%, nên xu hướng hiện tại đang dịch chuyển khá chậm và chọn lọc.`);
  }

  if (nameLower.includes("sầu riêng")) {
    analysisPoints.push(`Mặt hàng ${product.name} đang chịu tác động từ nhịp độ thu hoạch và sức mua xuất khẩu tại ${product.region}.`);
  } else if (nameLower.includes("cà phê")) {
    analysisPoints.push(`Thị trường cà phê ${product.name} phản ứng với các tín hiệu từ sàn giao dịch và tâm lý chốt lời của đại lý.`);
  } else {
    analysisPoints.push(`Xu hướng giá của ${product.name} phụ thuộc vào cung cầu thực tế và biến động chi phí vận chuyển tại khu vực.`);
  }

  const direction = sentimentScore >= 2 ? "up" : sentimentScore <= -2 ? "down" : "side";
  const change_amount = Math.max(Math.round(Math.abs(currentPrice - avg30d) * 0.12 / 100) * 100, 1000);
  const volatility = rangeWidth / Math.max(avg30d, 1) > 0.15 ? "Cao" : rangeWidth / Math.max(avg30d, 1) > 0.07 ? "Trung bình" : "Thấp";

  return {
    summary: analysisPoints.join(" "),
    sentiment: sentimentScore >= 1 ? "Tích cực" : sentimentScore <= -1 ? "Tiêu cực" : "Trung tính",
    predictedPrice: direction === "up" ? currentPrice + change_amount : direction === "down" ? Math.max(currentPrice - change_amount, 0) : currentPrice,
    confidence: volatility === "Cao" ? 68 : volatility === "Trung bình" ? 76 : 84,
    volatility,
    signal: direction === "up" ? "Canh giữ vị thế mạnh" : direction === "down" ? "Ưu tiên chờ cân bằng" : "Theo dõi thêm tín hiệu",
    direction,
    change_amount,
    recommendation: sentimentScore >= 2 ? "Mua" : sentimentScore <= -2 ? "Bán" : "Giữ"
  };
}

function getPromptForProduct(p) {
  const name = p.name, region = p.region || "", stats = p.stats;
  const nameLower = name.toLowerCase(), regionLower = region.toLowerCase();
  const info = `Sản phẩm: ${name}, Vùng: ${region}, Giá: ${p.currentPrice}đ/${p.unit}, 30 ngày: Cao ${stats.high_30d}, Thấp ${stats.low_30d}, TB ${Math.round(stats.avg_30d)}`;

  let role = `chuyên gia phân tích thị trường ${name} tại ${region}`, req = `Phân tích xu hướng giá và cung cầu tại ${region}.`;

  if (nameLower.includes("cà phê")) {
    req = `Phân tích giá ${name}, so sánh mặt bằng chung và dự báo ngắn hạn.`;
    if (nameLower.includes("đắk lắk") || regionLower.includes("đắk lắk")) 
      req = `Tập trung biến động Đắk Lắk, tình hình thu mua kho lớn và thời tiết Tây Nguyên.`;
    else if (nameLower.includes("lâm đồng") || regionLower.includes("lâm đồng")) 
      req = `Chú ý chất lượng hạt, nhu cầu rang xay và xuất khẩu đặc thù Lâm Đồng.`;
  } else if (nameLower.includes("sầu riêng")) {
    req = `Sức mua xuất khẩu, tiến độ đóng hàng vựa và biến động theo size (A, B, C).`;
    if (nameLower.includes("ri6")) req = `Thị hiếu Trung Quốc với Ri6, độ chín vụ và giá thu mua tại vườn.`;
  } else if (nameLower.includes("lúa") || nameLower.includes("gạo")) {
    req = `Chú ý hợp đồng xuất khẩu gạo, an ninh lương thực và giá lúa tươi tại ruộng.`;
  }

  return `Bạn là ${role}. Dữ liệu: ${info}. YÊU CẦU: ${req}. LƯU Ý: KHÔNG sử dụng các câu văn mẫu lặp đi lặp lại, hãy phân tích thực tế và khác biệt cho từng loại mặt hàng.`;
}

// Hàm bổ sung cho phần định dạng JSON
const getJsonFormatRequirement = (productId) => `
YÊU CẦU TRẢ VỀ: TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON VỚI CẤU TRÚC SAU:
{
  "id": ${productId},
  "summary": "...",
  "sentiment": "Tích cực" | "Tiêu cực" | "Trung tính",
  "predictedPrice": <số>,
  "confidence": <50-98>,
  "volatility": "Thấp" | "Trung bình" | "Cao",
  "signal": "...",
  "direction": "up" | "down" | "side",
  "change_amount": <số>,
  "recommendation": "Mua" | "Bán" | "Giữ"
}`;

/**
 * 🚀 PHÂN TÍCH ĐƠN LẺ (SINGLE ANALYSIS) - GIÚP NỘI DUNG ĐA DẠNG
 */
async function generateSingleProductAnalysisWithGroq(product) {
  try {
    if (!process.env.GROQ_API_KEY) throw new Error("Chưa có GROQ_API_KEY");

    const promptBase = getPromptForProduct(product);
    const jsonFormat = getJsonFormatRequirement(product.id);
    const fullPrompt = `${promptBase}\n\n${jsonFormat}`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "llama-3.1-8b-instant",
        "messages": [{ "role": "user", "content": fullPrompt }],
        "response_format": { "type": "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (err) {
    console.error(`❌ Lỗi Phân tích Groq cho sản phẩm #${product.id}:`, err.message);
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

async function rebuildAnalysisForProduct(productId) {
  const [productRows] = await pool.query("SELECT * FROM products WHERE id = ?", [productId]);
  if (productRows.length === 0) return null;

  const [statsRows] = await pool.query(
    "SELECT MAX(price) AS high_30d, MIN(price) AS low_30d, AVG(price) AS avg_30d FROM price_history WHERE product_id = ? AND updated_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
    [productId]
  );

  const product = productRows[0];
  const stats = statsRows[0] || { high_30d: 0, low_30d: 0, avg_30d: 0 };
  
  // Gọi AI thay vì Rule-based
  let analysis = await generateSingleProductAnalysisWithGroq({ ...product, stats });
  
  if (!analysis) {
    analysis = generateUniqueAnalysis(product, stats, [], []);
  }

  const analysisJson = JSON.stringify(analysis);
  await pool.query(
    "INSERT INTO analysis_data (product_id, analysis_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE analysis_json = ?",
    [productId, analysisJson, analysisJson]
  );

  await pool.query("UPDATE products SET analysis_at = NOW() WHERE id = ?", [productId]);
  return analysis;
}

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

    // 1. Chạy phân tích cho từng sản phẩm song song
    const analysisPromises = productsData.map(p => generateSingleProductAnalysisWithGroq(p));
    const results = await Promise.all(analysisPromises);

    // 2. Duyệt qua kết quả và cập nhật
    for (let i = 0; i < productsData.length; i++) {
      const product = productsData[i];
      let analysis = results[i];

      if (!analysis) {
        console.log(`💡 [Fallback] Sử dụng Rule-based cho sản phẩm #${product.id}`);
        analysis = generateUniqueAnalysis(product, product.stats, [], []);
      }

      // 3. Cơ chế "Di cư dữ liệu": Cất bản cũ vào Lịch sử trước khi lưu bản mới
      const [oldAnalysis] = await pool.query("SELECT analysis_json FROM analysis_data WHERE product_id = ?", [product.id]);
      if (oldAnalysis.length > 0) {
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

      await pool.query("UPDATE products SET analysis_at = NOW() WHERE id = ?", [product.id]);
    }

    console.log(`✅ [Batch Update] Hoàn thành cập nhật cho nhóm ${productIds.length} sản phẩm.`);
  } catch (err) {
    console.error("❌ Lỗi performBatchUpdate:", err.message);
  }
}

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
    // Lấy toàn bộ danh sách danh mục (phục vụ cho việc chọn loại khi tạo/sửa sản phẩm ở Admin)
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

    let newsRows = [];
    const stats = statsRows[0] || { high_30d: 0, low_30d: 0, avg_30d: 0 };
    const percentChange = product.previousPrice > 0
      ? ((product.currentPrice - product.previousPrice) / product.previousPrice * 100).toFixed(2)
      : 0;

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

router.get("/:id/analysis", async (req, res) => {
  try {
    const productId = req.params.id;
    const force = req.query.force === "true";

    // 1. Nếu không force, kiểm tra xem đã có dữ liệu trong DB chưa
    if (!force) {
      const [rows] = await pool.query(
        "SELECT analysis_json FROM analysis_data WHERE product_id = ?",
        [productId]
      );

      if (rows.length > 0 && rows[0].analysis_json) {
        const analysis = typeof rows[0].analysis_json === 'string'
          ? JSON.parse(rows[0].analysis_json)
          : rows[0].analysis_json;
        return res.json(analysis);
      }
    }

    // 2. Nếu chưa có hoặc force=true, thực hiện rebuild (gọi AI)
    console.log(`🤖 [AI Rebuild] Đang phân tích mới cho sản phẩm #${productId}${force ? " (Force)" : ""}`);
    const analysis = await rebuildAnalysisForProduct(productId);

    if (!analysis) {
      return res.status(200).json({
        summary: "Đang phân tích dữ liệu thị trường...",
        status: "pending"
      });
    }

    return res.json(analysis);

  } catch (error) {
    console.error("❌ Lỗi truy vấn phân tích từ DB:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi lấy dữ liệu" });
  }
});

/**
 * 🔄 HỆ THỐNG TỰ ĐỘNG HÓA AI (AGENTIC AUTOMATION)
 */

async function refreshAllProductsAnalysis() {
  console.log("🕒 [Automation] Đang kiểm tra sản phẩm cũ nhất để cập nhật (Drip Mode)...");
  try {
    const [products] = await pool.query(
      "SELECT id, name FROM products ORDER BY analysis_at ASC LIMIT 1"
    );

    if (products.length === 0) return;

    const product = products[0];
    console.log(`📡 [Drip Update] Đang ưu tiên cập nhật cho: ${product.name} (#${product.id})`);
    await performBatchUpdate([product.id]);

  } catch (err) {
    console.error("❌ [Automation] Lỗi khi chạy cập nhật nhỏ giọt:", err.message);
  }
}

async function cleanupOldAnalysisHistory() {
  console.log("🧹 [Automation] Đang quét dọn lịch sử phân tích cũ (> 1 tuần)...");
  try {
    const [result] = await pool.query(
      "DELETE FROM analysis_history WHERE created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)"
    );
    console.log(`🗑️ [Automation] Đã xóa ${result.affectedRows} bản ghi cũ trong analysis_history.`);
  } catch (err) {
    console.error("❌ [Automation] Lỗi dọn dẹp lịch sử:", err.message);
  }
}


const ONE_MINUTE = 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

setTimeout(() => {
  refreshAllProductsAnalysis();
  cleanupOldAnalysisHistory();
  setInterval(refreshAllProductsAnalysis, ONE_MINUTE);
  setInterval(cleanupOldAnalysisHistory, TWENTY_FOUR_HOURS);
}, 5000);

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
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.json([]);
    }
    const [products] = await pool.query(
      `SELECT id, name FROM products WHERE id IN (?)`,
      [productIds]
    );
    if (products.length === 0) return res.json([]);
    const nameMap = new Map(products.map(p => [p.id, p.name]));
    let interval = 30;
    if (range === "7d") interval = 7;
    if (range === "6m") interval = 180;
    if (range === "1y") interval = 365;
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
    const basePriceMap = new Map();
    const normalizedDataMap = new Map();
    for (const id of productIds) {
      const firstEntry = historyRows.find(h => h.product_id === id);
      if (firstEntry) {
        basePriceMap.set(id, Number(firstEntry.price));
      }
    }
    historyRows.forEach(row => {
      const dateObj = new Date(row.dateStr);
      const dateKey = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}`;
      if (!normalizedDataMap.has(dateKey)) {
        normalizedDataMap.set(dateKey, { date: dateKey });
      }
      const basePrice = basePriceMap.get(row.product_id);
      const productName = nameMap.get(row.product_id);
      if (basePrice && productName && basePrice > 0) {
        const currentPrice = Number(row.price);
        const normalizedValue = (currentPrice / basePrice) * 100;
        normalizedDataMap.get(dateKey)[productName] = Number(normalizedValue.toFixed(2));
      }
    });
    const finalChartData = Array.from(normalizedDataMap.values());
    finalChartData.sort((a, b) => {
      const [d1, m1] = a.date.split("/").map(Number);
      const [d2, m2] = b.date.split("/").map(Number);
      return m1 - m2 || d1 - d2;
    });
    res.json(finalChartData);
  } catch (error) {
    console.error("❌ Lỗi API Compare:", error);
    res.status(500).json({ error: "Lỗi máy chủ khi xử lý so sánh", details: error.message });
  }
});

export default router
