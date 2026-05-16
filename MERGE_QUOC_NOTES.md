# Báo cáo Merge - nhánh Quốc → cap2

## ✅ Đã Merge

### Frontend
| File | Thay đổi |
|------|----------|
| `apps/frontend/src/components/Header2.jsx` | Gỡ `<LivePriceTicker />` khỏi header (ticker đã chuyển vào từng trang) |
| `apps/frontend/src/components/live-price-ticker.jsx` | Thay thế `framer-motion` bằng CSS animation thuần (`animate-scroll`) |
| `apps/frontend/src/components/PriceCard.jsx` | Hiển thị đơn vị: `product.unit` thay `product.unit \|\| "kg"` |
| `apps/frontend/src/pages/user/Dashboard.jsx` | Thêm `<LivePriceTicker />` ngay dưới Navbar |
| `apps/frontend/src/pages/dealer/DealerDashboard.jsx` | Thêm `<LivePriceTicker />` ngay dưới Navbar |
| `apps/frontend/src/pages/user/ProductDetail.jsx` | Hiển thị đơn vị: `product.unit` thay `product.unit \|\| "kg"` |
| `apps/frontend/src/pages/dealer/DealerProductDetail.jsx` | Hiển thị đơn vị: `product.unit` thay `product.unit \|\| "kg"` |
| `apps/frontend/tailwind.config.js` | Thêm keyframe `scroll` và animation `animate-scroll` cho ticker |
| `apps/frontend/package.json` | Xóa devDependency `baseline-browser-mapping` không cần thiết |

### Backend
| File | Thay đổi |
|------|----------|
| `apps/backend/cron/syncProducts.js` | Đổi tên category từ `"Hồ tiêu"` → `"Tiêu"` |

---

## ❌ Không Merge (lý do)

| File | Lý do giữ nguyên bản gốc |
|------|--------------------------|
| `apps/backend/services/faostatService.js` | File mới chỉ có trong Quốc — **Rule 4** (không tạo file mới) + **Rule 1** (liên quan AI/FAO) |
| `apps/backend/test_fao.cjs` | File mới chỉ có trong Quốc — **Rule 4** + **Rule 1** |
| `apps/backend/services/aiService.js` | Quốc thêm FAO context vào AI prompt — **Rule 1** (không thay đổi AI) |
| `apps/backend/db.js` | Quốc thay đổi cấu trúc DB, xóa bảng `gov_pdf_reports` — **Rule 1** |
| `apps/backend/seed_fake_history.js` | Quốc thay đổi logic seed (xóa dữ liệu cũ rồi tạo lại) — **Rule 1** |
| `apps/backend/scraped/scrape.js` | Quốc xóa lệnh lưu trực tiếp vào DB — **Rule 1** |
| `apps/backend/server.js` | Quốc xóa import và cron job PDF — tính năng đang hoạt động của bạn |
| `apps/backend/routes/dealerUpgrade.js` | Quốc xóa toàn bộ MoMo Webhook — **Rule 2** |
| `apps/backend/routes/alerts.js` | Quốc xóa quyền `admin`/`dealer` — regression (admin sẽ không dùng được alerts) |
| `apps/frontend/src/pages/user/Profile.jsx` | Quốc xóa MoMo flow (QR, polling, logout) — **Rule 2** |
| `apps/frontend/src/pages/admin/Dealers.jsx` | Quốc xóa nút "Hủy vai trò đại lý" — regression |
| `apps/frontend/src/pages/user/Alerts.jsx` | Quốc đổi field name sai (`threshold_price` ≠ `target_price` trong DB) — sẽ lỗi API |
