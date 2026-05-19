# So sánh chi tiết các thay đổi từ CHANGELOG_Khang.md

**Nguồn (Bản có thay đổi của Khang):** `d:\cap2`
**Đích (Bản hiện tại cần đồng bộ):** `c:\Users\TechCare\cap2`

> **Lưu ý:** Phần diff hiển thị theo định dạng git: 
> `-` (màu đỏ) là code ở bản hiện tại (đích)
> `+` (màu xanh) là code ở bản của Khang (nguồn, cần được thêm vào)

---

## 📄 File: `apps/backend/db.js` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -74,24 +74,14 @@ const initDB = async () => {
       console.log("✅ Đã thêm cột 'region' vào bảng 'users'.");
     }
 
-    // Đảm bảo cột name_changed_at tồn tại (giới hạn đổi tên)
-    const [nameChangedCol] = await pool.query(`
+    // Đảm bảo cột dealer_expires_at tồn tại (cho cron checkDealerExpiration)
+    const [dealerExpiresCol] = await pool.query(`
       SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
-      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'name_changed_at'
+      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'dealer_expires_at'
     `, [DB_NAME]);
-    if (nameChangedCol.length === 0) {
-      await pool.query("ALTER TABLE users ADD COLUMN name_changed_at DATETIME DEFAULT NULL");
-      console.log("✅ Đã thêm cột 'name_changed_at' vào bảng 'users'.");
-    }
-
-    // Đảm bảo cột name_change_count tồn tại
-    const [nameCountCol] = await pool.query(`
-      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
-      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'name_change_count'
-    `, [DB_NAME]);
-    if (nameCountCol.length === 0) {
-      await pool.query("ALTER TABLE users ADD COLUMN name_change_count INT DEFAULT 0");
-      console.log("✅ Đã thêm cột 'name_change_count' vào bảng 'users'.");
+    if (dealerExpiresCol.length === 0) {
+      await pool.query("ALTER TABLE users ADD COLUMN dealer_expires_at DATETIME DEFAULT NULL");
+      console.log("✅ Đã thêm cột 'dealer_expires_at' vào bảng 'users'.");
     }
 
     const [userCount] = await pool.query("SELECT COUNT(*) AS c FROM users")
@@ -141,7 +131,7 @@ const initDB = async () => {
     category_id INT,
     currentPrice DECIMAL(10,2),
     previousPrice DECIMAL(10,2),
-    unit VARCHAR(50) DEFAULT 'kg',
+    unit VARCHAR(50),
     region VARCHAR(100),
     quantity_available DECIMAL(12,2) DEFAULT 0,
     harvest_start DATE NULL,
@@ -186,7 +176,6 @@ const initDB = async () => {
     await ensureProductColumn("harvest_start", "harvest_start DATE NULL")
     await ensureProductColumn("harvest_end", "harvest_end DATE NULL")
     await ensureProductColumn("farmer_user_id", "farmer_user_id INT NULL")
-    await ensureProductColumn("dealer_visibility_status", "dealer_visibility_status ENUM('visible','hidden') DEFAULT 'visible'")
 
     try {
       await pool.query("ALTER TABLE products ADD CONSTRAINT fk_products_farmer_user FOREIGN KEY (farmer_user_id) REFERENCES users(id) ON DELETE SET NULL")
@@ -396,6 +385,22 @@ const initDB = async () => {
 `)
     console.log("✅ Bảng 'community_likes' đã sẵn sàng.")
 
