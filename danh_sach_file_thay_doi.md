# Danh Sách Các File Thay Đổi và Tạo Mới

Tài liệu này tổng hợp toàn bộ các file đã được chỉnh sửa và tạo mới trong quá trình phát triển tính năng **Báo cáo Quản trị Tài chính & Doanh thu** cùng **Hệ thống Cảnh báo & Thông báo** của dự án AgroInsight.

---

## I. Phân Hệ: Báo Cáo Quản Trị Tài Chính & Doanh Thu
Phân hệ này cho phép Admin theo dõi dòng tiền nạp, doanh thu từ các nguồn (hoa hồng, ghim bài viết, nâng cấp tài khoản đại lý) thông qua hệ thống tab điều hướng hiện đại, stat cards nổi bật và biểu đồ tương tác Recharts (vùng & tròn).

### 1. Phía Backend (Máy chủ)
*   #### [MODIFY] [apps/backend/.env](file:///c:/Users/trana/cap2/demo1/cap2/apps/backend/.env)
    *   **Mô tả:** Đổi cấu hình biến kết nối cổng cơ sở dữ liệu Cloud của Aiven từ `PORT = 18913` (gây đè cổng server) thành `DB_PORT=18913`.
    *   **Lý do:** Giúp Backend khởi chạy bình thường trên cổng `5000` và kết nối chính xác vào cổng dịch vụ MySQL của Aiven.

*   #### [NEW] [apps/backend/routes/admin.js](file:///c:/Users/trana/cap2/demo1/cap2/apps/backend/routes/admin.js)
    *   **Mô tả:** Viết mới API Endpoint `GET /api/admin/statistics` thực thi song song 3 nhóm truy vấn tối ưu:
        *   **Nhóm A (Tổng quan):** Tính tổng tiền nạp (`deposit`) và phân tách chi tiết 3 nguồn doanh thu (`commission`, `boost_pin`, `upgrade_dealer`).
        *   **Nhóm B (Vai trò):** Thống kê dòng tiền nạp gom nhóm theo vai trò của người dùng.
        *   **Nhóm C (Thời gian):** Lấy dòng tiền & doanh thu biến động theo ngày.
    *   **Lưu ý kỹ thuật:** 
        *   Chống SQL Injection bằng kiểm tra ràng buộc số nguyên cho tham số `days`.
        *   Hỗ trợ tham số `days = "all"` để tự động nâng khoảng thời gian lọc lên 100 năm (`36500` ngày) nhằm thống kê toàn bộ lịch sử trong database.
        *   Gộp nhóm bằng `GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')` để khắc phục triệt độ lỗi `ONLY_FULL_GROUP_BY` trên MySQL Cloud.

*   #### [MODIFY] [apps/backend/server.js](file:///c:/Users/trana/cap2/demo1/cap2/apps/backend/server.js)
    *   **Mô tả:** Import router admin `adminRoutes` và đăng ký định tuyến thông qua `app.use("/api/admin", adminRoutes)`.
    *   **Lý do:** Cho phép Client truy cập đúng đường dẫn API quản trị tài chính `/api/admin/statistics`.

---

### 2. Phía Frontend (Giao diện)
*   #### [MODIFY] [apps/frontend/src/pages/admin/Dashboard.jsx](file:///c:/Users/trana/cap2/demo1/cap2/apps/frontend/src/pages/admin/Dashboard.jsx)
    *   **Mô tả:** Thiết kế lại toàn bộ giao diện quản trị thành hệ thống Dual-Tab song song:
        *   **Tab "Tổng quan hệ thống":** Giữ nguyên các thông tin thống kê người dùng, sản phẩm cũ.
        *   **Tab "Báo cáo Tài chính & Doanh thu":** Phân hệ báo cáo tài chính cao cấp mới.
    *   **Chi tiết giao diện mới:**
        *   **Thanh bộ lọc thời gian:** Gồm các nút bấm trực quan `Tất cả` (mặc định), `7 ngày qua`, `14 ngày qua`, `30 ngày qua` cùng nút Tải lại dữ liệu (Refresh).
        *   **5 Stat Cards:** Tổng tiền nạp, Doanh thu hoa hồng, Doanh thu ghim bài, Doanh thu nâng cấp đại lý, và **Tổng doanh thu thực tế** (làm nổi bật bằng gradient xanh lục).
        *   **Biểu đồ vùng (Area Chart):** Thể hiện trực quan xu hướng tăng trưởng dòng tiền nạp và doanh thu theo thời gian.
        *   **Biểu đồ tròn (Pie Chart):** Thể hiện cơ cấu nguồn tiền nạp phân bổ theo từng vai trò (FARMER, DEALER...) kèm chú thích số tiền chi tiết.

---

## II. Phân Hệ: Hệ Thống Cảnh Báo & Thông Báo
Phân hệ này đảm nhận việc tạo cảnh báo giá cho nông sản và tích hợp toàn bộ các tin nhắn, cập nhật trạng thái thương lượng mua bán nông sản thành thông báo thời gian thực gửi tới người dùng.

### 1. Phía Backend (Máy chủ)
*   #### [MODIFY] [apps/backend/routes/alerts.js](file:///c:/Users/trana/cap2/demo1/cap2/apps/backend/routes/alerts.js)
    *   **Mô tả:** 
        *   Viết API `POST /api/alerts` để tạo mới các cảnh báo giá nông sản (lưu vào bảng `price_alerts`).
        *   Viết API `GET /api/alerts` tổng hợp và trộn lẫn thông minh 3 luồng thông tin:
            1.  **Cảnh báo giá:** Các thay đổi tăng/giảm giá của nông sản đang được theo dõi.
            2.  **Yêu cầu thương lượng nông sản:** Yêu cầu thương lượng gửi từ đại lý (incoming) và phản hồi từ nông dân (outgoing).
            3.  **Tin nhắn thương lượng mới:** Tin nhắn trao đổi mới nhất từ đối tác thương lượng (`purchase_request_messages`).
        *   Sắp xếp tự động tất cả thông báo theo thời gian thực giảm dần (`created_at`).
        *   Hỗ trợ kiểm tra cấu hình dịch vụ gửi mail SMTP qua `GET /api/alerts/config-status`.
        *   Viết API `DELETE /api/alerts/:id` để huỷ/xoá cảnh báo giá nông sản.

*   #### [MODIFY] [apps/backend/routes/listingBoosts.js](file:///c:/Users/trana/cap2/demo1/cap2/apps/backend/routes/listingBoosts.js)
    *   **Mô tả:** Chỉnh sửa logic trừ ví khi mua gói ghim bài viết để tự động ghi nhận giao dịch ví với mục đích `purpose = 'boost_pin'` vào bảng `wallet_transactions`.
    *   **Lý do:** Giúp hệ thống tài chính Admin gom và tính toán chính xác doanh thu từ dịch vụ ghim bài viết nông sản.
