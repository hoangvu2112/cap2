import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import fs from "fs/promises";
import path from "path";

puppeteer.use(StealthPlugin());

// =======================
// ⚙️ Cấu hình
// =======================
const COFFEE_REGIONS = [
    { name: "Lâm Đồng", url: "https://giacaphe.com/gia-ca-phe-lam-dong/" },
    { name: "Đắk Lắk", url: "https://giacaphe.com/gia-ca-phe-dak-lak/" },
    { name: "Gia Lai", url: "https://giacaphe.com/gia-ca-phe-gia-lai/" },
    { name: "Đắk Nông", url: "https://giacaphe.com/gia-ca-phe-dak-nong/" },
];
const PEPPER_URL = "https://giacaphe.com/gia-tieu-hom-nay/";
const DURIAN_URL = "https://giasaurieng.net/";

const OUT_DIR = path.join(process.cwd(), "scraped");
const DATA_FILE = path.join(OUT_DIR, "all_regions.json");
const WAIT_MS = 8000;

// =======================
// Tiện ích
// =======================
async function ensureOutDir() {
    await fs.mkdir(OUT_DIR, { recursive: true });
}

async function loadExistingData() {
    try {
        const text = await fs.readFile(DATA_FILE, "utf-8");
        const data = JSON.parse(text);
        if (!data.coffeeDate) data.coffeeDate = null;
        if (!data.pepperDate) data.pepperDate = null;
        return data;
    } catch {
        return {
            scrapedAt: new Date().toISOString(),
            coffeeDate: null,
            pepperDate: null,
            regions: [],
        };
    }
}

function calcTrend(prev, curr) {
    if (curr > prev) return "↑ tăng";
    if (curr < prev) return "↓ giảm";
    return "=";
}

function mergeRegionData(oldRegion, newRegion) {
    if (!oldRegion) return newRegion;

    const existingRecords = new Set(
        oldRegion.data.map(d => `${d["Ngày"]}|${d.priceValue}`)
    );

    const mergedData = [
        ...newRegion.data.filter(d => !existingRecords.has(`${d["Ngày"]}|${d.priceValue}`)),
        ...oldRegion.data,
    ];

    mergedData.sort((a, b) => {
        const [da, ma, ya] = a["Ngày"].split("/").map(Number);
        const [db, mb, yb] = b["Ngày"].split("/").map(Number);
        const dateA = new Date(ya, ma - 1, da);
        const dateB = new Date(yb, mb - 1, db);
        if (dateA - dateB === 0) return b.time.localeCompare(a.time);
        return dateB - dateA;
    });

    return { ...oldRegion, data: mergedData };
}

