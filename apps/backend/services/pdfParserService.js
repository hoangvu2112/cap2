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

HÃY TRÍCH XUẤT dữ liệu từ bảng "PHỤ LỤC: GIÁ LÚA GẠO TẠI MỘT SỐ ĐỊA PHƯƠNG TRONG TUẦN".
Bảng có các cột: Mặt hàng | Tỉnh | Giá tuần này (VND/kg) | Thay đổi so với tuần trước.

QUY TẮC BẮT BUỘC:
- CHỈ lấy các dòng có TÊN TỈNH/ĐỊA PHƯƠNG cụ thể (Cần Thơ, Đồng Tháp, An Giang...).
- KHÔNG lấy dòng trung bình, dòng tổng hợp, dòng chỉ có tên mặt hàng mà không có tỉnh.
- Mỗi dòng phải có đầy đủ: tên mặt hàng + tỉnh + giá tuần này.
- Đơn vị luôn là VND/kg.

TRẢ VỀ DUY NHẤT JSON:
{
  "reportDate": "DD/MM/YYYY",
  "reportNumber": <số bản tin>,
  "category": "Lúa gạo",
  "unit": "VND/kg",
  "data": [
    {
      "product": "<tên mặt hàng>",
      "region": "<tỉnh>",
      "currentPrice": <giá tuần này - số nguyên>,
      "priceChange": <thay đổi - số nguyên hoặc null>
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

HÃY TRÍCH XUẤT dữ liệu từ bảng "GIÁ CÀ PHÊ NHÂN XÔ".
Bảng có các cột: Tỉnh/huyện | Thứ 2 | Thứ 3 | Thứ 4 | Thứ 5 | Thứ 6 | Trung bình | Tăng/giảm.
ĐVT: VND/kg.

QUY TẮC BẮT BUỘC:
- CHỈ lấy các dòng là HUYỆN/XÃ cụ thể (Di Linh, Lâm Hà, Bảo Lộc, Cư M'gar, Ea H'leo...).
- KHÔNG lấy dòng TỈNH tổng hợp (LÂM ĐỒNG, ĐẮK LẮK, GIA LAI...) vì đó là giá trung bình.
- Lấy giá CỦA NGÀY CUỐI CÙNG có dữ liệu (Thứ 6 nếu có, nếu không thì Thứ 5, Thứ 4...), KHÔNG lấy cột "Trung bình".
- Đơn vị luôn là VND/kg.

TRẢ VỀ DUY NHẤT JSON:
{
  "reportDate": "DD/MM/YYYY",
  "reportNumber": <số bản tin>,
  "category": "Cà phê",
  "unit": "VND/kg",
  "data": [
    {
      "product": "Cà phê nhân xô",
      "region": "<huyện/xã>",
      "currentPrice": <giá ngày cuối cùng - số nguyên>,
      "priceChange": <tăng/giảm - số nguyên hoặc null>
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

HÃY TRÍCH XUẤT dữ liệu từ bảng "PHỤ LỤC: GIÁ RAU QUẢ TẠI MỘT SỐ ĐỊA PHƯƠNG TRONG TUẦN".
Bảng có các cột: Loại HH/Địa phương | Giá tuần trước | Giá tuần này (ước tính) | Thay đổi so với tuần trước.
ĐVT: VND/kg.

CẤU TRÚC BẢNG:
- Dòng IN ĐẬM là TÊN SẢN PHẨM tổng hợp kèm GIÁ TRUNG BÌNH (Dưa hấu, Dưa leo, Sầu riêng Ri6...).
- Dòng thường bên dưới là ĐỊA PHƯƠNG cụ thể (Đồng Tháp, TP. Cần Thơ, An Giang...).

QUY TẮC BẮT BUỘC:
- CHỈ lấy các dòng ĐỊA PHƯƠNG cụ thể (không in đậm).
- KHÔNG lấy dòng tổng hợp/trung bình (dòng in đậm tên sản phẩm) vì đó là giá trung bình.
- Mỗi dòng phải gồm: product = tên sản phẩm từ dòng in đậm gần nhất phía trên, region = tên địa phương.
- Lấy cột "Giá tuần này (ước tính)" làm currentPrice.
- Lấy cột "Giá tuần trước" làm previousPrice.
- Đơn vị luôn là VND/kg.

Ví dụ đúng: Dưa hấu - Đồng Tháp: currentPrice = 12333
Ví dụ SAI (không lấy): Dưa hấu (dòng tổng hợp): currentPrice = 8611 ← ĐÂY LÀ GIÁ TRUNG BÌNH, BỎ QUA!

TRẢ VỀ DUY NHẤT JSON:
{
  "reportDate": "DD/MM/YYYY",
  "reportNumber": <số bản tin>,
  "category": "Rau quả",
  "unit": "VND/kg",
  "data": [
    {
      "product": "<tên sản phẩm>",
      "region": "<địa phương>",
      "currentPrice": <giá tuần này - số nguyên>,
      "previousPrice": <giá tuần trước - số nguyên hoặc null>,
      "priceChange": <thay đổi - số nguyên hoặc null>
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
  parsedData.data = parsedData.data.map(item => {
    const currentPrice = item.currentPrice != null ? Number(item.currentPrice) || null : null;
    const priceChange = item.priceChange != null ? Number(item.priceChange) || 0 : null;
    let previousPrice = item.previousPrice != null ? Number(item.previousPrice) || null : null;

    // Nếu PDF cung cấp Thay đổi (priceChange) nhưng không cho Giá cũ (previousPrice), ta tự tính ngược lại
    if (previousPrice === null && currentPrice !== null && priceChange !== null) {
        previousPrice = currentPrice - priceChange;
    }

    return {
      ...item,
      currentPrice,
      previousPrice,
      priceChange,
    };
  });

  return parsedData;
}
