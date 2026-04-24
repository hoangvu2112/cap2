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

async function saveToDatabase(pdfInfo, rawText, parsedData) {
  // 1. Lưu report metadata
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

  const reportId = insertReport.insertId;
  console.log(`   💾 Đã lưu report #${reportId} (${pdfInfo.category})`);

  // 2. Lưu từng dòng giá
  if (!parsedData?.data?.length) {
    console.log(`   ⚠️ Không có dữ liệu giá để lưu`);
    return reportId;
  }

  let savedCount = 0;

  for (const item of parsedData.data) {
    let extraData = null;

    // Cà phê: lưu giá từng ngày vào extra_data
    if (item.dailyPrices) {
      extraData = JSON.stringify(item.dailyPrices);
    }

    // Rau quả: previousPrice có sẵn trong item
    const previousPrice = item.previousPrice || null;

    await pool.query(
      `INSERT INTO gov_market_prices 
       (report_id, product_name, region, current_price, previous_price, price_change, unit, extra_data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        item.product || null,
        item.region || null,
        item.currentPrice || null,
        previousPrice,
        item.priceChange || null,
        parsedData.unit || "VND/kg",
        extraData,
      ]
    );
    savedCount++;
  }

  console.log(`   📊 Đã lưu ${savedCount} dòng giá vào gov_market_prices`);
  return reportId;
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

        // Lưu vào DB (lưu fullText cho tham khảo)
        await saveToDatabase(pdfInfo, fullText, parsedData);
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
