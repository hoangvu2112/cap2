# Tổng quan dự án — AgriTrend / Agricultural Price Tracker

## 1) Tóm tắt ngắn
- Mục tiêu: Hệ thống thu thập, theo dõi và phân tích giá nông sản; hỗ trợ giao dịch giữa đại lý và nông dân; kèm nền tảng cộng đồng và chatbot trợ giúp.
- Đối tượng: Nông dân/nhà cung cấp, đại lý/thu mua, người quan tâm/khách hàng và quản trị viên.

## 2) Các chức năng chính (đã triển khai)

### A. Frontend (React / Vite)
- Entry: `apps/frontend/src/App.jsx` — routes & bảo vệ quyền truy cập.
- Trang xác thực: đăng nhập, đăng ký, quên mật khẩu, reset.
- Trang người dùng: `Dashboard`, `ProductDetail`, `Favorites`, `Alerts`, `Compare`, `PriceMap`, `News`, `Community`, `Profile`.
- Trang đại lý: `DealerDashboard`, `DealerProductDetail`, `DealerPurchaseRequests`, `DealerCommunity`.
- Trang admin: `AdminDashboard`, `AdminProducts`, `AdminUsers`, `AdminNews`, `AdminStatistics`, `AdminSettings`.
- Components nổi bật: `ChatBotWidget`, `LivePriceTicker`, `PriceCard`, `PostCard`, `Sidebar2`, `Navbar`, các UI primitives trong `components/ui`.

### B. Backend (Node.js / Express)
- Entry: `apps/backend/server.js` — cấu hình Socket.IO, cron, routes.
- Xác thực: `apps/backend/routes/auth.js` (JWT, Google verify, OTP email).
- Sản phẩm & giá: `apps/backend/routes/products.js` (filter, map data, categories, CRUD, lịch sử giá).
- Cộng đồng: `apps/backend/routes/community.js` (posts, comments, likes, direct messages).
- Yêu cầu mua / đại lý: `apps/backend/routes/purchaseRequests.js` và `apps/backend/routes/dealerUpgrade.js`.
- Tin tức: `apps/backend/routes/news.js` (public + admin CRUD).
- Cảnh báo giá: `apps/backend/routes/alerts.js` (tạo, xem, xoá; cron kiểm tra & gửi email).
- Yêu thích & chi phí cá nhân: `favorites.js`, `costs.js`.
- Thống kê: `stats.js` (endpoint admin nâng cao).

### C. Chatbot AI / RAG
- Core: `apps/backend/chatbot/index.js` — session, gửi message, gọi provider (OpenAI/Groq) nếu cấu hình.
- Ingest tri thức: `apps/backend/chatbot/ingest.js`, sources adapters: `apps/backend/chatbot/sources/websites.js`.
- Prompt role-aware: `apps/backend/chatbot/prompts.js` (khác cho `dealer` và `user`).
- Admin trigger reindex: POST `/api/chatbot/reindex`.

### D. Scraper / ETL / Cron
- Scraper: `apps/backend/scraped/scrape.js` → xuất `scraped/all_regions.json`.
- Đồng bộ dữ liệu: `apps/backend/cron/syncProducts.js` — đọc `all_regions.json`, cập nhật `price_history`, emit Socket.IO.
- Đồng bộ chatbot: `apps/backend/cron/syncChatbot.js` — gọi ingest và emit sự kiện `chatbot:knowledge_updated`.
- Kiểm tra đại lý: `apps/backend/cron/checkDealerExpiration.js` — gửi email cảnh báo và hạ cấp khi hết hạn.
- Scripts hỗ trợ: `apps/backend/scripts/*` (backfill, seed, check ai provider).

### E. Realtime (Socket.IO)
- Các event chính emit từ server: `initData`, `productUpdated`, `priceUpdate`, `priceHistoryUpdated`, `community:new_post`, `community:post_updated`, `community:post_deleted`, `community:comment_added`, `community:like`, `chatbot:knowledge_updated`, ...
- Auth trên socket: token JWT được verify trong `server.js`.

### F. Email & OTP
- Gửi email (Gmail App Password / SMTP): dùng `nodemailer`; OTP flow nằm ở `routes/auth.js`.

## 3) Cấu hình & chạy nhanh
- Thiết lập `.env` cho `apps/backend` (DB_*, JWT_SECRET, SMTP_EMAIL, SMTP_PASSWORD, OPENAI_API_KEY/GROQ_API_KEY, CHATBOT_WEBSITE_SOURCES).
- Lệnh dev (từ root):

```bash
npm install
npm run dev
```

Hoặc chạy riêng:

```bash
npm run dev --prefix apps/backend
npm run dev --prefix apps/frontend
```

Backend: `http://localhost:5000` (API: `/api/*`)
Frontend: `http://localhost:3000`

## 4) Gợi ý tiếp theo
- Muốn mình chuyển phần "Chức năng" vào `README.md` thay thế bản tóm tắt? Hoặc mình có thể tạo checklist API endpoints chi tiết hơn.

---
Tệp quan trọng tham khảo nhanh:
- `apps/backend/server.js`
- `apps/frontend/src/App.jsx`
- `apps/backend/routes/products.js`
- `apps/backend/routes/community.js`
- `apps/backend/chatbot/index.js`
- `apps/backend/cron/syncProducts.js`
