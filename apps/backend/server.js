import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import * as cron from "node-cron";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

// Import routes
import authRoutes from "./routes/auth.js";
import productRoutes, { ioRef } from "./routes/products.js";
import userRoutes from "./routes/users.js";
import alertRoutes from "./routes/alerts.js";
import newsRoutes from "./routes/news.js";
import communityRoutes, { ioRef as communityIoRef } from "./routes/community.js";
import favoritesRouter from "./routes/favorites.js";
import costRoutes from "./routes/costs.js";
import chatbotRoutes from "./routes/chatbot.js";
import statsRoutes from "./routes/stats.js";
import chatRouter from "./routes/chat.js";
import pool from "./db.js";
import { syncProducts } from "./cron/syncProducts.js";
import { authenticateToken, isAdmin } from "./middleware/auth.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("io", io);
communityIoRef.io = io;
ioRef.io = io; // Cho phép emit từ router

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/users", userRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/favorites", favoritesRouter);
app.use("/api/costs", costRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/stats", statsRoutes); 
app.use("/api/chat", chatRouter);

io.use((socket, next) => {
  try {
    const rawToken = socket.handshake.auth?.token;
    if (!rawToken) return next();

    const token = rawToken.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;
    socket.user = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key-change-in-production"
    );
    return next();
  } catch {
    return next(new Error("INVALID_SOCKET_TOKEN"));
  }
});

app.post("/api/admin/scrape-trigger", authenticateToken, isAdmin, async (req, res) => {
  try {
    if (isScraping) {
      return res.status(409).json({ error: "Hệ thống đang cào dữ liệu, vui lòng đợi." });
    }
    // Chạy bất đồng bộ, không chờ kết quả
    checkAndScrapeIfNeeded();
    res.json({ message: "✅ Đã kích hoạt Scraper. Dữ liệu sẽ được cập nhật trong vài phút." });
  } catch (err) {
    console.error("❌ Lỗi kích hoạt scraper:", err);
    res.status(500).json({ error: "Lỗi kích hoạt Scraper" });
  }
});

