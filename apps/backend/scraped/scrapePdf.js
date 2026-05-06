/**
 * 📄 PDF Scraper — thitruongnongsan.gov.vn
 * Tự động cào bản tin tuần MỚI NHẤT từ 3 danh mục: Lúa gạo, Cà phê, Rau quả
 *
 * Luồng: Puppeteer → Tìm link PDF → axios tải buffer → pdf-parse đọc text → AI parse → MySQL
 *
 * Chạy: node scraped/scrapePdf.js
 */

import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import pool from "../db.js";
import { parsePdfWithGroq, validateParsedData } from "../services/pdfParserService.js";

puppeteer.use(StealthPlugin());

// ===========================
// ⚙️ Cấu hình
// ===========================

const BASE_URL = "https://thitruongnongsan.gov.vn";
const BANTIN_URL = `${BASE_URL}/vn/bantin.aspx`;

const CATEGORIES = [
  { name: "Lúa gạo", keyword: "Lúa gạo" },
  { name: "Cà phê",  keyword: "Cà phê" },
  { name: "Rau quả", keyword: "Rau quả" },
];

const WAIT_MS = 5000;

// ===========================
// 🔍 Tìm link PDF bản tin tuần mới nhất
// ===========================

async function findLatestWeeklyPdfLinks(page) {
  console.log(`\n🌐 Truy cập trang Bản tin: ${BANTIN_URL}`);
  await page.goto(BANTIN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise(r => setTimeout(r, WAIT_MS));

  // Lấy tất cả link trên trang
  const allLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("a")).map(a => ({
      href: a.href || "",
      text: (a.innerText || a.textContent || "").trim(),
    }));
  });

  console.log(`📋 Tìm thấy ${allLinks.length} link trên trang`);

  const results = [];

  for (const cat of CATEGORIES) {
    // Tìm link bản tin tuần theo keyword
    // Pattern: "Bản tin Lúa gạo số 15 (20.04.2026)" hoặc "Bản tin Cà phê số 15 (20.04.2026)"
    const weeklyLinks = allLinks.filter(link => {
      const textLower = link.text.toLowerCase();
      const keywordLower = cat.keyword.toLowerCase();
      return (
        textLower.includes("bản tin") &&
        textLower.includes(keywordLower) &&
        textLower.includes("số") &&
        link.href.toLowerCase().endsWith(".pdf")
      );
    });

    if (weeklyLinks.length > 0) {
      // Link đầu tiên là mới nhất (website sắp xếp từ mới → cũ)
      const latest = weeklyLinks[0];
      
      // Trích xuất số bản tin và ngày từ text
      const numMatch = latest.text.match(/số\s*(\d+)/i);
      const dateMatch = latest.text.match(/(\d{2})[.\\/](\d{2})[.\\/](\d{4})/);

      results.push({
        category: cat.name,
        url: latest.href,
        text: latest.text,
        reportNumber: numMatch ? parseInt(numMatch[1]) : null,
        reportDate: dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null,
      });

      console.log(`✅ ${cat.name}: ${latest.text}`);
      console.log(`   📎 ${latest.href}`);
    } else {
      console.log(`⚠️ Không tìm thấy bản tin tuần cho ${cat.name}`);
    }
  }

  return results;
}

// ===========================
// 📥 Tải và đọc PDF
// ===========================

/**
 * Cắt phần bảng giá từ text PDF (chỉ lấy phần liên quan thay vì toàn bộ PDF)
 * Giúp giảm số token gửi AI từ 15K+ xuống ~3-4K ký tự
 */
function extractTableSection(fullText, category) {
  // Keywords đánh dấu bắt đầu phần bảng giá theo danh mục
  const tableMarkers = {
    "Lúa gạo": ["GIÁ LÚA GẠO", "PHỤ LỤC", "Mặt hàng"],
    "Cà phê": ["GIÁ CÀ PHÊ NHÂN XÔ", "GIÁ CÀ PHÊ", "Tỉnh/ huyện", "Tỉnh/huyện"],
    "Rau quả": ["GIÁ RAU QUẢ", "PHỤ LỤC", "Loại HH"],
  };

  const markers = tableMarkers[category] || [];

  // Tìm vị trí bắt đầu bảng giá
  let startIdx = -1;
  for (const marker of markers) {
    const idx = fullText.lastIndexOf(marker); // lastIndexOf vì bảng thường ở cuối PDF
    if (idx !== -1 && (startIdx === -1 || idx < startIdx)) {
      startIdx = idx;
    }
  }

  if (startIdx === -1) {
    // Không tìm thấy marker → lấy 30% cuối PDF (phần bảng thường ở cuối)
    const cutPoint = Math.floor(fullText.length * 0.7);
    console.log(`   ⚠️ Không tìm thấy marker bảng ${category}, lấy 30% cuối PDF`);
    return fullText.substring(cutPoint);
  }

  const tableText = fullText.substring(startIdx);
  console.log(`   ✂️ Đã cắt bảng ${category}: ${tableText.length} ký tự (từ vị trí ${startIdx})`);
  return tableText;
}

