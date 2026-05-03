import fs from 'fs/promises';
import path from 'path';

const OUT_DIR = path.join(process.cwd(), 'scraped');
const DATA_FILE = path.join(OUT_DIR, 'all_regions.json');

async function ensureOutDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

function makeDateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function loadExisting() {
  try {
    const txt = await fs.readFile(DATA_FILE, 'utf-8');
    return JSON.parse(txt);
  } catch {
    return { scrapedAt: new Date().toISOString(), regions: [] };
  }
}

async function save(existing, temp = true) {
  const file = path.join('scraped', temp ? 'temp_check.json' : 'all_regions.json');
  await fs.writeFile(file, JSON.stringify(existing, null, 2), 'utf-8');
}

async function addGuavaExample() {
  await ensureOutDir();
  const existing = await loadExisting();

  // Ví dụ ổi tại 3 vùng
  const guavaRegions = [
    {
      name: 'Ổi Hồng - Đồng Nai',
      region: 'Đồng Nai',
      data: [
        { Ngày: makeDateStr(0), Giá: '25.000', ThayĐổi: '+500', priceValue: 25000, time: new Date().toLocaleTimeString('vi-VN') },
        { Ngày: makeDateStr(1), Giá: '24.500', ThayĐổi: '-500', priceValue: 24500, time: new Date().toLocaleTimeString('vi-VN') },
        { Ngày: makeDateStr(2), Giá: '25.000', ThayĐổi: '+1.000', priceValue: 25000, time: new Date().toLocaleTimeString('vi-VN') }
      ],
    },
    {
      name: 'Ổi Lục - Tiền Giang',
      region: 'Tiền Giang',
      data: [
        { Ngày: makeDateStr(0), Giá: '22.000', ThayĐổi: '0', priceValue: 22000, time: new Date().toLocaleTimeString('vi-VN') },
        { Ngày: makeDateStr(1), Giá: '22.000', ThayĐổi: '0', priceValue: 22000, time: new Date().toLocaleTimeString('vi-VN') },
        { Ngày: makeDateStr(2), Giá: '21.500', ThayĐổi: '-500', priceValue: 21500, time: new Date().toLocaleTimeString('vi-VN') }
      ],
    },
    {
      name: 'Ổi Đặc Sản - Bình Thuận',
      region: 'Bình Thuận',
      data: [
        { Ngày: makeDateStr(0), Giá: '28.000', ThayĐổi: '+1.000', priceValue: 28000, time: new Date().toLocaleTimeString('vi-VN') },
        { Ngày: makeDateStr(1), Giá: '27.000', ThayĐổi: '-500', priceValue: 27000, time: new Date().toLocaleTimeString('vi-VN') },
        { Ngày: makeDateStr(2), Giá: '27.500', ThayĐổi: '+500', priceValue: 27500, time: new Date().toLocaleTimeString('vi-VN') }
      ],
    }
  ];

  // Merge into existing: if region exists, prepend new unique rows
  for (const r of guavaRegions) {
    const found = existing.regions.find(x => x.name === r.name && x.region === r.region);
    if (found) {
      const existingKeys = new Set(found.data.map(d => `${d.Ngày}|${d.priceValue}`));
      const newRows = r.data.filter(d => !existingKeys.has(`${d.Ngày}|${d.priceValue}`));
      found.data = [...newRows, ...found.data];
    } else {
      existing.regions.push(r);
    }
  }

  existing.scrapedAt = new Date().toISOString();
  existing.regionCount = existing.regions.length;

  await save(existing, true);
  console.log('✅ Đã thêm ví dụ ổi vào scraped/temp_check.json');
}

addGuavaExample().catch(err => {
  console.error('Lỗi khi tạo ví dụ ổi:', err.message);
  process.exit(1);
});
