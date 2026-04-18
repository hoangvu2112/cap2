// ============================
// Đồng bộ dữ liệu sản phẩm có real-time emit
// ============================

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import fs from "fs";
import pool from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const DATA_PATH = path.join(__dirname, "../scraped/all_regions.json");

export async function syncProducts(io) {
    console.log("🚀 Bắt đầu đồng bộ dữ liệu...");

    if (!fs.existsSync(DATA_PATH)) {
        console.error("❌ Không tìm thấy file dữ liệu:", DATA_PATH);
        return;
    }

    const jsonData = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    const regions = jsonData.regions || [];

    for (const regionObj of regions) {
        const regionName = regionObj.region || "Không rõ vùng";
        const rows = regionObj.data || [];
        if (!rows.length) continue;

        let categoryName = "Cà phê";
        const lowerName = (regionObj.name || "").toLowerCase();
        if (lowerName.includes("tiêu")) {
            categoryName = "Tiêu";
        } else if (lowerName.includes("sầu riêng") || lowerName.includes("durian")) {
            categoryName = "Sầu riêng";
        }

        const [catRows] = await pool.query("SELECT id FROM categories WHERE name = ?", [categoryName]);
        let categoryId;
        if (catRows.length > 0) categoryId = catRows[0].id;
        else {
            const [insertCat] = await pool.query("INSERT INTO categories (name) VALUES (?)", [categoryName]);
            categoryId = insertCat.insertId;
            console.log(`🆕 Thêm category mới: ${categoryName}`);
        }

        const name = `${regionObj.name}`;

        const sortedRows = rows
            .map(r => ({
                ...r,
                date: parseDate(r.Ngày),
                // Ưu tiên dùng priceValue đã parse sẵn từ scraper (xử lý giá dạng khoảng "60.000 – 65.000")
                // Nếu không có thì mới parse lại từ chuỗi Giá
                priceValue: r.priceValue || parsePriceString(r.Giá),
            }))
            .sort((a, b) => b.date - a.date);

        const [exists] = await pool.query("SELECT * FROM products WHERE name = ?", [name]);

        if (exists.length === 0) {
            // ⏩ [Skip] Bỏ qua vì không có trong Database (Chế độ kiểm soát chặt chẽ)
            // console.log(`⏩ [Sync] Bỏ qua sản phẩm mới: ${name} (Region: ${regionName})`);
            continue;
        } else {
            // 🔁 Cập nhật sản phẩm đã có
            const product = exists[0];
            const productId = product.id;

            const [history] = await pool.query(
                "SELECT DATE(updated_at) as date FROM price_history WHERE product_id = ? ORDER BY updated_at DESC",
                [productId]
            );
            const existingDates = new Set(history.map(h => formatDate(h.date)));

            let newDatesAdded = 0;
            for (const item of sortedRows) {
                const dateStr = formatDate(item.date);
                if (!existingDates.has(dateStr)) {
                    await pool.query(
                        "INSERT INTO price_history (product_id, price, updated_at) VALUES (?, ?, ?)",
                        [productId, item.priceValue, item.date]
                    );
                    newDatesAdded++;
                }
            }

            const [latestHistory] = await pool.query(
                `SELECT price FROM price_history WHERE product_id = ? ORDER BY updated_at DESC LIMIT 2`,
                [productId]
            );
            const currentPrice = latestHistory[0]?.price || product.currentPrice;
            const previousPrice = latestHistory[1]?.price || currentPrice;
            const trend = calcTrend(previousPrice, currentPrice);

            if (
                currentPrice !== product.currentPrice ||
                previousPrice !== product.previousPrice ||
                newDatesAdded > 0
            ) {
                await pool.query(
                    `UPDATE products 
           SET previousPrice=?, currentPrice=?, trend=?, lastUpdate=NOW() 
           WHERE id=?`,
                    [previousPrice, currentPrice, trend, productId]
                );

                console.log(`🔄 ${name}: ${previousPrice} → ${currentPrice} (${trend}) | +${newDatesAdded} mốc mới`);

                if (io) {
                    const [updatedRows] = await pool.query("SELECT * FROM products WHERE id = ?", [productId]);
                    const updated = updatedRows[0];

                    // 🔢 Ép kiểu về số và format lại object gọn gàng
                    const updatedProduct = {
                        ...updated,
                        category: updated.category_name,
                        currentPrice: Number(updated.currentPrice),
                        previousPrice: Number(updated.previousPrice),
                    };

                    // 📢 Emit realtime
                    io.emit("productUpdated", updatedProduct);
                    io.emit("priceUpdate", {
                        id: updatedProduct.id,
                        newPrice: updatedProduct.currentPrice,
                        previousPrice: updatedProduct.previousPrice,
                    });
                    if (newDatesAdded > 0) {
                        const [allPrices] = await pool.query(
                            "SELECT price, updated_at FROM price_history WHERE product_id = ? ORDER BY updated_at ASC",
                            [productId]
                        );
                        io.emit("priceHistoryUpdated", {
                            id: updatedProduct.id,
                            history: allPrices.map(p => ({
                                ...p,
                                price: Number(p.price), // cũng nên ép giá lịch sử về số
                            })),
                        });
                    }
                }
            } else {
                console.log(`✅ ${name} không thay đổi (${product.currentPrice})`);
            }
        }
    }

    console.log("🎯 Đồng bộ hoàn tất!");
}

// ============================
// 🧩 Hàm phụ trợ
// ============================
function parseDate(str) {
    if (!str) return new Date();
    const parts = str.split(/[\/\-]/).map(Number);
    if (parts.length !== 3) return new Date();
    const [a, b, c] = parts;
    if (a > 31) return new Date(a, b - 1, c);
    return new Date(c, b - 1, a);
}

function formatDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;
}

function calcTrend(prev, curr) {
    if (curr > prev) return "up";
    if (curr < prev) return "down";
    return "stable";
}

// Parse giá từ chuỗi - xử lý cả giá đơn ("85,000") và giá khoảng ("60.000 – 65.000")
function parsePriceString(priceStr) {
    if (!priceStr) return 0;
    // Tách các số riêng biệt (phân cách bởi – hoặc -)
    const parts = priceStr.split(/[–\-~]/);
    const nums = parts
        .map(p => parseInt(p.replace(/\D/g, ""), 10))
        .filter(n => Number.isFinite(n) && n > 0 && n < 100000000); // Giới hạn hợp lý
    return nums.length ? Math.max(...nums) : 0;
}
