import pool from "../db.js";
import fs from "fs";
import path from "path";
import { buildFaostatContextForProduct } from "./faostatService.js";

/**
 * Phân tích dữ liệu và tạo tóm tắt
 * @param {object} product - Thông tin sản phẩm (currentPrice, trend)
 * @param {object} stats - Thống kê (high_30d, low_30d, avg_30d)
 * @param {Array} history - Lịch sử (chứa 'forecast' SMA)
 * @param {Array} news - Tin tức liên quan
 * @returns {object} - Gồm { summary: string, sentiment: string }
 */
export function generateUniqueAnalysis(product, stats, history, news) {
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

  const formatVND = (val) => {
    let numStr = Number(val || 0).toFixed(2);
    numStr = parseFloat(numStr).toString();
    const parts = numStr.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(",");
  };

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
    analysisPoints.push(`Mức giá hiện tại đang áp sát vùng đỉnh 30 ngày (${formatVND(high30d)} VND), nên dư địa tăng thêm có nhưng vùng rủi ro cũng bắt đầu rõ hơn.`);
    sentimentScore += 1;
  } else if (positionInRange <= 0.2) {
    analysisPoints.push(`Giá hiện nằm gần vùng đáy 30 ngày (${formatVND(low30d)} VND), phù hợp hơn với góc nhìn chờ xác nhận nền giá thay vì mua đuổi.`);
    sentimentScore -= 1;
  } else {
    analysisPoints.push(`Giá vẫn đang ở giữa biên độ 30 ngày, cho thấy thị trường chưa rơi vào trạng thái quá nóng hoặc quá suy yếu.`);
  }

  if (gapVsAvgPct >= 6) {
    analysisPoints.push(`So với mức trung bình 30 ngày (${formatVND(avg30d)} VND), giá hiện cao hơn khoảng ${gapVsAvgPct.toFixed(1).replace('.', ',')}%, thể hiện mặt bằng premium ngắn hạn.`);
    sentimentScore += 1;
  } else if (gapVsAvgPct <= -6) {
    analysisPoints.push(`Giá hiện thấp hơn trung bình 30 ngày khoảng ${Math.abs(gapVsAvgPct).toFixed(1).replace('.', ',')}%, cho thấy thị trường vẫn đang giao dịch dưới vùng cân bằng quen thuộc.`);
    sentimentScore -= 1;
  } else {
    analysisPoints.push(`Khoảng cách với giá trung bình 30 ngày chưa lớn, nên áp lực lệch pha hiện chưa thật sự cực đoan.`);
  }

  if (Math.abs(intradayChangePct) >= 2.5) {
    analysisPoints.push(`Biến động so với phiên trước đạt ${intradayChangePct > 0 ? "+" : ""}${intradayChangePct.toFixed(2).replace('.', ',')}%, xác nhận nhịp giao dịch trong ngày tương đối mạnh.`);
  } else {
    analysisPoints.push(`Biến động ngày chỉ quanh ${intradayChangePct > 0 ? "+" : ""}${intradayChangePct.toFixed(2).replace('.', ',')}%, nên xu hướng hiện tại đang dịch chuyển khá chậm và chọn lọc.`);
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
  
  const formatVN = (val) => {
    let numStr = Number(val || 0).toFixed(2);
    numStr = parseFloat(numStr).toString();
    const parts = numStr.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return parts.join(",");
  };
  const info = `Sản phẩm: ${name}, Vùng: ${region}, Giá: ${formatVN(p.currentPrice)} VND/${p.unit}, 30 ngày: Cao ${formatVN(stats.high_30d)} VND, Thấp ${formatVN(stats.low_30d)} VND, TB ${formatVN(stats.avg_30d)} VND`;

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

  return `Bạn là ${role}. Dữ liệu: ${info}. YÊU CẦU: ${req}. TUYỆT ĐỐI KHÔNG được sử dụng dấu chấm (.) để ngăn cách phần thập phân (ví dụ 14000.00). PHẢI sử dụng dấu chấm (.) để ngăn cách phần nghìn và KHÔNG hiển thị phần xu/thập phân. Ví dụ đúng: 145.000 VND hoặc 109.500 VND. Nếu vi phạm định dạng này, phân tích sẽ bị hủy.`;
}