async function downloadAndReadPdf(url, category) {
  console.log(`\n📥 Đang tải PDF: ${url}`);

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  const buffer = Buffer.from(response.data);
  console.log(`   📦 Kích thước: ${(buffer.length / 1024).toFixed(1)} KB`);

  const data = await pdf(buffer);
  console.log(`   📝 Đã đọc: ${data.numpages} trang, ${data.text.length} ký tự`);

  // Cắt chỉ phần bảng giá để giảm token
  const tableText = extractTableSection(data.text, category);

  return { fullText: data.text, tableText };
}

// ===========================
// 💾 Lưu vào MySQL
// ===========================

async function checkAlreadyScraped(pdfUrl) {
  const [rows] = await pool.query(
    "SELECT id FROM gov_pdf_reports WHERE pdf_url = ?",
    [pdfUrl]
  );
  return rows.length > 0;
}

async function saveReportMetadata(pdfInfo, rawText, parsedData) {
  // Chỉ lưu metadata để theo dõi PDF nào đã cào (tránh cào trùng)
  const [insertReport] = await pool.query(
    `INSERT INTO gov_pdf_reports (pdf_url, category, report_number, report_date, raw_text, parsed_json, status)
     VALUES (?, ?, ?, ?, ?, ?, 'parsed')`,
    [
      pdfInfo.url,
      pdfInfo.category,
      pdfInfo.reportNumber,
      pdfInfo.reportDate,
      rawText,
      JSON.stringify(parsedData),
    ]
  );
  console.log(`   💾 Đã lưu report #${insertReport.insertId} (${pdfInfo.category})`);
}

// ===========================
// 💾 Đồng bộ dữ liệu PDF vào bảng products chung
// ===========================

// Bảng ánh xạ: key = "tên_pdf|vùng" (lowercase) → value = tên sản phẩm trong DB
const PDF_NAME_MAP = {
  // Cà phê nhân xô từ PDF gov → map sang tên products đang có
  "cà phê nhân xô|lâm đồng": "Cà phê Lâm Đồng",
  "cà phê nhân xô|đắk lắk": "Cà phê Đắk Lắk",
  "cà phê nhân xô|đắc lắk": "Cà phê Đắk Lắk",
  "cà phê nhân xô|gia lai": "Cà phê Gia Lai",
  "cà phê nhân xô|đắk nông": "Cà phê Đắk Nông",
  "cà phê nhân xô|đắc nông": "Cà phê Đắk Nông",
  // Sầu riêng
  "sầu riêng ri6|cần thơ": "Sầu Riêng Ri6",
  "sầu riêng ri6|đồng tháp": "Sầu Riêng Ri6",
  // Tiêu
  "tiêu|gia lai": "Tiêu Gia Lai",
  "hồ tiêu|gia lai": "Tiêu Gia Lai",
  "tiêu|bà rịa - vũng tàu": "Tiêu Bà Rịa - Vũng Tàu",
  "hồ tiêu|bà rịa - vũng tàu": "Tiêu Bà Rịa - Vũng Tàu",
  "tiêu|đắk lắk": "Tiêu Đắk Lắk",
  "hồ tiêu|đắk lắk": "Tiêu Đắk Lắk",
  "tiêu|bình phước": "Tiêu Bình Phước",
  "hồ tiêu|bình phước": "Tiêu Bình Phước",
  "tiêu|đắk nông": "Tiêu Đắk Nông",
  "hồ tiêu|đắk nông": "Tiêu Đắk Nông",
};