io.on("connection", async (socket) => {
  if (socket.user?.id) {
    socket.join(`user:${socket.user.id}`);
  }
  console.log("✅ Client connected:", socket.id);
  socket.onAny((event, data) => {
    console.log("📥 nhận event bất kỳ hihihi:", event, data);
  });
  try {
    const [rows] = await pool.query(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `);
    socket.emit("initData", rows);
  } catch (err) {
    console.error("❌ Lỗi khi gửi dữ liệu khởi tạo:", err);
  }
  socket.on("disconnect", () => console.log("🔴 Client disconnected:", socket.id));
});

async function sendEmail(to, productName, currentPrice, alert) {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"AgriTrend" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: `🌾 Giá ${productName} đã ${alert.alert_condition === "above" ? "vượt lên" : "giảm xuống"
      } ${alert.target_price}`,
    html: `
      <p>Giá <b>${productName}</b> hiện tại là <b>${currentPrice} ₫</b>.</p>
      <p>Đã ${alert.alert_condition === "above" ? "cao hơn" : "thấp hơn"
      } mức bạn đặt là <b>${alert.target_price} ₫</b>.</p>
    `,
  });
}

cron.schedule("*/5 * * * *", async () => {
  console.log("⏱️ Kiểm tra cảnh báo giá...");
  try {
    const [alerts] = await pool.query("SELECT * FROM price_alerts WHERE notified = FALSE");

    for (const alert of alerts) {
      const [product] = await pool.query(
        "SELECT name, currentPrice FROM products WHERE id = ?",
        [alert.product_id]
      );
      if (!product[0]) continue;
      const currentPrice = product[0].currentPrice;

      if (
        (alert.alert_condition === "above" && currentPrice > alert.target_price) ||
        (alert.alert_condition === "below" && currentPrice < alert.target_price)
      ) {
        try {
          await sendEmail(alert.email, product[0].name, currentPrice, alert);
          await pool.query("UPDATE price_alerts SET notified = TRUE WHERE id = ?", [alert.id]);
          console.log(`📩 Gửi mail đến ${alert.email} cho sản phẩm ${product[0].name}`);
        } catch (mailError) {
          if (mailError.message === "SMTP_NOT_CONFIGURED") {
            console.warn("⚠️ Bỏ qua gửi email cảnh báo: SMTP chưa cấu hình.");
          } else {
            console.error("❌ Lỗi gửi email cảnh báo:", mailError.message);
          }
        }
      }
    }
  } catch (error) {
    console.error("❌ Lỗi khi kiểm tra cảnh báo giá:", error.message);
  }
});

// Cấu hình đường dẫn file scrape
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRAPED_FILE = path.join(process.cwd(), "scraped/all_regions.json");
const TEMP_FILE = path.join(__dirname, "./scraped/temp_check.json");
const scrapePath = path.join(__dirname, "./scraped/scrape.js");

let isScraping = false; // Tránh chạy trùng

// 🔧 Chuẩn hóa ngày
function normalizeDate(str) {
  if (!str) return "";
  if (str.includes("-")) return str;
  const [d, m, y] = str.split("/").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function checkAndScrapeIfNeeded() {
  if (isScraping) {
    console.log("⚠️ Đang chạy tiến trình cào hoặc đồng bộ, bỏ qua lần này.");
    return;
  }

  isScraping = true;
  console.log(`\n🌅 [${new Date().toLocaleString("vi-VN")}] Kiểm tra dữ liệu mới...`);

  try {
    if (fs.existsSync(TEMP_FILE)) {
      fs.unlinkSync(TEMP_FILE);
      console.log("🧹 Đã xóa file tạm cũ temp_check.json.");
    }

    const oldData = fs.existsSync(SCRAPED_FILE)
      ? JSON.parse(fs.readFileSync(SCRAPED_FILE, "utf8"))
      : { regions: [] };

    // 🚀 Chạy scraper
    await new Promise((resolve, reject) => {
      const scraper = spawn("node", [scrapePath, "--temp"], { shell: true });

      scraper.stdout.on("data", (data) => process.stdout.write(data.toString()));
      scraper.stderr.on("data", (data) => process.stderr.write(data.toString()));

      scraper.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Scraper exited with code ${code}`));
      });
    });

    if (!fs.existsSync(TEMP_FILE)) {
      console.log("⚠️ Không có dữ liệu mới sau khi cào tạm.");
      return;
    }

    const newData = JSON.parse(fs.readFileSync(TEMP_FILE, "utf8"));
    console.log("📦 Đã cào xong dữ liệu tạm, bắt đầu merge chuẩn...");

    for (const region of newData.regions) {
      const uniqueKey = `${region.name}###${region.region}`;
      // name giúp phân biệt Cà phê & Tiêu dù cùng region

      let oldRegion = oldData.regions.find(
        (r) => `${r.name}###${r.region}` === uniqueKey
      );

      if (!oldRegion) {
        // console.log(`⏩ [Scraper] Bỏ qua vùng mới phát hiện: ${region.name} (${region.region})`);
        continue;
      }

      // CHỈ so sánh Ngày + Giá, bỏ time
      const oldSet = new Set(
        oldRegion.data.map(d => `${normalizeDate(d["Ngày"])}-${d.priceValue}`)
      );

      const newItems = region.data.filter(d => {
        const key = `${normalizeDate(d["Ngày"])}-${d.priceValue}`;
        return !oldSet.has(key);
      });



      if (newItems.length > 0) {
        //console.log(`✅ Cập nhật ${region.name} (${region.region}): +${newItems.length} dòng`);
        console.log(`✅ Cập nhật ${region.name} (${region.region}): +${newItems.length} bản ghi mới (bao gồm mốc giờ)`);
        // oldRegion.data.push(...newItems);
        oldRegion.data.unshift(...newItems);
      } else {
        console.log(`📅 Không thay đổi: ${region.name} (${region.region})`);
      }

      oldRegion.data = removeDuplicateRows(oldRegion.data);
    }

    oldData.scrapedAt = new Date().toISOString();
    fs.writeFileSync(SCRAPED_FILE, JSON.stringify(oldData, null, 2), "utf8");
    console.log("💾 Đã ghi all_regions.json chuẩn (không trùng, không lẫn loại).");

    if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);

    console.log("✅ Đồng bộ DB...");
    await syncProducts(io);

  } catch (err) {
    console.error("❌ Lỗi checkAndScrapeIfNeeded:", err);
  } finally {
    isScraping = false;
  }
}

// hàm loại trùng tuyệt đối
function removeDuplicateRows(arr) {
  const map = new Map();
  arr.forEach(i => {
    const key = `${normalizeDate(i["Ngày"])}-${i.priceValue}`;
    map.set(key, i);
  });
  return Array.from(map.values());
}

(async () => {
  await checkAndScrapeIfNeeded();
})();

// ⏱️ Cron chạy mỗi 5 phút, delay 1 phút để tránh trùng
setTimeout(() => {
  cron.schedule("0 */8 * * *", async () => {
    await checkAndScrapeIfNeeded();
  });
  console.log("⏱️ Cron kiểm tra dữ liệu đã bật (chạy mỗi 5 phút).");
}, 60_000);

const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ MySQL connected!");
    server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  } catch (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  }
};
startServer();
