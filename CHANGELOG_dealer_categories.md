# Nâng cấp tính năng "Đại lý gần đây" & "Nâng cấp Đại lý"

## Tổng quan
Nâng cấp hệ thống để ràng buộc hiển thị đại lý theo **danh mục thu mua** và **khu vực địa lý**, thay vì hiển thị tất cả đại lý một cách bừa bãi.

---

## Bước 1: Database — Tạo bảng `dealer_categories`

**File:** `apps/backend/db.js`

Thêm bảng quan hệ Many-to-Many giữa đại lý và danh mục nông sản:

```sql
CREATE TABLE IF NOT EXISTS dealer_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  category_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_dealer_category (user_id, category_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
)
```

**Ý nghĩa:** Mỗi đại lý có thể đăng ký thu mua nhiều danh mục (Cà phê, Hồ tiêu, Trái cây...). Bảng này liên kết `user_id` (dealer) với `category_id` (từ bảng `categories` có sẵn).

---

## Bước 2: Backend — Sửa endpoint `/purchase-requests/partners`

**File:** `apps/backend/routes/purchaseRequests.js`

### Logic mới:
1. Nhận `productId` từ frontend
2. Truy vấn `category_id` của sản phẩm đang xem
3. **Nếu user là nông dân** xem sản phẩm → chỉ hiển thị đại lý có `INNER JOIN dealer_categories` trùng `category_id`
4. **Nếu user là đại lý** xem sản phẩm → hiển thị nông dân cung ứng (không lọc theo dealer_categories)
5. **Fallback:** Nếu sản phẩm không có category → hiển thị tất cả đại lý (tương thích ngược)

### Kết quả:
- Đại lý A chỉ thu mua [Cà phê, Hồ tiêu] → **KHÔNG** hiển thị trên sản phẩm Sầu riêng
- Đại lý B thu mua [Trái cây] → **CÓ** hiển thị trên sản phẩm Sầu riêng (vì Sầu riêng thuộc category Trái cây)

---

## Bước 2b: Backend — Sửa endpoint `/dealer-upgrade/apply`

**File:** `apps/backend/routes/dealerUpgrade.js`

### Thay đổi:
- Nhận thêm field `category_ids` (mảng ID danh mục) từ frontend
- Validation: bắt buộc chọn ít nhất 1 danh mục
- Sau khi tạo request thành công → lưu vào bảng `dealer_categories`

### API mới thêm:
- `GET /dealer-upgrade/my-categories` — Lấy danh mục thu mua hiện tại của đại lý
- `PUT /dealer-upgrade/my-categories` — Cập nhật danh mục thu mua (chỉ dealer)

---

## Bước 3a: Frontend — Form đăng ký bắt buộc chọn Tỉnh/Thành phố

**File:** `apps/frontend/src/pages/auth/Register2.jsx`

### Thay đổi:
- Thêm dropdown `<select>` chọn Tỉnh/Thành phố (bắt buộc, 63 tỉnh thành)
- Validation: không cho đăng ký nếu chưa chọn region
- Gửi `region` lên backend khi register

**File:** `apps/backend/routes/auth.js`
- Endpoint `/register` nhận thêm field `region`
- Validation: bắt buộc có region
- Lưu vào cột `region` trong bảng `users`

**File:** `apps/frontend/src/context/AuthContext.jsx`
- Hàm `register()` nhận thêm param `region` và truyền lên API

---

## Bước 3b: Frontend — Form nâng cấp đại lý thêm Multi-select danh mục

**File:** `apps/frontend/src/pages/user/Profile.jsx`

### Thay đổi:
- **Xóa:** Input text tự do "Mặt hàng kinh doanh chính" (business_items)
- **Thêm:** Multi-select checkbox hiển thị tất cả categories từ API `/products/categories`
- State `selectedCategoryIds` lưu mảng ID đã chọn
- Tự động lưu nháp vào localStorage
- Validation step 1: bắt buộc chọn ít nhất 1 danh mục
- Khi submit: gửi `category_ids` lên backend

### Giao diện:
- Grid 2-3 cột checkbox với style highlight khi được chọn
- Hiển thị số lượng danh mục đã chọn

---

## Tóm tắt luồng hoạt động

