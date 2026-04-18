const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

dotenv.config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'agrirend'
});

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

async function generateSingleProductAnalysisWithGroq(product) {
  try {
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

async function run() {
  console.log("🚀 Chạy lại toàn bộ phân tích với logic chống lặp lại...");
  
  const [rows] = await pool.query("SELECT id FROM products");
  const productIds = rows.map(r => r.id);
  
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

  const analysisPromises = productsData.map(p => generateSingleProductAnalysisWithGroq(p));
  const results = await Promise.all(analysisPromises);

  for (let i = 0; i < productsData.length; i++) {
    const product = productsData[i];
    let analysis = results[i];

    if (!analysis) continue;

    const analysisJson = JSON.stringify(analysis);
    await pool.query(
      "INSERT INTO analysis_data (product_id, analysis_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE analysis_json = ?",
      [product.id, analysisJson, analysisJson]
    );

    await pool.query("UPDATE products SET analysis_at = NOW() WHERE id = ?", [product.id]);
    console.log(`✅ Đã làm mới AI: ${product.name}`);
  }

  console.log("🏁 Xong!");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