// Chuẩn hóa tên để so khớp mềm (bỏ dấu cách thừa, lowercase)
function normalizeForMatch(str) {
  return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

// Xác định category từ tên sản phẩm
function detectCategory(productName) {
  const lower = (productName || "").toLowerCase();
  if (lower.includes("cà phê") || lower.includes("ca phe")) return "Cà phê";
  if (lower.includes("tiêu") || lower.includes("hồ tiêu")) return "Hồ tiêu";
  if (lower.includes("sầu riêng")) return "Sầu riêng";
  if (lower.includes("lúa") || lower.includes("gạo")) return "Lúa gạo";
  return "Trái cây";
}

async function savePdfToProducts(parsedData, reportDate) {
  if (!parsedData?.data?.length) return;

  console.log(`\n   🔄 [PDF→Products] Đang đồng bộ ${parsedData.data.length} dòng vào products...`);
  let updated = 0, created = 0, skipped = 0;

  for (const item of parsedData.data) {
    if (!item.product || !item.currentPrice) { skipped++; continue; }

    const pdfProduct = normalizeForMatch(item.product);
    const pdfRegion = normalizeForMatch(item.region);
    const mapKey = pdfRegion ? `${pdfProduct}|${pdfRegion}` : pdfProduct;

    // 1. Tra bảng ánh xạ trước
    let dbProductName = PDF_NAME_MAP[mapKey] || null;

    // 2. Nếu không có trong map → thử tìm trực tiếp trong DB
    if (!dbProductName) {
      // Thử tìm product có tên chứa cả product + region
      const searchName = pdfRegion ? `${item.product} ${item.region}` : item.product;
      const [found] = await pool.query(
        "SELECT name FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))",
        [searchName]
      );
      if (found.length > 0) {
        dbProductName = found[0].name;
      } else {
        // Tạo tên mới chuẩn hóa
        dbProductName = pdfRegion ? `${item.product} ${item.region}` : item.product;
      }
    }

    // 3. Xác định category
    const categoryName = detectCategory(dbProductName);
    const [catRows] = await pool.query("SELECT id FROM categories WHERE name = ?", [categoryName]);
    let categoryId;
    if (catRows.length > 0) categoryId = catRows[0].id;
    else {
      const [ins] = await pool.query("INSERT INTO categories (name) VALUES (?)", [categoryName]);
      categoryId = ins.insertId;
    }

    // 4. Tìm/tạo product
    const [exists] = await pool.query(
      "SELECT * FROM products WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))", [dbProductName]
    );

    let productId, product;
    if (exists.length === 0) {
      const regionVal = item.region || categoryName;
      const [ins] = await pool.query(
        "INSERT INTO products (name, category_id, region, currentPrice, previousPrice, trend, lastUpdate) VALUES (?, ?, ?, ?, ?, ?, NOW())",
        [dbProductName, categoryId, regionVal, item.currentPrice, item.previousPrice || item.currentPrice, "stable"]
      );
      productId = ins.insertId;
      product = { id: productId, currentPrice: item.currentPrice, previousPrice: item.currentPrice };
      created++;
      console.log(`      🆕 Tạo sản phẩm mới: ${dbProductName}`);
    } else {
      product = exists[0];
      productId = product.id;
    }

    // 5. Ghi price_history (tránh trùng theo ngày + giá)
    const priceDate = reportDate || new Date();
    const dateStr = new Date(priceDate).toISOString().slice(0, 10);
    const [hist] = await pool.query(
      "SELECT id FROM price_history WHERE product_id = ? AND DATE(updated_at) = ? AND price = ?",
      [productId, dateStr, item.currentPrice]
    );

    if (hist.length === 0) {
      await pool.query(
        "INSERT INTO price_history (product_id, price, updated_at) VALUES (?, ?, ?)",
        [productId, item.currentPrice, priceDate]
      );
      updated++;
    } else {
      skipped++;
    }

    // Luôn cập nhật giá trị vào bảng products để làm mốc tính % thay đổi cho UI
    const prev = item.previousPrice || product.currentPrice;
    const trend = item.currentPrice > prev ? "up" : item.currentPrice < prev ? "down" : "stable";
    await pool.query(
      "UPDATE products SET previousPrice=?, currentPrice=?, trend=?, lastUpdate=NOW() WHERE id=?",
      [prev, item.currentPrice, trend, productId]
    );

    // Chèn/Ghi đè giá cũ vào price_history mốc 7 ngày trước để biểu đồ được mượt và khớp với UI
    if (item.previousPrice) {
      const prevDate = new Date(priceDate);
      prevDate.setDate(prevDate.getDate() - 7);
      const prevDateStr = prevDate.toISOString().slice(0, 10);
      
      const [prevHist] = await pool.query(
        "SELECT id FROM price_history WHERE product_id = ? AND DATE(updated_at) = ?",
        [productId, prevDateStr]
      );
      
      if (prevHist.length === 0) {
        await pool.query(
          "INSERT INTO price_history (product_id, price, updated_at) VALUES (?, ?, ?)",
          [productId, item.previousPrice, prevDate]
        );
      } else {
        await pool.query(
          "UPDATE price_history SET price = ? WHERE id = ?",
          [item.previousPrice, prevHist[0].id]
        );
      }
    }
  }

  console.log(`   ✅ [PDF→Products] Hoàn tất: ${created} mới, ${updated} cập nhật, ${skipped} bỏ qua`);
}

// ===========================
// 🚀 Pipeline chính
// ===========================

export async function scrapePdfReports() {
  console.log("\n" + "=".repeat(60));
  console.log("📄 [PDF Scraper] Bắt đầu cào bản tin tuần từ thitruongnongsan.gov.vn");
  console.log("=".repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Bước 1: Tìm link PDF mới nhất
    const pdfLinks = await findLatestWeeklyPdfLinks(page);

    if (pdfLinks.length === 0) {
      console.log("⚠️ Không tìm thấy bản tin tuần nào. Kết thúc.");
      return;
    }

    console.log(`\n📋 Tìm thấy ${pdfLinks.length} bản tin tuần để xử lý`);

    // Bước 2: Xử lý từng PDF
    let processedCount = 0;
    let skippedCount = 0;

    for (const pdfInfo of pdfLinks) {
      console.log(`\n${"─".repeat(50)}`);
      console.log(`📄 Xử lý: ${pdfInfo.text}`);

      // Kiểm tra đã cào chưa
      const alreadyScraped = await checkAlreadyScraped(pdfInfo.url);
      if (alreadyScraped) {
        console.log(`⏭️ Đã cào trước đó, bỏ qua.`);
        skippedCount++;
        continue;
      }

      try {
        // Tải và đọc PDF
        const { fullText, tableText } = await downloadAndReadPdf(pdfInfo.url, pdfInfo.category);

        // Gửi AI parse (chỉ gửi phần bảng giá, không phải toàn bộ PDF)
        let parsedData = await parsePdfWithGroq(tableText, pdfInfo.category);
        parsedData = validateParsedData(parsedData);

        if (!parsedData) {
          // Lưu report với status error
          await pool.query(
            `INSERT INTO gov_pdf_reports (pdf_url, category, report_number, report_date, raw_text, status)
             VALUES (?, ?, ?, ?, ?, 'error')`,
            [pdfInfo.url, pdfInfo.category, pdfInfo.reportNumber, pdfInfo.reportDate, fullText]
          );
          console.log(`❌ AI không thể parse được PDF này, đã lưu raw text.`);
          continue;
        }

        // Lưu metadata report (để track PDF đã cào)
        await saveReportMetadata(pdfInfo, fullText, parsedData);

        // 💾 Lưu dữ liệu giá vào bảng products chung
        await savePdfToProducts(parsedData, pdfInfo.reportDate);
        processedCount++;

        // Delay 15s giữa các request để tránh Groq rate limit (6000 TPM)
        if (pdfLinks.indexOf(pdfInfo) < pdfLinks.length - 1) {
          console.log(`   ⏳ Chờ 15s trước khi xử lý PDF tiếp theo (rate limit)...`);
          await new Promise(r => setTimeout(r, 15000));
        }

      } catch (err) {
        console.error(`❌ Lỗi xử lý ${pdfInfo.category}:`, err.message);
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ [PDF Scraper] Hoàn tất!`);
    console.log(`   📊 Đã xử lý: ${processedCount} | Bỏ qua: ${skippedCount} | Tổng: ${pdfLinks.length}`);
    console.log("=".repeat(60) + "\n");

  } catch (err) {
    console.error("❌ [PDF Scraper] Lỗi nghiêm trọng:", err.message);
  } finally {
    await browser.close();
  }
}

// ===========================
// Chạy trực tiếp
// ===========================

const isDirectRun = process.argv[1]?.includes("scrapePdf");
if (isDirectRun) {
  scrapePdfReports()
    .then(() => {
      console.log("🏁 Script kết thúc.");
      process.exit(0);
    })
    .catch(err => {
      console.error("💥 Lỗi:", err);
      process.exit(1);
    });
}