// =======================
// Cào giá cà phê
// =======================
async function scrapeCoffeeRegion(page, region, existing) {
    const fullName = `Cà phê ${region.name}`;
    console.log(`\nCào ${fullName} — ${region.url}`);

    try {
        await page.goto(region.url, { waitUntil: "domcontentloaded", timeout: 60000 });
        await new Promise(r => setTimeout(r, WAIT_MS));

        const rows = await page.$$eval("table.price-table tbody tr", (trs) => {
            const getContent = (el) => {
                if (!el) return null;
                const txt = el.innerText?.trim();
                if (txt) return txt;
                const after = window.getComputedStyle(el, "::after")?.content?.replace(/"/g, "").trim();
                return after && after !== "''" ? after : null;
            };

            return [...trs]
                .map(tr => {
                    const tds = tr.querySelectorAll("td");
                    if (tds.length < 3) return null;
                    const Ngày = getContent(tds[0]?.querySelector("span") || tds[0]) || "";
                    const Giá = getContent(tds[1]?.querySelector("span") || tds[1]);
                    const ThayĐổi = getContent(tds[2]?.querySelector("span") || tds[2]) || "";
                    if (!Giá) return null;
                    const priceValue = parseInt(Giá.replace(/\D/g, "")) || 0;
                    return { Ngày, Giá, ThayĐổi, priceValue, time: new Date().toLocaleTimeString("vi-VN") };
                })
                .filter(Boolean);
        });

        if (!rows.length) {
            console.log(`⚠️ Không tìm thấy dữ liệu cho ${fullName}`);
            return;
        }

        const latest = rows[0].priceValue || 0;
        const oldRegion = existing.regions.find(r => r.region === region.name);
        const prev = oldRegion?.data?.[0]?.priceValue || 0;
        const trend = calcTrend(prev, latest);

        const newRegion = { name: fullName, region: region.name, data: rows, trend };

        if (oldRegion) {
            const merged = mergeRegionData(oldRegion, newRegion);
            merged.trend = trend;
            Object.assign(oldRegion, merged);
        } else {
            existing.regions.push(newRegion);
        }

        console.table(rows.slice(0, 5));
        console.log(`📊 ${fullName}: ${latest} (${trend})`);
    } catch (err) {
        console.error(`❌ Lỗi khi cào ${region.name}:`, err.message);
    }
}

async function scrapeCoffee(page, existing) {
    for (const region of COFFEE_REGIONS) {
        await scrapeCoffeeRegion(page, region, existing);
    }

    try {
        const allDates = existing.regions
            .filter(r => r.name.startsWith("Cà phê"))
            .flatMap(r => r.data.map(d => d["Ngày"]));
        if (allDates.length) {
            existing.coffeeDate = allDates.sort((a, b) => {
                const [da, ma, ya] = a.split("/").map(Number);
                const [db, mb, yb] = b.split("/").map(Number);
                return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
            })[0];
        }
    } catch (err) {
        console.error("⚠️ Không thể xác định ngày mới nhất cà phê:", err.message);
    }
}

// =======================
// Cào giá tiêu
// =======================
async function scrapePepper(page, existing) {
    console.log(`\nBắt đầu cào giá tiêu — ${PEPPER_URL}`);

    try {
        await page.goto(PEPPER_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        await new Promise(r => setTimeout(r, WAIT_MS));

        const pageText = await page.evaluate(() => document.body?.innerText || "");
        const fallbackTitle = await page.$eval("h1", el => el.innerText.trim()).catch(() => "");
        const dateMatch = (pageText || fallbackTitle).match(/(\d{2}\/\d{2}\/\d{4})/);
        const ngay = dateMatch ? dateMatch[1] : new Date().toLocaleDateString("vi-VN");

        const rows = await page.$$eval("#gia-tieu-hom-nay-body table.price-table tbody tr", trs =>
            trs.map(tr => {
                const tds = tr.querySelectorAll("td");
                const KhuVuc = tds[0]?.innerText.trim() || "";
                const GiaMua = tds[1]?.innerText.trim() || "";
                const ThayDoi = tds[2]?.innerText.trim() || "";
                const priceValue = parseInt(GiaMua.replace(/\D/g, "")) || 0;
                return { KhuVuc, GiaMua, ThayDoi, priceValue };
            })
        );

        console.table(rows);
        console.log(`📈 Cào ${rows.length} vùng tiêu ngày ${ngay}`);

        for (const r of rows) {
            const fullName = `Tiêu ${r.KhuVuc}`;
            const oldRegion = existing.regions.find(x => x.region === r.KhuVuc && x.name.startsWith("Tiêu"));

            const newRegion = {
                name: fullName,
                region: r.KhuVuc,
                data: [{ Ngày: ngay, Giá: r.GiaMua, ThayĐổi: r.ThayDoi, priceValue: r.priceValue, time: new Date().toLocaleTimeString("vi-VN") }],
            };

            const latest = r.priceValue;
            const prev = oldRegion?.data?.[0]?.priceValue || 0;
            newRegion.trend = calcTrend(prev, latest);

            if (oldRegion) {
                const merged = mergeRegionData(oldRegion, newRegion);
                merged.trend = newRegion.trend;
                Object.assign(oldRegion, merged);
            } else {
                existing.regions.push(newRegion);
            }
        }

        const allDates = existing.regions
            .filter(r => r.name.startsWith("Tiêu"))
            .flatMap(r => r.data.map(d => d["Ngày"]));
        if (allDates.length) {
            existing.pepperDate = allDates.sort((a, b) => {
                const [da, ma, ya] = a.split("/").map(Number);
                const [db, mb, yb] = b.split("/").map(Number);
                return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
            })[0];
        }
    } catch (err) {
        console.error("❌ Lỗi khi cào giá tiêu:", err.message);
    }
}

// =======================
// Cào giá sầu riêng 
// =======================
async function scrapeDurian(page, existing) {
    console.log(`\nBắt đầu cào giá sầu riêng — ${DURIAN_URL}`);

    try {
        await page.goto(DURIAN_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
        await new Promise(r => setTimeout(r, WAIT_MS));

        // -------------------------
        // Lấy ngày từ tiêu đề
        // -------------------------
        const pageText = await page.evaluate(() => document.body?.innerText || "");
        const fallbackTitle = await page.$eval("h1", el => el.innerText.trim()).catch(() => "");
        const dateMatch = (pageText || fallbackTitle).match(/(\d{2}\/\d{2}\/\d{4})/);
        const ngay = dateMatch ? dateMatch[1] : new Date().toLocaleDateString("vi-VN");

        // -------------------------
        // Lấy bảng giá theo khu vực
        // Trang giasaurieng.net có cột:
        // Loại | Miền Tây Nam bộ | Miền Đông Nam bộ | Tây Nguyên
        // -------------------------
        const rows = await page.$$eval("table tr", trs => {
            const parseRange = (raw) => {
                const text = (raw || "").replace(/\s+/g, " ").trim();
                if (!text) return { text: "", priceValue: 0 };
                const nums = (text.match(/\d[\d.]*/g) || [])
                    .map(n => Number(n.replace(/\./g, "")))
                    .filter(n => Number.isFinite(n) && n > 0);
                return {
                    text,
                    priceValue: nums.length ? Math.max(...nums) : 0,
                };
            };

            const toRegionEntries = (typeName, tds) => {
                const regions = [
                    { key: "Miền Tây Nam bộ", value: tds[1]?.innerText },
                    { key: "Miền Đông Nam bộ", value: tds[2]?.innerText },
                    { key: "Tây Nguyên", value: tds[3]?.innerText },
                ];

                return regions
                    .map(({ key, value }) => {
                        const parsed = parseRange(value || "");
                        if (!parsed.priceValue) return null;
                        return {
                            Loai: typeName,
                            KhuVuc: key,
                            Gia: parsed.text,
                            priceValue: parsed.priceValue,
                        };
                    })
                    .filter(Boolean);
            };

            return trs.flatMap(tr => {
                const tds = [...tr.querySelectorAll("td")];
                if (tds.length < 4) return [];

                const rawType = (tds[0]?.innerText || "").trim();
                if (!rawType || /đơn vị/i.test(rawType)) return [];
                if (!/sầu riêng/i.test(rawType)) return [];

                return toRegionEntries(rawType, tds);
            });
        });

        console.table(rows);

        // -------------------------
        // Ghi từng loại
        // -------------------------
        for (const r of rows) {
            const regionName = `Sầu riêng ${r.Loai} - ${r.KhuVuc}`;
            const regionKey = `${r.Loai}|${r.KhuVuc}`;

            const oldRegion = existing.regions.find(x => x.region === regionKey);

            // >>> Đúng format CHUẨN theo yêu cầu <<<
            const newRecord = {
                Ngày: ngay,
                Giá: r.Gia,
                ThayĐổi: "0",
                priceValue: r.priceValue,
                time: new Date().toLocaleTimeString("vi-VN")
            };

            const newRegion = {
                name: regionName,
                region: regionKey,
                data: [newRecord],
                trend: calcTrend(
                    oldRegion?.data?.[0]?.priceValue || 0,
                    newRecord.priceValue
                )
            };

            if (oldRegion) {
                const merged = mergeRegionData(oldRegion, newRegion);
                merged.trend = newRegion.trend;
                Object.assign(oldRegion, merged);
            } else {
                existing.regions.push(newRegion);
            }
        }

        // -------------------------
        // Lấy ngày mới nhất
        // -------------------------
        const allDates = existing.regions
            .filter(r => r.name.startsWith("Sầu riêng"))
            .flatMap(r => r.data.map(d => d["Ngày"]));

        if (allDates.length) {
            existing.durianDate = allDates.sort((a, b) => {
                const [da, ma, ya] = a.split("/").map(Number);
                const [db, mb, yb] = b.split("/").map(Number);
                return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
            })[0];
        }

    } catch (err) {
        console.error("❌ Lỗi khi cào sầu riêng:", err.message);
    }
}

// =======================
// Chạy tất cả
// =======================
(async () => {
    await ensureOutDir();
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const page = await browser.newPage();

    const existing = await loadExistingData();

    await scrapeCoffee(page, existing);
    await scrapePepper(page, existing);
    await scrapeDurian(page, existing);

    existing.scrapedAt = new Date().toISOString();
    existing.regionCount = existing.regions.length;

    const isTemp = process.argv.includes("--temp");
    const dataFile = path.join("scraped", isTemp ? "temp_check.json" : "all_regions.json");

    await fs.writeFile(dataFile, JSON.stringify(existing, null, 2), "utf-8");
    console.log(`💾 Đã cập nhật file tổng hợp: ${dataFile}`);

    await browser.close();
    console.log("✅ Hoàn tất toàn bộ quá trình cào.\n");
})();