+    // B-Tree Indexes cho tối ưu query bài viết nổi bật
+    const indexQueries = [
+      // Index composite cho featured posts: lọc theo thời gian + sort theo engagement
+      `CREATE INDEX IF NOT EXISTS idx_posts_created_at ON community_posts(created_at DESC)`,
+      `CREATE INDEX IF NOT EXISTS idx_posts_likes ON community_posts(likes DESC)`,
+      `CREATE INDEX IF NOT EXISTS idx_posts_user_created ON community_posts(user_id, created_at DESC)`,
+      // Index cho đếm comments nhanh (thay vì full scan)
+      `CREATE INDEX IF NOT EXISTS idx_comments_post_deleted ON community_comments(post_id, deleted_at)`,
+      // Index cho likes lookup
+      `CREATE INDEX IF NOT EXISTS idx_likes_post_user ON community_likes(post_id, user_id)`,
+    ]
+    for (const q of indexQueries) {
+      try { await pool.query(q) } catch (e) { /* index đã tồn tại */ }
+    }
+    console.log("✅ B-Tree indexes cho community đã sẵn sàng.")
+
     // Bảng lưu session chat
     await pool.query(`
   CREATE TABLE IF NOT EXISTS direct_message_conversations (
@@ -532,7 +537,7 @@ const initDB = async () => {
         plan_id INT NOT NULL,
         status ENUM('pending_payment','pending_review','approved','rejected','cancelled') NOT NULL DEFAULT 'pending_payment',
         payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
-        payment_ref VARCHAR(120) DEFAULT NULL,
+        payment_ref TEXT DEFAULT NULL,
         note TEXT,
         admin_note TEXT,
         warning_sent BOOLEAN DEFAULT FALSE,
@@ -569,11 +574,18 @@ const initDB = async () => {
     await ensureUpgradeColumn("representative_name", "representative_name VARCHAR(100) DEFAULT NULL");
     await ensureUpgradeColumn("phone_contact", "phone_contact VARCHAR(20) DEFAULT NULL");
     await ensureUpgradeColumn("business_items", "business_items TEXT DEFAULT NULL"); // Các mặt hàng kinh doanh
+    await ensureUpgradeColumn("province", "province VARCHAR(100) DEFAULT NULL"); // Tỉnh/Thành phố
+    await ensureUpgradeColumn("ward", "ward VARCHAR(100) DEFAULT NULL"); // Phường/Xã
+
+    // Nâng cấp cột payment_ref từ VARCHAR(120) lên TEXT (URL MoMo dài)
+    try {
+      await pool.query("ALTER TABLE dealer_upgrade_requests MODIFY COLUMN payment_ref TEXT DEFAULT NULL");
+    } catch (e) { /* ignore nếu đã đúng kiểu */ }
 
-    // Vô hiệu hóa gói cũ (dealer_membership - 60 ngày) và mọi gói không nằm trong danh sách chuẩn
-    await pool.query("UPDATE dealer_plans SET is_active = FALSE WHERE code NOT IN ('dealer_30', 'dealer_90', 'dealer_365')");
+    // Vô hiệu hóa gói membership cũ nếu tồn tại
+    await pool.query("UPDATE dealer_plans SET is_active = FALSE WHERE code = 'dealer_membership'");
 
-    // Đảm bảo 3 gói chuẩn luôn tồn tại và active
+    // Cập nhật/Thêm các gói cước đại lý mới
     const ensureDealerPlan = async (code, name, price, days) => {
       const [rows] = await pool.query("SELECT id FROM dealer_plans WHERE code = ? LIMIT 1", [code]);
       if (rows.length === 0) {
@@ -589,9 +601,9 @@ const initDB = async () => {
       }
     };
 
-    await ensureDealerPlan("dealer_30",  "Gói Đại lý 30 ngày", 100000, 30);
-    await ensureDealerPlan("dealer_90",  "Gói Đại lý 90 ngày", 250000, 90);
-    await ensureDealerPlan("dealer_365", "Gói Đại lý 1 năm",   800000, 365);
+    await ensureDealerPlan("dealer_30", "Gói Đại lý 30 ngày", 100000, 30);
+    await ensureDealerPlan("dealer_90", "Gói Đại lý 90 ngày", 250000, 90);
+    await ensureDealerPlan("dealer_365", "Gói Đại lý 1 năm", 800000, 365);
 
     await pool.query(`
   CREATE TABLE IF NOT EXISTS password_reset_tokens (
@@ -637,23 +649,6 @@ const initDB = async () => {
       console.log("🍀 Đã chèn dữ liệu mẫu vào bảng 'news'.");
     }
 
-    // Bảng lưu metadata PDF đã cào từ thitruongnongsan.gov.vn (chống trùng)
-    await pool.query(`
-      CREATE TABLE IF NOT EXISTS gov_pdf_reports (
-        id INT AUTO_INCREMENT PRIMARY KEY,
-        pdf_url VARCHAR(500) NOT NULL UNIQUE,
-        category VARCHAR(100) NOT NULL,
-        report_number INT,
-        report_date DATE,
-        raw_text LONGTEXT,
-        parsed_json JSON,
-        status ENUM('pending','parsed','error') DEFAULT 'pending',
-        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
-        INDEX idx_gov_pdf_category_date (category, report_date)
-      )
-    `)
-    console.log("✅ Bảng 'gov_pdf_reports' đã sẵn sàng.")
-
     // Bảng yêu cầu mua giữa đại lý và nông dân
     await pool.query(`
       CREATE TABLE IF NOT EXISTS purchase_requests (
@@ -850,108 +845,45 @@ const initDB = async () => {
     `)
     console.log("✅ Bảng 'chatbot_chunks' đã sẵn sàng.")
 
-    // ===== CÁC BẢNG MỚI CHO TÍNH NĂNG VÍ NÔNG XU & NGUỒN HÀNG =====
-
+    // Bảng dealer_locations: lưu địa chỉ + tọa độ của đại lý (hiển thị trên bản đồ)
     await pool.query(`
-      CREATE TABLE IF NOT EXISTS user_supply_listings (
+      CREATE TABLE IF NOT EXISTS dealer_locations (
         id INT AUTO_INCREMENT PRIMARY KEY,
-        user_id INT NOT NULL,
-        product_id INT NOT NULL,
-        quantity_available DECIMAL(12,2) NOT NULL,
-        harvest_start DATE,
-        harvest_end DATE,
-        supply_status ENUM('available', 'soon', 'partial', 'sold') DEFAULT 'available',
-        note TEXT,
+        user_id INT NOT NULL UNIQUE,
+        branch_name VARCHAR(255) DEFAULT NULL,
+        region_label VARCHAR(100) DEFAULT NULL,
+        address TEXT NOT NULL,
+       
... (diff quá dài, đã bị cắt bớt để dễ đọc)
```
</details>

## 📄 File: `apps/backend/server.js` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -20,15 +20,12 @@ import newsRoutes from "./routes/news.js";
 import communityRoutes, { ioRef as communityIoRef } from "./routes/community.js";
 import favoritesRouter from "./routes/favorites.js";
 import costRoutes from "./routes/costs.js";
-import chatbotRoutes from "./routes/chatbot.js";
+// chatbotRoutes removed — merged into /api/chat (same module, was duplicate)
 import statsRoutes from "./routes/stats.js";
 import chatRouter from "./routes/chat.js";
 import purchaseRequestRoutes from "./routes/purchaseRequests.js";
 import dealerUpgradeRoutes from "./routes/dealerUpgrade.js";
-import listingBoostsRoutes from "./routes/listingBoosts.js";
-import dealerSuppliesRoutes from "./routes/dealerSupplies.js";
-import ordersRoutes from "./routes/orders.js";
-import walletRoutes from "./routes/wallet.js";
+import dealerLocationsRoutes from "./routes/dealerLocations.js";
 import pool from "./db.js";
 const __filename = fileURLToPath(import.meta.url);
 const __dirname = path.dirname(__filename);
@@ -36,7 +33,6 @@ const __dirname = path.dirname(__filename);
 import { syncProducts } from "./cron/syncProducts.js";
 import { syncChatbotKnowledge } from "./cron/syncChatbot.js";
 import { checkDealerExpiration } from "./cron/checkDealerExpiration.js";
-import { scrapePdfReports } from "./scraped/scrapePdf.js";
 import { authenticateToken, isAdmin } from "./middleware/auth.js";
 
 dotenv.config();
@@ -50,7 +46,23 @@ const io = new Server(server, {
 app.use(cors());
 app.use(express.json());
 app.use(express.urlencoded({ extended: true }));
-app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
+// Protected uploads — phải đăng nhập mới xem được ảnh
+app.use("/uploads", (req, res, next) => {
+  // Lấy token từ header hoặc query param (img src không gửi được header)
+  const authHeader = req.headers["authorization"]
+  const token = (authHeader && authHeader.split(" ")[1]) || req.query.token
+  
+  if (!token) {
+    return res.status(401).json({ error: "Cần đăng nhập để xem ảnh" })
+  }
+  
+  try {
+    jwt.verify(token, process.env.JWT_SECRET || "your-secret-key-change-in-production")
+    next()
+  } catch {
+    return res.status(403).json({ error: "Token không hợp lệ" })
+  }
+}, express.static(path.join(__dirname, "uploads")));
 
 app.set("io", io);
 communityIoRef.io = io;
@@ -65,15 +77,12 @@ app.use("/api/news", newsRoutes);
 app.use("/api/community", communityRoutes);
 app.use("/api/favorites", favoritesRouter);
 app.use("/api/costs", costRoutes);
-app.use("/api/chatbot", chatbotRoutes);
+// /api/chatbot removed — use /api/chat instead (same chatbot module)
 app.use("/api/stats", statsRoutes); 
 app.use("/api/chat", chatRouter);
 app.use("/api/purchase-requests", purchaseRequestRoutes);
 app.use("/api/dealer-upgrade", dealerUpgradeRoutes);
-app.use("/api/listing-boosts", listingBoostsRoutes);
-app.use("/api/dealer-supplies", dealerSuppliesRoutes);
-app.use("/api/orders", ordersRoutes);
-app.use("/api/wallet", walletRoutes);
+app.use("/api/dealer-locations", dealerLocationsRoutes);
 
 io.use((socket, next) => {
   try {
@@ -251,7 +260,8 @@ async function checkAndScrapeIfNeeded() {
       );
 
       if (!oldRegion) {
-        // console.log(`⏩ [Scraper] Bỏ qua vùng mới phát hiện: ${region.name} (${region.region})`);
+        console.log(`✨ [Scraper] Phát hiện vùng mới: ${region.name} (${region.region}). Đang thêm vào hệ thống.`);
+        oldData.regions.push(region);
         continue;
       }
 
@@ -310,15 +320,15 @@ function removeDuplicateRows(arr) {
 
 (async () => {
   await checkAndScrapeIfNeeded();
-  await checkDealerExpiration(io);
+  await checkDealerExpiration();
 })();
 
 // ⏱️ Cron chạy mỗi 5 phút, delay 1 phút để tránh trùng
 setTimeout(() => {
-  cron.schedule("*/30 * * * *", async () => {
+  cron.schedule("0 * * * *", async () => {
     await checkAndScrapeIfNeeded();
   });
-  console.log("⏱️ Cron kiểm tra dữ liệu đã bật (chạy mỗi 30 phút).");
+  console.log("⏱️ Cron kiểm tra dữ liệu đã bật (chạy mỗi giờ).");
 
   cron.schedule("17 */6 * * *", async () => {
     await syncChatbotKnowledge({ reason: "scheduled", io });
@@ -326,18 +336,9 @@ setTimeout(() => {
   console.log("⏱️ Cron đồng bộ chatbot đã bật (chạy mỗi 6 giờ).")
 
   cron.schedule("0 * * * *", async () => {
-    await checkDealerExpiration(io);
+    await checkDealerExpiration();
   });
   console.log("⏱️ Cron kiểm tra gia hạn đại lý đã bật (chạy mỗi giờ).")
-
-  // Cào PDF báo cáo tuần từ thitruongnongsan.gov.vn — mỗi Chủ nhật lúc 6h sáng
-  cron.schedule("0 6 * * 0", async () => {
-    console.log("📄 [Cron] Bắt đầu cào PDF báo cáo tuần...");
-    try { await scrapePdfReports(); } catch (err) {
-      console.error("❌ [Cron] Lỗi cào PDF:", err.message);
-    }
-  });
-  console.log("⏱️ Cron cào PDF báo cáo tuần đã bật (Chủ nhật 6h sáng).")
 }, 60_000);
 
 const PORT = process.env.PORT || 5000;

```
</details>

## 📄 File: `apps/backend/.env` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -1,7 +1,7 @@
 DB_HOST=localhost
 DB_USER=root
-DB_PASS=12345
-DB_NAME=agrirend
+DB_PASS=123456
+DB_NAME=agritrend
 PORT=5000
 JWT_SECRET=mysecretkey
 GOOGLE_CLIENT_ID=811971060912-9io1ptn4a28943le0rivg6iakei905ji.apps.googleusercontent.com

```
</details>

## 📄 File: `apps/backend/routes/dealerUpgrade.js` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -3,9 +3,6 @@ import pool from "../db.js"
 import { authenticateToken, isAdmin } from "../middleware/auth.js"
 import dotenv from "dotenv"
 import path from "path"
-import crypto from "crypto"
-import axios from "axios"
-import { createMomoPayment } from "../services/momoService.js"
 
 // Nạp .env với đường dẫn tuyệt đối để chắc chắn luôn tìm thấy
 dotenv.config({ path: path.join(process.cwd(), "apps/backend/.env") })
@@ -40,8 +37,6 @@ if (!isSimulate) {
 
 const OPEN_REQUEST_STATUSES = ["pending_payment", "pending_review"]
 
-// MoMo calls are handled by `apps/backend/services/momoService.js`
-
 async function getOpenRequestForUser(userId) {
   const [rows] = await pool.query(
     `
@@ -65,7 +60,6 @@ router.get("/plans", authenticateToken, async (_req, res) => {
       `
         SELECT id, code, name, price_vnd, duration_days, is_active
         FROM dealer_plans
-        WHERE is_active = TRUE
         ORDER BY price_vnd ASC, id ASC
       `
     )
@@ -74,9 +68,9 @@ router.get("/plans", authenticateToken, async (_req, res) => {
     if (rows.length === 0) {
       console.log("--- [DEBUG] DB trả về 0 gói, đang dùng dữ liệu dự phòng ---");
       rows = [
-        { id: 2, code: 'dealer_30',  name: 'Gói Đại lý 30 ngày', price_vnd: 100000, duration_days: 30,  is_active: 1 },
-        { id: 3, code: 'dealer_90',  name: 'Gói Đại lý 90 ngày', price_vnd: 250000, duration_days: 90,  is_active: 1 },
-        { id: 4, code: 'dealer_365', name: 'Gói Đại lý 1 năm',   price_vnd: 800000, duration_days: 365, is_active: 1 },
+        { id: 2, code: 'dealer_30', name: 'Gói Đại lý 30 ngày', price_vnd: 100000, duration_days: 30, is_active: 1 },
+        { id: 3, code: 'dealer_90', name: 'Gói Đại lý 90 ngày', price_vnd: 250000, duration_days: 90, is_active: 1 },
+        { id: 4, code: 'dealer_365', name: 'Gói Đại lý 1 năm', price_vnd: 800000, duration_days: 365, is_active: 1 }
       ];
     }
 
@@ -130,7 +124,8 @@ router.post("/apply", authenticateToken, async (req, res) => {
       representative_name,
       phone_contact,
       business_items,
-      category_ids,
+      province,
+      ward,
       note
     } = req.body
 
@@ -143,10 +138,13 @@ router.post("/apply", authenticateToken, async (req, res) => {
       return res.status(400).json({ error: "Vui lòng cung cấp đầy đủ thông tin pháp lý đại lý" })
     }
 
-    // Validation danh mục thu mua bắt buộc
-    const parsedCategoryIds = Array.isArray(category_ids) ? category_ids.map(Number).filter(Boolean) : []
-    if (parsedCategoryIds.length === 0) {
-      return res.status(400).json({ error: "Vui lòng chọn ít nhất 1 danh mục nông sản thu mua" })
+    const [[plan]] = await pool.query(
+      "SELECT id, name, price_vnd, duration_days, is_active FROM dealer_plans WHERE id = ? LIMIT 1",
+      [planId]
+    )
+
+    if (!plan || !plan.is_active) {
+      return res.status(404).json({ error: "Gói đại lý không tồn tại hoặc đã ngưng" })
     }
 
     const openRequest = await getOpenRequestForUser(req.user.id)
@@ -160,18 +158,20 @@ router.post("/apply", authenticateToken, async (req, res) => {
     const [result] = await pool.query(
       `
         INSERT INTO dealer_upgrade_requests
-          (user_id, plan_id, status, payment_status, business_name, tax_code, business_address, representative_name, phone_contact, business_items, note)
-        VALUES (?, ?, 'pending_payment', 'unpaid', ?, ?, ?, ?, ?, ?, ?)
+          (user_id, plan_id, status, payment_status, business_name, tax_code, business_address, representative_name, phone_contact, business_items, province, ward, note)
+        VALUES (?, ?, 'pending_payment', 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?)
       `,
       [
-        req.user.id,
-        planId,
+        req.user.id, 
+        planId, 
         business_name.trim(), 
         tax_code.trim(), 
         business_address.trim(), 
         representative_name.trim(), 
         phone_contact.trim(), 
-        business_items?.trim() || null, 
+        business_items?.trim() || null,
+        province?.trim() || null,
+        ward?.trim() || null,
         note?.trim() || null
       ]
     )
@@ -190,68 +190,41 @@ router.post("/apply", authenticateToken, async (req, res) => {
       [result.insertId]
     )
 
-    // Lưu danh mục thu mua vào bảng dealer_categories
-    if (parsedCategoryIds.length > 0) {
-      // Xóa danh mục cũ (nếu có) rồi insert mới
-      await pool.query("DELETE FROM dealer_categories WHERE user_id = ?", [req.user.id])
-      const categoryValues = parsedCategoryIds.map(catId => [req.user.id, catId])
-      await pool.query(
-        "INSERT IGNORE INTO dealer_categories (user_id, category_id) VALUES ?",
-        [categoryValues]
-      )
-    }
-
-    // Tạo link thanh toán: MoMo / PayOS / Giả lập
+    // Tạo link thanh toán PayOS hoặc Giả lập
     try {
       const orderCode = result.insertId
       const isSimulate = process.env.PAYMENT_SIMULATE === 'true'
-      const provider = process.env.PAYMENT_PROVIDER || 'payos' // 'momo' | 'payos'
-      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
       
       let checkoutUrl = ""
 
       if (isSimulate) {
         console.log(`--- [SIMULATE] Tạo yêu cầu giả lập cho ID: ${orderCode} ---`)
-        checkoutUrl = `${frontendUrl}/profile?status=success&id=${orderCode}&simulate=true`
-      } else if (provider === 'momo') {
-        console.log(`--- [MoMo] Tạo payment link cho ID: ${orderCode} ---`)
-        const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000/api'
-        const momoData = await createMomoPayment({
-          orderId: `${orderCode}_${Date.now()}`,
-          amount: Number(created.price_vnd || 0),
-          orderInfo: `Nang cap dai ly AgriTrend #${orderCode}`,
-          redirectUrl: `${frontendUrl}/profile?momo-return=1&id=${orderCode}`,
-          cancelUrl: `${frontendUrl}/profile?momo-return=1&id=${orderCode}`,
-          ipnUrl: `${backendUrl}/dealer-upgrade/momo/webhook`,
-        })
-        const paymentUrl = momoData.payUrl || momoData.deeplink || null
-        const qrCodeUrl = momoData.qrCodeUrl || null
-        checkoutUrl = paymentUrl || qrCodeUrl
-        console.log(`✅ [MoMo] payUrl: ${paymentUrl}`)
-        if (qrCodeUrl) console.log(`✅ [MoMo] qrCodeUrl: ${qrCodeUrl}`)
-        // Lưu payment_url
-        await pool.query("UPDATE dealer_upgrade_requests SET payment_ref = ? WHERE id = ?", [paymentUrl || checkoutUrl, orderCode])
-        res.status(201).json({ success: true, request: { ...created, checkoutUrl: paymentUrl || checkoutUrl, payment_url: paymentUrl || null, payment_qr: qrCodeUrl || null } })
-        return
+        checkoutUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?status=success&id=${orderCode}&simulate=true`
       } else {
         const paymentLinkRequest = {
           orderCode: orderCode,
-          amount: Number(created.price_vnd || 0),
+          amount: Number(plan.price_vnd),
           description: `Upgrade ${orderCode}`,
-          returnUrl: `${frontendUrl}/profile?status=success&id=${orderCode}`,
-          cancelUrl: `${frontendUrl}/profile?status=cancel&id=${orderCode}`,
+          returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?status=success&id=${orderCode}`,
+          cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/profile?status=cancel&id=${orderCode}`,
         }
         const paymentLinkData = await payos.createPaymentLink(paymentLinkRequest)
         checkoutUrl = paymentLinkData.checkoutUrl
       }
+      
+      // Lưu checkoutUrl vào DB
+      await pool.query(
+        "UPDATE dealer_upgrade_requests SET payment_ref = ? WHERE id = ?",
+        [checkoutUrl, orderCode]
+      )
 
-      // Lưu payment_ref nếu chưa trả về trong nhánh momo
-      await pool.query("UPDATE dealer_upgrade_requests SET payment_ref = ? WHERE id = ?", [checkoutUrl, result.insertId])
-
-      res.status(201).json({ success: true, request: { ...created, checkout
... (diff quá dài, đã bị cắt bớt để dễ đọc)
```
</details>

## 📄 File: `apps/backend/routes/dealerLocations.js` (Mới)

- ⚠️ **Trạng thái:** File chưa tồn tại trong bản hiện tại. Cần được copy toàn bộ sang.

<details>
<summary>Xem trước nội dung file mới</summary>

```js
import express from "express"
import pool from "../db.js"
import { authenticateToken } from "../middleware/auth.js"

const router = express.Router()

/**
 * GET /api/dealer-locations
 * Lấy tất cả địa điểm đại lý (public - hiển thị trên bản đồ)
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        l.id, l.user_id, l.branch_name, l.region_label, l.address,
        l.latitude, l.longitude, l.province, l.ward,
        l.phone, l.business_hours, l.image_url,
        l.created_at, l.updated_at,
        u.name AS dealer_name, u.email AS dealer_email, u.avatar_url
      FROM dealer_locations l
      JOIN users u ON u.id = l.user_id
      WHERE u.role = 'dealer'
      ORDER BY l.updated_at DESC
    `)
    res.json({ success: true, locations: rows })
  } catch (err) {
    console.error("GET /dealer-locations error:", err)
    res.status(500).json({ error: "Không thể tải danh sách địa điểm đại lý" })
  }
})

/**
 * GET /api/dealer-locations/me
 * Lấy địa điểm của dealer đang đăng nhập
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT * FROM dealer_locations WHERE user_id = ? LIMIT 1",
      [req.user.id]
    )
    res.json({ success: true, location: row || null })
  } catch (err) {
    console.error("GET /dealer-locations/me error:", err)
    res.status(500).json({ error: "Không thể tải địa điểm của bạn" })
  }
})

/**
 * POST /api/dealer-locations
 * Tạo hoặc cập nhật địa điểm cho dealer hiện tại
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "dealer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Chỉ đại lý mới có thể đăng ký địa điểm" })
    }

    const {
      address, latitude, longitude, place_id, province, ward,
      branch_name, region_label, phone, business_hours, image_url,
    } = req.body

    if (
... (nội dung quá dài, đã bị cắt bớt)
```
</details>

## 📄 File: `apps/frontend/.env` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -1,2 +1,3 @@
 VITE_API_URL=http://localhost:5000/api
-VITE_GOOGLE_CLIENT_ID=811971060912-9io1ptn4a28943le0rivg6iakei905ji.apps.googleusercontent.com
\ No newline at end of file
+VITE_GOOGLE_CLIENT_ID=811971060912-9io1ptn4a28943le0rivg6iakei905ji.apps.googleusercontent.com
+VITE_NDAMAPS_API_KEY=MKkEIGHWWLzRvzktkeA0bb2lxajtl0zz

```
</details>

## 📄 File: `apps/frontend/src/App.jsx` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -29,9 +29,6 @@ import DealerProductDetail from "./pages/dealer/DealerProductDetail"
 import DealerPurchaseRequests from "./pages/dealer/DealerPurchaseRequests"
 import DealerCommunity from "./pages/dealer/DealerCommunity"
 import Negotiation from "./pages/shared/Negotiation"
-import MySupply from "./pages/user/MySupply"
-import DealerSupplyHub from "./pages/dealer/DealerSupplyHub"
-import Wallet from "./pages/user/Wallet"
 
 // Admin pages
 import AdminDashboard from "./pages/admin/Dashboard"
@@ -83,15 +80,12 @@ function AppContent() {
         <Route path="/alerts" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><Alerts /></MainLayout2></RoleRoute>} />
         <Route path="/compare" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><Compare /></MainLayout2></RoleRoute>} />
         <Route path="/news" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><News /></MainLayout2></RoleRoute>} />
-        <Route path="/my-supply" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><MySupply /></MainLayout2></RoleRoute>} />
-        <Route path="/dealer-supply" element={<RoleRoute allowedRoles={["dealer", "admin"]}><MainLayout2><DealerSupplyHub /></MainLayout2></RoleRoute>} />
         <Route path="/purchase-requests" element={<RoleRoute allowedRoles={["dealer"]}><MainLayout2><DealerPurchaseRequests /></MainLayout2></RoleRoute>} />
         <Route path="/negotiation" element={<RoleRoute allowedRoles={["user", "dealer", "admin"]}><MainLayout2><Negotiation /></MainLayout2></RoleRoute>} />
-        <Route path="/wallet" element={<ProtectedRoute><MainLayout2><Wallet /></MainLayout2></ProtectedRoute>} />
         <Route path="/community" element={<ProtectedRoute><MainLayout2>{isDealer ? <DealerCommunity /> : <Community />}</MainLayout2></ProtectedRoute>} />
         <Route path="/chat" element={<ProtectedRoute><MainLayout2><Chat /></MainLayout2></ProtectedRoute>} />
         <Route path="/profile" element={<ProtectedRoute><MainLayout2><Profile /></MainLayout2></ProtectedRoute>} />
-        <Route path="/map" element={<RoleRoute allowedRoles={["user", "admin"]}><MainLayout2><PriceMap /></MainLayout2></RoleRoute>} />
+        <Route path="/map" element={<RoleRoute allowedRoles={["user", "admin", "dealer"]}><MainLayout2><PriceMap /></MainLayout2></RoleRoute>} />
 
         {/* Admin routes — cũng dùng MainLayout2 */}
         <Route path="/admin" element={<AdminRoute><MainLayout2><AdminDashboard /></MainLayout2></AdminRoute>} />

```
</details>

## 📄 File: `apps/frontend/src/index.css` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -33,4 +33,50 @@ body {
 
 #root {
   min-height: 100vh;
-}
\ No newline at end of file
+}
+
+/* Ẩn scrollbar nhưng vẫn cuộn được */
+.scrollbar-hide::-webkit-scrollbar { display: none; }
+.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
+
+
+/* ==== NDAMaps dealer popup styling ==== */
+.dealer-popup .maplibregl-popup-content,
+.dealer-popup .ndamapgl-popup-content {
+  padding: 0 !important;
+  border-radius: 12px !important;
+  overflow: hidden;
+  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
+  border: none;
+}
+.dealer-popup .maplibregl-popup-close-button,
+.dealer-popup .ndamapgl-popup-close-button {
+  font-size: 20px;
+  padding: 4px 10px;
+  color: #374151;
+  background: rgba(255, 255, 255, 0.9);
+  border-radius: 50%;
+  width: 28px;
+  height: 28px;
+  line-height: 1;
+  top: 8px;
+  right: 8px;
+  z-index: 10;
+  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
+}
+.dealer-popup .maplibregl-popup-close-button:hover,
+.dealer-popup .ndamapgl-popup-close-button:hover {
+  background: white;
+  color: #111827;
+}
+.dealer-popup .maplibregl-popup-tip,
+.dealer-popup .ndamapgl-popup-tip {
+  border-top-color: white !important;
+  border-bottom-color: white !important;
+}
+
+/* Shimmer keyframes cho ảnh đang load */
+@keyframes shimmer {
+  0% { background-position: 200% 0; }
+  100% { background-position: -200% 0; }
+}

```
</details>

## 📄 File: `apps/frontend/src/components/Sidebar2.jsx` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -47,6 +47,7 @@ const DEALER_NAV = [
   { path: "/community", icon: Users, label: "Cộng đồng" },
   { path: "/chat", icon: MessageSquare, label: "Trò chuyện" },
   { path: "/purchase-requests", icon: Package, label: "Yêu cầu mua" },
+  { path: "/map", icon: Map, label: "Bản đồ đại lý" },
 ]
 
 const ADMIN_NAV = [
@@ -243,4 +244,4 @@ export default function Sidebar2() {
       </div>
     </aside>
   )
-}
+}
\ No newline at end of file

```
</details>

## 📄 File: `apps/frontend/src/lib/utils.ts` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -5,7 +5,11 @@ export function cn(...inputs: ClassValue[]) {
     return twMerge(clsx(inputs))
 }
 
-export function formatCurrency(amount: number | string | null | undefined): string {
-    if (amount === null || amount === undefined || isNaN(Number(amount))) return "0 đ";
-    return Number(amount).toLocaleString('vi-VN') + ' đ';
+/**
+ * Format số sang VNĐ. VD: 12000 → "12.000 ₫"
+ */
+export function formatCurrency(value: number | string | null | undefined): string {
+    const n = Number(value)
+    if (!Number.isFinite(n)) return "0 ₫"
+    return n.toLocaleString("vi-VN") + " ₫"
 }

```
</details>

## 📄 File: `apps/frontend/src/lib/vietnamProvinces.js` (Mới)

- ⚠️ **Trạng thái:** File chưa tồn tại trong bản hiện tại. Cần được copy toàn bộ sang.

<details>
<summary>Xem trước nội dung file mới</summary>

```js
/**
 * Danh sách 34 đơn vị hành chính cấp tỉnh/thành phố sau cải cách 1/7/2025
 * (sáp nhập từ 63 tỉnh xuống 34, bỏ cấp huyện).
 */
export const VIETNAM_PROVINCES_2025 = [
  { id: "01", name: "Hà Nội", type: "Thành phố" },
  { id: "02", name: "Hồ Chí Minh", type: "Thành phố" },
  { id: "03", name: "Hải Phòng", type: "Thành phố" },
  { id: "04", name: "Đà Nẵng", type: "Thành phố" },
  { id: "05", name: "Cần Thơ", type: "Thành phố" },
  { id: "06", name: "Huế", type: "Thành phố" },
  { id: "07", name: "Thanh Hóa", type: "Tỉnh" },
  { id: "08", name: "Nghệ An", type: "Tỉnh" },
  { id: "09", name: "Hà Tĩnh", type: "Tỉnh" },
  { id: "10", name: "Quảng Ninh", type: "Tỉnh" },
  { id: "11", name: "Lạng Sơn", type: "Tỉnh" },
  { id: "12", name: "Cao Bằng", type: "Tỉnh" },
  { id: "13", name: "Lai Châu", type: "Tỉnh" },
  { id: "14", name: "Điện Biên", type: "Tỉnh" },
  { id: "15", name: "Sơn La", type: "Tỉnh" },
  { id: "16", name: "Tuyên Quang", type: "Tỉnh" },
  { id: "17", name: "Lào Cai", type: "Tỉnh" },
  { id: "18", name: "Thái Nguyên", type: "Tỉnh" },
  { id: "19", name: "Phú Thọ", type: "Tỉnh" },
  { id: "20", name: "Bắc Ninh", type: "Tỉnh" },
  { id: "21", name: "Hưng Yên", type: "Tỉnh" },
  { id: "22", name: "Ninh Bình", type: "Tỉnh" },
  { id: "23", name: "Quảng Trị", type: "Tỉnh" },
  { id: "24", name: "Quảng Ngãi", type: "Tỉnh" },
  { id: "25", name: "Gia Lai", type: "Tỉnh" },
  { id: "26", name: "Khánh Hòa", type: "Tỉnh" },
  { id: "27", name: "Lâm Đồng", type: "Tỉnh" },
  { id: "28", name: "Đắk Lắk", type: "Tỉnh" },
  { id: "29", name: "Đồng Nai", type: "Tỉnh" },
  { id: "30", name: "Tây Ninh", type: "Tỉnh" },
  { id: "31", name: "Vĩnh Long", type: "Tỉnh" },
  { id: "32", name: "Đồng Tháp", type: "Tỉnh" },
  { id: "33", name: "Cà Mau", type: "Tỉnh" },
  { id: "34", name: "An Giang", type: "Tỉnh" },
]

```
</details>

## 📄 File: `apps/frontend/src/pages/user/PriceMap.jsx` (Viết lại)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -1,354 +1,1023 @@
-import { useState, useEffect } from "react"
+import { useState, useEffect, useRef, useCallback, useMemo } from "react"
 import Navbar from "@/components/Navbar"
-import Footer from "@/components/Footer"
-import { Card, CardContent } from "@/components/ui/card"
-import {
-  Select,
-  SelectContent,
-  SelectItem,
-  SelectTrigger,
-  SelectValue,
-} from "@/components/ui/select"
-import { Loader2, MapPin } from "lucide-react"
+import { Loader2, MapPin, Search, X, Phone, Clock, CheckCircle2, Trash2, Filter, Crosshair, Pencil } from "lucide-react"
+import ndamapgl from "ndamap-gl"
+import "ndamap-gl/dist/ndamap-gl.css"
+import { v4 as uuidv4 } from "uuid"
 import api from "@/lib/api"
-import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet"
-
-const PROVINCE_COORDS = {
-  // --- 6 Thành phố trực thuộc Trung ương ---
-  "ha noi": [21.028511, 105.804817],
-  "ho chi minh": [10.823099, 106.629664],
-  "hai phong": [20.844912, 106.688084],
-  "da nang": [16.047079, 108.206230],
-  "can tho": [10.045162, 105.746857],
-  "hue": [16.463713, 107.590866],
-
-  // --- Miền Bắc (12 tỉnh) ---
-  "quang ninh": [21.006382, 107.292514],
-  "cao bang": [22.665600, 106.257900],
-  "lang son": [21.853708, 106.761519],
-  "lai chau": [22.386389, 103.470833],
-  "dien bien": [21.383333, 103.016667],
-  "son la": [21.316667, 103.900000],
-  "tuyen quang": [21.823611, 105.218056],
-  "lao cai": [22.338333, 103.975000],
-  "thai nguyen": [21.594444, 105.848333],
-  "phu tho": [21.400000, 105.166667],
-  "bac ninh": [21.186111, 106.076111],
-  "hung yen": [20.646667, 106.051667],
-
-  // --- Miền Trung & Tây Nguyên (8 tỉnh) ---
-  "thanh hoa": [19.800000, 105.766667],
-  "nghe an": [19.250000, 104.883333],
-  "ha tinh": [18.342222, 105.905833],
-  "ninh binh": [20.250000, 105.975000],
-  "quang tri": [16.750000, 107.000000],
-  "quang ngai": [15.120000, 108.800000],
-  "gia lai": [13.983333, 108.250000],
-  "khanh hoa": [12.250000, 109.183333],
-
-  // --- Nam Trung Bộ & Nam Bộ (8 tỉnh) ---
-  "lam dong": [11.575278, 107.809583],
-  "dak lak": [12.666667, 108.050000],
-  "dong nai": [11.000000, 107.166667],
-  "tay ninh": [11.366667, 106.116667],
-  "vinh long": [10.250000, 105.966667],
-  "dong thap": [10.533333, 105.683333],
-  "an giang": [10.500000, 105.116667],
-  "ca mau": [9.183333, 105.150000],
-};
-
-const PROVINCE_SPECIALTIES = {
-  // --- 6 Thành phố trực thuộc Trung ương ---
-  "ha noi": ["Gạo nếp cái hoa vàng", "Bưởi Diễn", "Nhãn lồng", "Rau an toàn"],
-  "ho chi minh": ["Hồ tiêu", "Điều", "Cao su", "Trái cây nhiệt đới"],
-  "hai phong": ["Lúa gạo", "Vải thiều", "Thủy sản", "Rau màu"],
-  "da nang": ["Thủy sản", "Rau sạch", "Quế", "Tiêu"],
-  "can tho": ["Lúa gạo ST25", "Cá tra", "Trái cây", "Tôm"],
-  "hue": ["Thanh trà", "Bưởi", "Sen", "Quế"],
-
-  // --- Miền Bắc (12 tỉnh) ---
-  "quang ninh": ["Thủy sản", "Chè", "Na dai", "Gạo nếp cái hoa vàng"],
-  "cao bang": ["Hạt dẻ", "Lê", "Thạch đen", "Miến dong"],
-  "lang son": ["Na Chi Lăng", "Hồi", "Quế", "Thạch đen"],
-  "lai chau": ["Chè Shan tuyết", "Gạo Séng Cù", "Thảo quả", "Mật ong"],
-  "dien bien": ["Gạo Điện Biên", "Cà phê", "Chè", "Mắc ca"],
-  "son la": ["Xoài", "Nhãn", "Cà phê", "Mận hậu", "Chè Shan tuyết"],
-  "tuyen quang": ["Cam sành", "Chè", "Bưởi", "Mía"],
-  "lao cai": ["Thảo quả", "Chè Shan tuyết", "Quế", "Mận"],
-  "thai nguyen": ["Chè Thái Nguyên", "Lúa gạo", "Na", "Bưởi"],
-  "phu tho": ["Chè", "Bưởi Đoan Hùng", "Hồng không hạt", "Chuối"],
-  "bac ninh": ["Vải thiều", "Lúa gạo", "Rau màu", "Khoai tây"],
-  "hung yen": ["Nhãn lồng", "Lúa gạo", "Chuối", "Vải"],
-
-  // --- Miền Trung & Tây Nguyên (8 tỉnh) ---
-  "thanh hoa": ["Mía đường", "Lúa gạo", "Bưởi Luận Văn", "Cam"],
-  "nghe an": ["Cam Vinh", "Lạc (Đậu phộng)", "Chè", "Mía"],
-  "ha tinh": ["Bưởi Phúc Trạch", "Cam", "Chè", "Lạc"],
-  "ninh binh": ["Lúa gạo", "Dứa", "Cói", "Rau màu"],
-  "quang tri": ["Hồ tiêu", "Cà phê", "Cao su", "Lúa gạo"],
-  "quang ngai": ["Quế Trà Bồng", "Sâm Ngọc Linh", "Mì (Sắn)", "Lúa gạo"],
-  "gia lai": ["Cà phê", "Hồ tiêu", "Cao su", "Chuối", "Chanh dây"],
-  "khanh hoa": ["Xoài Cam Lâm", "Sầu riêng Khánh Sơn", "Yến sào", "Nho"],
-
-  // --- Nam Trung Bộ & Nam Bộ (8 tỉnh) ---
-  "lam dong": ["Cà phê Arabica", "Chè", "Rau củ", "Hoa", "Sầu riêng", "Thanh long"],
-  "dak lak": ["Cà phê Robusta", "Hồ tiêu", "Bơ sáp", "Sầu riêng", "Ca cao"],
-  "dong nai": ["Bưởi Tân Triều", "Chôm chôm", "Sầu riêng", "Tiêu", "Điều", "Cao su"],
-  "tay ninh": ["Mãng cầu Bà Đen", "Mía đường", "Cao su", "Thanh long", "Lúa gạo"],
-  "vinh long": ["Bưởi Năm Roi", "Cam sành", "Khoai lang tím", "Dừa", "Chôm chôm"],
-  "dong thap": ["Xoài Cao Lãnh", "Sen", "Quýt hồng Lai Vung", "Lúa gạo"],
-  "an giang": ["Lúa gạo", "Xoài", "Thốt nốt", "Hồ tiêu Phú Quốc"],
-  "ca mau": ["Lúa gạo", "Mật ong rừng", "Tôm", "Cua"],
-};
-
-// Hàm chuẩn hóa tên vùng
-const normalizeRegionKey = (regionName) => {
-  if (!regionName) return null;
-  return regionName.toLowerCase()
-    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Bỏ dấu
-    .replace(/đ/g, "d")
-    .replace(/tỉnh /g, "").replace(/thành phố /g, "").replace(/tp. /g, "")
-    .replace(/-/g, " ")
-    .trim();
-};
-
-// Mapping tỉnh cũ → tỉnh mới (sau sáp nhập 2025)
-const OLD_TO_NEW_PROVINCE = {
-  "ha giang": "tuyen quang",
-  "yen bai": "lao cai",
-  "bac kan": "thai nguyen",
-  "vinh phuc": "phu tho",
-  "hoa binh": "phu tho",
-  "bac giang": "bac ninh",
-  "thai binh": "hung yen",
-  "hai duong": "hai phong",
-  "ha nam": "ninh binh",
-  "nam dinh": "ninh binh",
-  "quang binh": "quang tri",
-  "quang nam": "da nang",
-  "kon tum": "quang ngai",
-  "binh dinh": "gia lai",
-  "ninh thuan": "khanh hoa",
-  "phu yen": "dak lak",
-  "dak nong": "lam dong",
-  "binh thuan": "lam dong",
-  "binh phuoc": "dong nai",
-  "binh duong": "ho chi minh",
-  "ba ria - vung tau": "ho chi minh",
-  "long an": "tay ninh",
-  "tien giang": "dong thap",
-  "ben tre": "vinh long",
-  "tra vinh": "vinh long",
-  "soc trang": "can tho",
-  "hau giang": "can tho",
-  "kien giang": "an giang",
-  "bac lieu": "ca mau",
-};
-
-const getCoords = (regionName) => {
-  const key = normalizeRegionKey(regionName);
-  if (!key) return null;
-  // Thử tìm trực tiếp
-  if (PROVINCE_COORDS[key]) return PROVINCE_COORDS[key];
-  // Mapping tên cũ → tên mới
-  const mappedKey = OLD_TO_NEW_PROVINCE[key];
-  if (mappedKey && PROVINCE_COORDS[mappedKey]) return PROVINCE_COORDS[mappedKey];
-  // Fallback đặc biệt
-  if (key.includes("vung tau")) return PROVINCE_COORDS["ho chi minh"];
-  if (key.includes("hcm") || key.includes("ho chi minh")) return PROVINCE_COORDS["ho chi minh"];
-  return null;
-};
-
-const getSpecialties = (regionName) => {
-  const key = normalizeRegionKey(regionName);
-  if (!key) return [];
-  if (PROVINCE_SPECIALTIES[key]) return PROVINCE_SPECIALTIES[key];
-  const mappedKey = OLD_TO_NEW_PROVINCE[key];
-  if (mappedKey && PROVINCE_SPECIALTIES[mappedKey]) return PROVINCE_SPECIALTIES[mappedKey];
-  return [];
-};
-
-function MapFocus({ selectedCategory, allProducts }) {
-  const map = useMap();
+import { useAuth } from "@/context/AuthContext"
+import { Button } from "@/components/ui/button"
+import { Input } from "@/components/ui/input"
+import { Label } from "@/components/ui/label"
+
+const NDAMAPS_API_KEY = import.meta.env.VITE_NDAMAPS_API_KEY || ""
+const NDAMAPS_STYLE = NDAMAPS_API_KEY
+  ? `https://maptiles.ndamaps.vn/styles/day-v1/style.json?apikey=${NDAMAPS_API_KEY}`
+  : "https://nda-tiles.openmap.vn/styles/ndamap/style.json"
+const NDAMAPS_API_BASE = "https://mapapis.ndamaps.vn/v1"
+
+// Phân vùng theo tỉnh để gắn label "Miền Nam", "Tây Nguyên",...
+const REGION_BY_PROVINCE = {
+  "Hà Nội": "Miền Bắc", "Hải Phòng": "Miền Bắc", "Quảng Ninh": "Miền Bắc",
+  "Bắc Ninh": "Miền Bắc", "Hưng Yên": "Miền Bắc", "Ninh Bình": "Miền Bắc",
+  "Thái Nguyên": "Miền Bắc", "Phú Thọ": "Miền Bắc", "Cao Bằng": "Miền Bắc",
+  "Lạng Sơn": "Miền Bắc", "Lào Cai": "Miề
... (diff quá dài, đã bị cắt bớt để dễ đọc)
```
</details>

## 📄 File: `apps/frontend/src/pages/user/Profile.jsx` (Sửa)

- 🔄 **Trạng thái:** Hai file có nội dung khác biệt. Cần kiểm tra để merge.

<details>
<summary>Xem chi tiết khác biệt (Diff)</summary>

```diff
@@ -1,9 +1,9 @@
 "use client"
 
-import { useState, useEffect, useRef } from "react"
+import { useState, useEffect } from "react"
 import Navbar from "../../components/Navbar"
 import { useAuth } from "../../context/AuthContext"
-import { User, X, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react"
+import { User, X } from "lucide-react" // <-- THÊM ICON 'X'
 import { Button } from "@/components/ui/button"
 import { Input } from "@/components/ui/input"
 import api from "../../lib/api"
@@ -16,88 +16,15 @@ import {
 } from "@/components/ui/card"
 import { Label } from "@/components/ui/label"
 import { cn } from "@/lib/utils"
-import {
-  Check,
-  CheckCircle,
-  ArrowRight,
-  Clock,
-  History
+import { 
+  Check, 
+  CheckCircle, 
+  ArrowRight, 
+  Clock, 
+  History 
 } from "lucide-react"
 
 
-function PaymentAlert({ type = 'error', title, message, onClose, autoCloseMs }) {
-  const timerRef = useRef(null)
-
-  useEffect(() => {
-    if (autoCloseMs && onClose) {
-      timerRef.current = setTimeout(onClose, autoCloseMs)
-    }
-    return () => clearTimeout(timerRef.current)
-  }, [autoCloseMs, onClose])
-
-  const styles = {
-    success: {
-      wrapper: 'bg-emerald-50 border-emerald-300 shadow-emerald-100',
-      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />,
-      title: 'text-emerald-800',
-      message: 'text-emerald-700',
-      close: 'text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100',
-      bar: 'bg-emerald-500',
-    },
-    error: {
-      wrapper: 'bg-red-50 border-red-300 shadow-red-100',
-      icon: <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />,
-      title: 'text-red-800',
-      message: 'text-red-700',
-      close: 'text-red-400 hover:text-red-600 hover:bg-red-100',
-      bar: 'bg-red-500',
-    },
-    warning: {
-      wrapper: 'bg-amber-50 border-amber-300 shadow-amber-100',
-      icon: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />,
-      title: 'text-amber-800',
-      message: 'text-amber-700',
-      close: 'text-amber-400 hover:text-amber-600 hover:bg-amber-100',
-      bar: 'bg-amber-500',
-    },
-  }
-
-  const s = styles[type] || styles.error
-
-  return (
-    <div
-      className={cn(
-        'relative flex gap-3 rounded-2xl border-2 px-5 py-4 shadow-md text-left animate-in fade-in slide-in-from-top-2 duration-300',
-        s.wrapper
-      )}
-    >
-      {/* Thanh màu bên trái */}
-      <div className={cn('absolute left-0 top-0 h-full w-1.5 rounded-l-2xl', s.bar)} />
-
-      {/* Icon */}
-      {s.icon}
-
-      {/* Nội dung */}
-      <div className="flex-1 min-w-0 pl-1">
-        {title && <p className={cn('font-black text-sm leading-snug mb-0.5', s.title)}>{title}</p>}
-        <p className={cn('text-sm font-medium leading-relaxed whitespace-pre-line', s.message)}>{message}</p>
-      </div>
-
-      {/* Nút đóng */}
-      {onClose && (
-        <button
-          onClick={onClose}
-          className={cn('flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors mt-0.5', s.close)}
-          aria-label="Đóng thông báo"
-        >
-          <X className="w-3.5 h-3.5" />
-        </button>
-      )}
-    </div>
-  )
-}
-
-
 function CostManager() {
   const [myProducts, setMyProducts] = useState([])
   const [allProducts, setAllProducts] = useState([])
@@ -148,14 +75,14 @@ function CostManager() {
       alert("Lỗi! Không thể lưu chi phí.")
     }
   }
-
-
+  
+  
   const handleDeleteCost = async (productId, productName) => {
     // Hỏi xác nhận trước khi xóa
     if (!confirm(`Bạn có chắc muốn xóa chi phí cho "${productName}" không?`)) {
       return;
     }
-
+    
     try {
       await api.delete(`/costs/${productId}`); // Gọi API DELETE mới
       fetchMyCosts(); // Tải lại danh sách
@@ -243,7 +170,7 @@ function CostManager() {
 }
 
 
-function DealerUpgradeCard({ user, onRoleUpdated }) {
+  function DealerUpgradeCard({ user, onRoleUpdated }) {
   const [step, setStep] = useState(1)
   const [plans, setPlans] = useState([])
   const [requests, setRequests] = useState([])
@@ -253,21 +180,6 @@ function DealerUpgradeCard({ user, onRoleUpdated }) {
   const [message, setMessage] = useState("")
   const [error, setError] = useState("")
 
-  // Overlay thông báo thanh toán thành công (luôn render trên cùng)
-  const [paymentSuccess, setPaymentSuccess] = useState(false)
-  const [paymentError, setPaymentError] = useState("")
-
-  // Toast in-page: { title, message } | null
-  const [toast, setToast] = useState(null)
-  // 'success' | 'error' | 'warning'
-  const [toastType, setToastType] = useState('error')
-
-  const showToast = (type, title, message, autoCloseMs) => {
-    setToastType(type)
-    setToast({ title, message, autoCloseMs })
-  }
-  const closeToast = () => setToast(null)
-
   // Form Data Step 1 - Tự động load từ localStorage nếu có
   const [businessData, setBusinessData] = useState(() => {
     const saved = localStorage.getItem("dealer_upgrade_draft")
@@ -277,27 +189,41 @@ function DealerUpgradeCard({ user, onRoleUpdated }) {
       business_address: "",
       representative_name: "",
       phone_contact: "",
-      business_items: ""
+      business_items: "",
+      province: "",
+      ward: "",
     }
   })
 
-  // Danh mục thu mua (multi-select)
-  const [availableCategories, setAvailableCategories] = useState([])
-  const [selectedCategoryIds, setSelectedCategoryIds] = useState(() => {
-    const saved = localStorage.getItem("dealer_upgrade_categories")
-    return saved ? JSON.parse(saved) : []
-  })
+  // Dữ liệu địa giới hành chính (API AddressKit - 34 tỉnh thành sau sáp nhập 1/7/2025)
+  const [provinces, setProvinces] = useState([])
+  const [communes, setCommunes] = useState([])
+
+  // Load 34 tỉnh/thành
+  useEffect(() => {
+    fetch("https://production.cas.so/address-kit/latest/provinces")
+      .then(r => r.json())
+      .then(d => { if (d.provinces) setProvinces(d.provinces) })
+      .catch(err => console.error("Load provinces:", err))
+  }, [])
+
+  // Load phường/xã khi đổi tỉnh
+  useEffect(() => {
+    if (!businessData.province) { setCommunes([]); return }
+    const prov = provinces.find(p => p.name === businessData.province)
+    if (!prov) return
+    fetch(`https://production.cas.so/address-kit/latest/provinces/${prov.code}/communes`)
+      .then(r => r.json())
+      .then(d => { if (d.communes) setCommunes(d.communes) })
+      .catch(err => console.error("Load communes:", err))
+  }, [businessData.province, provinces])
+
 
   // Lưu nháp mỗi khi businessData thay đổi
   useEffect(() => {
     localStorage.setItem("dealer_upgrade_draft", JSON.stringify(businessData))
   }, [businessData])
 
-  // Lưu nháp danh mục thu mua
-  useEffect(() => {
-    localStorage.setItem("dealer_upgrade_categories", JSON.stringify(selectedCategoryIds))
-  }, [selectedCategoryIds])
-
   // Data Step 2
   const [selectedPlanId, setSelectedPlanId] = useState("")
 
@@ -332,14 +258,6 @@ function DealerUpgradeCard({ user, onRoleUpdated }) {
       } catch (err) {
         console.error("Lỗi tải lịch sử yêu cầu:", err)
       }
-
-      // Lấy danh sách categories cho multi-select
-      try {
-        const resCats = await api.get("/products/categories")
-        setAvailableCategories(resCats.data || [])
-      } catch (err) {
-        console.error("Lỗi tải danh mục:", err)
-      }
     } finally {
       setLoading(false)
     }
@@ -351,7 +269,6 @@ function DealerUpgradeCard({ user, onRoleUpdated }) {
     if (!businessData.business_address.trim()) return "Vui lòng nhập địa chỉ trụ sở"
     if (!businessData.representative_name.trim()) return "Vui lòng nhập người đại diện"
     if (!/^\d{10,11}$/.test(businessData.phone_contact)) return "Số điện thoại không hợp lệ (10-11 số)"
-    if (selectedCategoryIds.length === 0) return "Vui lòng chọn ít nhất 1 danh mục nông sản thu mua"
     return null
   }
 
@@ -372,10 +289,9 @@ function 
... (diff quá dài, đã bị cắt bớt để dễ đọc)
```
</details>

