/**
 * 📄 PDF Parser Service
 * Gửi text thô từ PDF sang Groq AI để trích xuất bảng dữ liệu giá nông sản.
 * Hỗ trợ 3 danh mục: Lúa gạo, Cà phê, Rau quả
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// ===========================
// Prompt riêng cho từng danh mục
// ===========================

function buildPromptLuaGao(rawText) {
  return `Bạn là chuyên gia phân tích báo cáo thị trường nông sản Việt Nam.
Dưới đây là nội dung text trích xuất từ file PDF BÁO CÁO TUẦN ngành LÚA GẠO từ trang thitruongnongsan.gov.vn.

--- BẮT ĐẦU NỘI DUNG PDF ---
${rawText}
--- KẾT THÚC NỘI DUNG PDF ---

HÃY TRÍCH XUẤT TOÀN BỘ dữ liệu từ bảng "PHỤ LỤC: GIÁ LÚA GẠO TẠI MỘT SỐ ĐỊA PHƯƠNG TRONG TUẦN".
Bảng này có các cột: Mặt hàng | Tỉnh | Giá tuần này (VND/kg) | Thay đổi so với tuần trước (VND/kg).

Lưu ý:
- Một số mặt hàng có NHIỀU dòng với tỉnh khác nhau (ví dụ: Lúa Jasmine có Cần Thơ và Đồng Tháp).
- Giá trị thay đổi có thể dương (+), âm (-), hoặc 0.
- Nếu ô trống thì để null.

TRẢ VỀ DUY NHẤT JSON với cấu trúc:
{
  "reportDate": "DD/MM/YYYY",
  "reportNumber": <số bản tin>,
  "category": "Lúa gạo",
  "tableTitle": "GIÁ LÚA GẠO TẠI MỘT SỐ ĐỊA PHƯƠNG TRONG TUẦN",
  "unit": "VND/kg",
  "data": [
    {
      "product": "<tên mặt hàng>",
      "region": "<tỉnh>",
      "currentPrice": <số nguyên>,
      "priceChange": <số nguyên hoặc null>
    }
  ]
}`;
}

function buildPromptCaPhe(rawText) {
  return `Bạn là chuyên gia phân tích báo cáo thị trường nông sản Việt Nam.
Dưới đây là nội dung text trích xuất từ file PDF BÁO CÁO TUẦN ngành CÀ PHÊ từ trang thitruongnongsan.gov.vn.

--- BẮT ĐẦU NỘI DUNG PDF ---
${rawText}
--- KẾT THÚC NỘI DUNG PDF ---

HÃY TRÍCH XUẤT TOÀN BỘ dữ liệu từ bảng "GIÁ CÀ PHÊ NHÂN XÔ".
Bảng này có các cột: Tỉnh/huyện | Thứ 2 | Thứ 3 | Thứ 4 | Thứ 5 | Thứ 6 | Trung bình | Tăng/giảm.
ĐVT: VND/kg.

Lưu ý:
- Dòng in đậm/chữ hoa là TỈNH tổng hợp (LÂM ĐỒNG, ĐẮK LẮK, GIA LAI...).
- Dòng thường là huyện/xã thuộc tỉnh phía trên.
- Lấy TẤT CẢ các dòng (cả tỉnh tổng hợp và huyện).
- Giá trị Tăng/giảm có thể dương, âm, hoặc 0.

TRẢ VỀ DUY NHẤT JSON với cấu trúc:
{
  "reportDate": "DD/MM/YYYY",
  "reportNumber": <số bản tin>,
  "category": "Cà phê",
  "tableTitle": "GIÁ CÀ PHÊ NHÂN XÔ",
  "unit": "VND/kg",
  "data": [
    {
      "product": "Cà phê nhân xô",
      "region": "<tỉnh hoặc huyện>",
      "currentPrice": <trung bình - số nguyên>,
      "priceChange": <tăng/giảm - số nguyên hoặc null>,
      "dailyPrices": {
        "thu2": <số hoặc null>,
        "thu3": <số hoặc null>,
        "thu4": <số hoặc null>,
        "thu5": <số hoặc null>,
        "thu6": <số hoặc null>
      }
    }
  ]
}`;
}

function buildPromptRauQua(rawText) {
  return `Bạn là chuyên gia phân tích báo cáo thị trường nông sản Việt Nam.
Dưới đây là nội dung text trích xuất từ file PDF BÁO CÁO TUẦN ngành RAU QUẢ từ trang thitruongnongsan.gov.vn.

--- BẮT ĐẦU NỘI DUNG PDF ---
${rawText}
--- KẾT THÚC NỘI DUNG PDF ---

HÃY TRÍCH XUẤT TOÀN BỘ dữ liệu từ bảng "PHỤ LỤC: GIÁ RAU QUẢ TẠI MỘT SỐ ĐỊA PHƯƠNG TRONG TUẦN".
Bảng này có các cột: Loại HH/Địa phương | Giá tuần trước | Giá tuần này (ước tính) | Thay đổi so với tuần trước.
ĐVT: VND/kg.

Lưu ý:
- Dòng in đậm là TÊN SẢN PHẨM tổng hợp (Dưa hấu, Dưa leo, Sầu riêng Ri6...).
- Dòng thường bên dưới là ĐỊA PHƯƠNG cụ thể (Đồng Tháp, TP. Cần Thơ, An Giang...).
- Lấy TẤT CẢ các dòng (cả sản phẩm tổng hợp và địa phương).
- Dòng sản phẩm tổng hợp để region = null.
- Dòng địa phương để product = tên sản phẩm gần nhất phía trên.
- Nếu ô trống thì để null.

TRẢ VỀ DUY NHẤT JSON với cấu trúc:
{
  "reportDate": "DD/MM/YYYY",
  "reportNumber": <số bản tin>,
  "category": "Rau quả",
  "tableTitle": "GIÁ RAU QUẢ TẠI MỘT SỐ ĐỊA PHƯƠNG TRONG TUẦN",
  "unit": "VND/kg",
  "data": [
    {
      "product": "<tên sản phẩm>",
      "region": "<địa phương hoặc null>",
      "currentPrice": <số nguyên hoặc null>,
      "previousPrice": <số nguyên hoặc null>,
      "priceChange": <số nguyên hoặc null>
    }
  ]
}`;
}

// ===========================
// Gọi Groq AI để parse
// ===========================

/**
 * Gửi rawText từ PDF sang Groq AI để trích xuất bảng giá
 * @param {string} rawText - Nội dung text thô từ PDF
 * @param {string} category - "Lúa gạo" | "Cà phê" | "Rau quả"
 * @returns {object|null} - Dữ liệu đã parse hoặc null nếu lỗi
 */