// Hàm bổ sung cho phần định dạng JSON
const getJsonFormatRequirement = (productId) => `
YÊU CẦU TRẢ VỀ: TRẢ VỀ DUY NHẤT MỘT ĐỐI TƯỢNG JSON VỚI CẤU TRÚC SAU:
{
  "id": ${productId},
  "summary": "...",
  "sentiment": "Tích cực" | "Tiêu cực" | "Trung tính",
  "predictedPrice": <số nguyên, ví dụ: 146500>,,
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
export async function generateSingleProductAnalysisWithGroq(product) {
  try {
    if (!process.env.GROQ_API_KEY) throw new Error("Chưa có GROQ_API_KEY");

    // Lấy context bổ sung từ FAOSTAT (nội dung sẽ trống nếu api faostat chưa config)
    const faostatContext = await buildFaostatContextForProduct(product);

    const promptBase = getPromptForProduct(product);
    const jsonFormat = getJsonFormatRequirement(product.id);
    let fullPrompt = `${promptBase}\n\n${jsonFormat}`;
    
    if (faostatContext) {
        fullPrompt = `${faostatContext}\n\n${fullPrompt}`;
    }

    console.log(`\n=============================================`);
    console.log(`🤖 [AI PROMPT] - Dành cho NS: ${product.name}`);
    console.log(fullPrompt);
    console.log(`=============================================\n`);

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

export async function rebuildAnalysisForProduct(productId) {
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

  // Chuẩn hóa dữ liệu: Đảm bảo change_amount luôn dương và direction khớp với giá trị
  if (analysis.change_amount < 0) {
    analysis.change_amount = Math.abs(analysis.change_amount);
    analysis.direction = "down";
  }
  if (analysis.direction === "down" && analysis.change_amount === 0) {
      // Nếu là down mà amount = 0, có thể do AI thiếu dữ liệu, để mặc định là side
      analysis.direction = "side";
  }

  const analysisJson = JSON.stringify(analysis);
  await pool.query(
    "INSERT INTO analysis_data (product_id, analysis_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE analysis_json = ?",
    [productId, analysisJson, analysisJson]
  );

  await pool.query("UPDATE products SET analysis_at = NOW() WHERE id = ?", [productId]);
  return analysis;
}

export async function performBatchUpdate(productIds) {
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

async function cleanupScrapedJsonFile() {
  console.log("🧹 [Automation] Đang dọn dẹp file JSON thô (all_regions.json)...");
  try {
    const filePath = path.join(process.cwd(), "scraped/all_regions.json");
    if (!fs.existsSync(filePath)) {
      console.log("⚠️ [Automation] Không tìm thấy file JSON để dọn dẹp.");
      return;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 7); // Giữ lại 7 ngày

    let removed = 0;
    let kept = 0;

    const parseNgay = (str) => {
      if (!str || typeof str !== "string") return null;
      const s = str.trim();
      if (s.includes("-")) {
        const [y, m, d] = s.split("-").map(Number);
        return new Date(y, m - 1, d);
      }
      const parts = s.split("/").map(Number);
      if (parts.length !== 3) return null;
      return new Date(parts[2], parts[1] - 1, parts[0]);
    };

    for (const region of data.regions || []) {
      const arr = region.data || [];
      const next = [];
      for (const row of arr) {
        const d = parseNgay(row["Ngày"]);
        if (d && d >= cutoff) {
          next.push(row);
          kept++;
        } else {
          removed++;
        }
      }
      region.data = next;
    }

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`🗑️ [Automation] Đã dọn dẹp JSON: Giữ ${kept}, Xóa ${removed} bản ghi cũ.`);
  } catch (err) {
    console.error("❌ [Automation] Lỗi dọn dẹp file JSON:", err.message);
  }
}

export function startAiAutomation() {
  const ONE_MINUTE = 60 * 1000;
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  setTimeout(() => {
    refreshAllProductsAnalysis();
    cleanupOldAnalysisHistory();
    cleanupScrapedJsonFile();
    setInterval(refreshAllProductsAnalysis, ONE_MINUTE);
    setInterval(cleanupOldAnalysisHistory, TWENTY_FOUR_HOURS);
    setInterval(cleanupScrapedJsonFile, TWENTY_FOUR_HOURS);
  }, 5000);
}