```
1. User đăng ký → Bắt buộc chọn Tỉnh/Thành phố → Lưu vào users.region

2. User nâng cấp lên Đại lý:
   → Bước 1: Điền hồ sơ pháp lý + Chọn danh mục thu mua (checkbox)
   → Backend lưu vào bảng dealer_categories
   → Bước 2: Chọn gói cước
   → Bước 3: Thanh toán

3. Nông dân xem chi tiết sản phẩm (VD: Sầu riêng, category_id = 2):
   → Frontend gọi GET /purchase-requests/partners?productId=X
   → Backend: JOIN dealer_categories WHERE category_id = 2
   → Chỉ trả về đại lý CÓ đăng ký thu mua "Trái cây"
   → Sắp xếp: cùng tỉnh > cùng miền > miền khác
```

---

## Danh sách file đã sửa

| File | Thay đổi |
|------|----------|
| `apps/backend/db.js` | Thêm bảng `dealer_categories` |
| `apps/backend/routes/purchaseRequests.js` | Sửa endpoint `/partners` — JOIN dealer_categories |
| `apps/backend/routes/dealerUpgrade.js` | Sửa `/apply` nhận category_ids + thêm 2 API mới |
| `apps/backend/routes/auth.js` | Sửa `/register` nhận và lưu region |
| `apps/frontend/src/pages/auth/Register2.jsx` | Thêm dropdown chọn Tỉnh/Thành phố |
| `apps/frontend/src/context/AuthContext.jsx` | Hàm register() nhận thêm param region |
| `apps/frontend/src/pages/user/Profile.jsx` | Thay input text bằng multi-select checkbox |

---

## Bước bổ sung: Cập nhật 34 tỉnh thành mới (sau sáp nhập 2025)

### Danh sách 34 tỉnh thành mới:

**6 Thành phố trực thuộc Trung ương:**
1. Hà Nội
2. Hồ Chí Minh (+ Bình Dương, Bà Rịa - Vũng Tàu)
3. Hải Phòng (+ Hải Dương)
4. Đà Nẵng (+ Quảng Nam)
5. Cần Thơ (+ Sóc Trăng, Hậu Giang)
6. Huế

**12 tỉnh Miền Bắc:**
Quảng Ninh, Cao Bằng, Lạng Sơn, Lai Châu, Điện Biên, Sơn La, Tuyên Quang (+Hà Giang), Lào Cai (+Yên Bái), Thái Nguyên (+Bắc Kạn), Phú Thọ (+Vĩnh Phúc+Hòa Bình), Bắc Ninh (+Bắc Giang), Hưng Yên (+Thái Bình)

**8 tỉnh Miền Trung & Tây Nguyên:**
Thanh Hóa, Nghệ An, Hà Tĩnh, Ninh Bình (+Hà Nam+Nam Định), Quảng Trị (+Quảng Bình), Quảng Ngãi (+Kon Tum), Gia Lai (+Bình Định), Khánh Hòa (+Ninh Thuận)

**8 tỉnh Nam Trung Bộ & Nam Bộ:**
Lâm Đồng (+Đắk Nông+Bình Thuận), Đắk Lắk (+Phú Yên), Đồng Nai (+Bình Phước), Tây Ninh (+Long An), Vĩnh Long (+Bến Tre+Trà Vinh), Đồng Tháp (+Tiền Giang), An Giang (+Kiên Giang), Cà Mau (+Bạc Liêu)

### Các file đã sửa:

| File | Thay đổi |
|------|----------|
| `apps/frontend/src/pages/auth/Register2.jsx` | Cập nhật mảng PROVINCES từ 63 → 34 tỉnh thành |
| `apps/backend/routes/purchaseRequests.js` | Cập nhật REGION_GROUPS theo 34 tỉnh thành mới |
| `apps/frontend/src/pages/user/PriceMap.jsx` | Cập nhật PROVINCE_COORDS, PROVINCE_SPECIALTIES, thêm OLD_TO_NEW_PROVINCE mapping |

### Tương thích ngược (backward compatibility):
- Thêm object `OLD_TO_NEW_PROVINCE` trong PriceMap.jsx để map tên tỉnh cũ trong DB sang tỉnh mới
- Hàm `getCoords()` và `getSpecialties()` tự động fallback qua mapping nếu không tìm thấy tên mới
- Dữ liệu cũ trong DB (products có region = "Bình Dương") vẫn hiển thị đúng trên bản đồ (map sang "Hồ Chí Minh")