export async function parsePdfWithGroq(rawText, category, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!process.env.GROQ_API_KEY) {
        throw new Error("Chưa có GROQ_API_KEY trong .env");
      }

      // Chọn prompt theo danh mục
      let prompt;
      switch (category) {
        case "Lúa gạo":
          prompt = buildPromptLuaGao(rawText);
          break;
        case "Cà phê":
          prompt = buildPromptCaPhe(rawText);
          break;
        case "Rau quả":
          prompt = buildPromptRauQua(rawText);
          break;
        default:
          throw new Error(`Danh mục không hỗ trợ: ${category}`);
      }

      console.log(`\n🤖 [PDF Parser] Gửi text ${category} sang AI (${rawText.length} ký tự)... [lần ${attempt}/${retries}]`);

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 4096,
        }),
      });

      const data = await response.json();

      if (data.error) {
        // Rate limit → retry sau khi chờ
        if (data.error.message?.includes("Rate limit") || response.status === 429) {
          const waitMatch = data.error.message.match(/try again in ([\d.]+)s/);
          const waitSec = waitMatch ? Math.ceil(parseFloat(waitMatch[1])) + 5 : 35;
          if (attempt < retries) {
            console.log(`⏳ [PDF Parser] Rate limit! Chờ ${waitSec}s rồi thử lại...`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            continue;
          }
        }
        throw new Error(`Groq API error: ${data.error.message}`);
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("AI không trả về nội dung");
      }

      const parsed = JSON.parse(content);

      // Validate cơ bản
      if (!parsed.data || !Array.isArray(parsed.data)) {
        throw new Error("AI trả về JSON không có mảng 'data'");
      }

      console.log(`✅ [PDF Parser] Đã parse ${category}: ${parsed.data.length} dòng dữ liệu`);
      return parsed;

    } catch (err) {
      if (attempt === retries) {
        console.error(`❌ [PDF Parser] Lỗi parse ${category} (hết retry):`, err.message);
        return null;
      }
      console.log(`⚠️ [PDF Parser] Lỗi lần ${attempt}, thử lại...`);
      await new Promise(r => setTimeout(r, 10000));
    }
  }
  return null;
}

/**
 * Validate và chuẩn hóa dữ liệu đã parse
 * @param {object} parsedData - Dữ liệu từ AI
 * @returns {object} - Dữ liệu đã validate
 */
export function validateParsedData(parsedData) {
  if (!parsedData || !parsedData.data) return null;

  // Lọc các dòng có ít nhất product hoặc region
  parsedData.data = parsedData.data.filter(item => {
    return item.product || item.region;
  });

  // Chuẩn hóa giá trị số
  parsedData.data = parsedData.data.map(item => ({
    ...item,
    currentPrice: item.currentPrice != null ? Number(item.currentPrice) || null : null,
    previousPrice: item.previousPrice != null ? Number(item.previousPrice) || null : null,
    priceChange: item.priceChange != null ? Number(item.priceChange) || 0 : null,
  }));

  return parsedData;
}
