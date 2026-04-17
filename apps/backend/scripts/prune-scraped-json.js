/**
 * Giữ lại các dòng trong scraped/all_regions.json có ngày (Ngày) không quá cũ.
 * Mặc định: xóa các mốc cũ hơn N ngày (tính theo ngày lịch, so sánh từ 0h).
 *
 * Chạy:
 *   node scripts/prune-scraped-json.js [số_ngày]
 *   SCRAPE_JSON_RETENTION_DAYS=14 node scripts/prune-scraped-json.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE = path.join(__dirname, "../scraped/all_regions.json");

function parseNgay(str) {
  if (!str || typeof str !== "string") return null;
  const s = str.trim();
  if (s.includes("-")) {
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  const parts = s.split("/").map(Number);
  if (parts.length !== 3) return null;
  const [day, month, year] = parts;
  return new Date(year, month - 1, day);
}

function main() {
  const days = Number(
    process.env.SCRAPE_JSON_RETENTION_DAYS || process.argv[2] || 7
  );
  if (!Number.isFinite(days) || days < 0) {
    console.error("Số ngày không hợp lệ. Ví dụ: node scripts/prune-scraped-json.js 2");
    process.exit(1);
  }

  if (!fs.existsSync(FILE)) {
    console.error("Không thấy file:", FILE);
    process.exit(1);
  }

  const raw = fs.readFileSync(FILE, "utf8");
  const data = JSON.parse(raw);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);

  let removed = 0;
  let kept = 0;

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

  fs.writeFileSync(FILE, JSON.stringify(data, null, 2), "utf8");
  console.log(
    `✅ Đã cắt all_regions.json: giữ ${kept} dòng, bỏ ${removed} dòng (giữ từ ${cutoff.toLocaleDateString("vi-VN")} trở đi, cửa sổ ${days} ngày)`
  );
}

main();
