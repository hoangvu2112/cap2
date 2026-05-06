# 🌾 Agricultural Price Tracker  
**Hệ thống theo dõi và dự báo giá nông sản thời gian thực cho nông dân và thương nhân Việt Nam.**

---

## ✨ Tổng Quan

Ứng dụng cho phép người dùng **theo dõi, so sánh, dự báo và nhận cảnh báo giá nông sản**, đồng thời cung cấp **bảng điều khiển quản trị** cho Admin để quản lý sản phẩm, người dùng và tin tức.

---

## 🧭 Tính Năng

### 👨‍🌾 Người Dùng
- **Dashboard giá thời gian thực** – Theo dõi giá nông sản cập nhật liên tục  
- **Biểu đồ lịch sử** – Xem xu hướng giá 30 ngày qua  
- **Danh sách yêu thích** – Lưu và theo dõi sản phẩm quan tâm  
- **Cảnh báo giá** – Nhận thông báo khi giá đạt ngưỡng mong muốn  
- **So sánh giá** – So sánh giá giữa các sản phẩm và khu vực  
- **Diễn đàn cộng đồng** – Thảo luận, chia sẻ kinh nghiệm  
- **Hồ sơ cá nhân** – Quản lý thông tin và cài đặt  

### 👨‍💼 Quản Trị Viên
- **Dashboard tổng quan** – Thống kê toàn hệ thống  
- **Quản lý nông sản** – Thêm, sửa, xóa và cập nhật giá  
- **Quản lý người dùng** – Xem, chỉnh sửa, hoặc xóa tài khoản  
- **Quản lý tin tức** – Đăng bài viết, thông báo, hướng dẫn  
- **Thống kê & biểu đồ** – Phân tích dữ liệu trực quan  
- **Cài đặt hệ thống** – Điều chỉnh thông số chung  

---

## 🛠️ Công Nghệ Sử Dụng

### Backend
- **Runtime:** Node.js  
- **Framework:** Express.js  
- **Authentication:** JWT (JSON Web Token)  
- **Password Hashing:** bcryptjs  
- **Validation:** express-validator  

### Frontend
- **Framework:** React 18  
- **Build Tool:** Vite  
- **Routing:** React Router v6  
- **HTTP Client:** Axios  
- **Styling:** Tailwind CSS v4  
- **Icons:** Lucide React  
- **Charts:** Recharts  
- **UI Utilities:** class-variance-authority, @radix-ui/react-slot  
- **Language:** JavaScript (JSX)  

---

## 📦 Cài Đặt Dự Án

### Yêu Cầu
- Node.js **>= 18**
- npm **>= 9**

---

## 🛠️ Công Nghệ

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Authentication:** JWT (JSON Web Tokens)
- **Password Hashing:** bcryptjs
- **Validation:** express-validator

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Routing:** React Router v6
- **HTTP Client:** Axios
- **Styling:** Tailwind CSS v4
- **Charts:** Recharts
- **Icons:** Lucide React
- **Language:** JavaScript (JSX)

## 📦 Cài Đặt

### Yêu Cầu
- Node.js 18+ và npm

---

# Tạo database tự động khi kết nối mySQL
- Thêm DB_PASS và trong file .env trong Backend
- tạo hoặc xoá trong thư mục gốc của backend
- ..\AgriTrend\apps\backend>
- Tạo database 
```bash
npm run db:init
```
- Xoá database 
```bash
npm run db:clear
```

# Có 2 cách chạy dự án

# Cách 1
### 🪜 Bước 1: Clone hoặc Tải Dự Án
```bash
git clone <your-repo-url>
cd agricultural-price-tracker
```

### 🪜 Bước 2: Cài Đặt Dependencies
- Cài đặt tất cả (frontend + backend) từ thư mục gốc:
\`\`\`bash
npm install

- (hoặc nếu muốn cài riêng: cd backend && npm install, rồi cd ../frontend && npm install)

### 🪜 Bước 3: Cấu Hình Môi Trường

- 📁 Backend
- cd backend
- cp .env.example .env
- Chỉnh sửa .env:
```bash
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=agrirend
PORT=5000
JWT_SECRET=mysecretkey
GOOGLE_CLIENT_ID=

# Optional: thêm nguồn website cho chatbot RAG (JSON array, 1 dòng)
# sourceUrl: URL gốc (backward-compatible)
# sourceUrls: danh sách URL seed để crawl
# maxPages: số trang tối đa mỗi nguồn
# includePathRegex/excludePathRegex: lọc đường dẫn
CHATBOT_WEBSITE_SOURCES=[{"sourceKey":"agri-news","name":"Tin nong nghiep","sourceUrl":"https://example.com","sourceUrls":["https://example.com/blog","https://example.com/news"],"roleScope":"shared","maxPages":8,"followLinks":true,"includePathRegex":"^/(blog|news)","excludePathRegex":"/(tag|author)/"}]
```

- 📁 Frontend
- cd ../frontend
- cp .env.example .env
- Trong .env:
```bash
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=
```

# Chạy Dự Án
### Cách 1 – Chạy từng phần

### Backend:
cd backend
```bash
npm run dev
```
# http://localhost:5000

### Frontend:
cd frontend
```bash
npm run dev
```
# http://localhost:3000

### Cách 2 – Chạy cả hai cùng lúc (từ thư mục gốc)
```bash
npm run dev
```

- Lệnh này dùng package concurrently để chạy:
npm run dev --prefix backend
npm run dev --prefix frontend

---

# Cách 2
### Bước 1: Clone hoặc Download Project

\`\`\`bash
# Clone từ GitHub (nếu có)
git clone <your-repo-url>
cd agricultural-price-tracker

# Hoặc download ZIP và giải nén
\`\`\`

### Bước 2: Cài Đặt Backend

\`\`\`bash
cd backend
npm install

# Tạo file .env từ .env.example
cp .env.example .env

# Chỉnh sửa .env và thay đổi JWT_SECRET
# JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
\`\`\`

### Bước 3: Cài Đặt Frontend

\`\`\`bash
cd ../frontend
npm install

# Tạo file .env từ .env.example
cp .env.example .env

# File .env sẽ có:
# VITE_API_URL=http://localhost:5000/api
\`\`\`

## 🚀 Chạy Dự Án

### Development Mode

Bạn cần mở **2 terminal** để chạy cả backend và frontend:

**Terminal 1 - Backend:**
\`\`\`bash
cd backend
npm run dev
# Server chạy tại http://localhost:5000
\`\`\`

**Terminal 2 - Frontend:**
\`\`\`bash
cd frontend
npm run dev
# App chạy tại http://localhost:3000
\`\`\`

Mở trình duyệt và truy cập [http://localhost:3000](http://localhost:3000)

### Production Mode

**Backend:**
\`\`\`bash
cd backend
npm start
\`\`\`

**Frontend:**
\`\`\`bash
cd frontend
npm run build
npm run preview
\`\`\`

## 🔑 Tài Khoản Test

Hệ thống sử dụng dữ liệu mẫu trong memory, bạn có thể đăng nhập bằng các tài khoản sau:

Mở terminal tại thư mục chứa file hash.js (ở đây là routes).
cd .\apps\backend\routes\    
chạy lệnh sau để sinh ra mk test
```bash
node hash.js
```

Mở file auth.js thay đổi password để sử dụng

### 👨‍💼 Quản Trị Viên (Admin)
\`\`\`
Email: admin@agriprice.vn
Mật khẩu: admin123
\`\`\`
- Truy cập đầy đủ dashboard quản trị
- Quản lý sản phẩm, người dùng, tin tức
- Xem thống kê và cài đặt hệ thống

### 👨‍🌾 Người Dùng Thường (User)
\`\`\`
Email: user@example.com
Mật khẩu: user123
\`\`\`
- Xem dashboard giá nông sản
- Quản lý danh sách yêu thích
- Tạo cảnh báo giá
- Tham gia diễn đàn cộng đồng

### 🎯 Tạo Tài Khoản Mới
Bạn cũng có thể đăng ký tài khoản mới bằng bất kỳ email nào:
- Nếu email là `admin@agriprice.vn` → Tài khoản Admin
- Các email khác → Tài khoản User thường

> **Lưu ý:** Đây là môi trường demo với authentication đơn giản. Trong production, cần implement validation và security đầy đủ.

## 📁 Cấu Trúc Dự Án

\`\`\`
AGRICULTURAL-PRICE-TRACKER/
│
├── backend/
│   ├── routes/
│   ├── middleware/
│   ├── server.js
│   ├── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   ├── package.json
│   └── tsconfig.json (nếu dùng TypeScript)
├── .gitignore
└── README.md


\`\`\`

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `GET /api/auth/me` - Lấy thông tin user hiện tại

### Products
- `GET /api/products` - Lấy danh sách sản phẩm (có filter)
- `GET /api/products/:id` - Lấy chi tiết sản phẩm
- `POST /api/products` - Tạo sản phẩm mới (Admin)
- `PUT /api/products/:id` - Cập nhật sản phẩm (Admin)
- `DELETE /api/products/:id` - Xóa sản phẩm (Admin)

### Users (Admin only)
- `GET /api/users` - Lấy danh sách người dùng
- `PUT /api/users/:id` - Cập nhật người dùng
- `DELETE /api/users/:id` - Xóa người dùng

### Alerts
- `GET /api/alerts` - Lấy cảnh báo của user
- `POST /api/alerts` - Tạo cảnh báo mới
- `PUT /api/alerts/:id` - Cập nhật cảnh báo
- `DELETE /api/alerts/:id` - Xóa cảnh báo

### News
- `GET /api/news` - Lấy tin tức đã publish
- `GET /api/news/admin` - Lấy tất cả tin tức (Admin)
- `POST /api/news` - Tạo tin tức (Admin)
- `PUT /api/news/:id` - Cập nhật tin tức (Admin)
- `DELETE /api/news/:id` - Xóa tin tức (Admin)

### Community
- `GET /api/community` - Lấy danh sách bài viết
- `POST /api/community` - Tạo bài viết mới

## 🎨 Tùy Chỉnh

### Màu Sắc
Chỉnh sửa design tokens trong `frontend/src/index.css`:

\`\`\`css
@theme inline {
  --color-primary: #16a34a;      /* Xanh lá chủ đạo */
  --color-secondary: #f59e0b;    /* Vàng điểm nhấn */
  --color-danger: #ef4444;       /* Đỏ cảnh báo */
  /* ... các màu khác */
}
\`\`\`

### Dữ Liệu Mẫu
Dữ liệu mẫu được lưu trong memory tại các file routes trong `backend/routes/`. Để thay đổi:
1. Tìm biến `products`, `news`, `users`, v.v. trong các file route
2. Chỉnh sửa hoặc thêm dữ liệu mới

### Tích Hợp Database Thật
Để kết nối database thật:

1. **Cài đặt database driver:**
\`\`\`bash
cd backend
npm install pg  # PostgreSQL
# hoặc
npm install mysql2  # MySQL
# hoặc
npm install mongodb  # MongoDB
\`\`\`

2. **Tạo database connection:**
\`\`\`javascript
// backend/db/connection.js
import pg from 'pg'
const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})
\`\`\`

3. **Thay thế mock data bằng database queries:**
\`\`\`javascript
// Thay vì
const products = [...]

// Dùng
const result = await pool.query('SELECT * FROM products')
const products = result.rows
\`\`\`

## 🌐 Deploy

### Deploy Backend

**Option 1: Vercel (Serverless)**
\`\`\`bash
cd backend
# Thêm vercel.json
{
  "version": 2,
  "builds": [{ "src": "server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/server.js" }]
}

vercel deploy
\`\`\`

**Option 2: Railway/Render/Heroku**
1. Push code lên GitHub
2. Connect repository với platform
3. Set environment variables (JWT_SECRET, PORT)
4. Deploy

### Deploy Frontend

**Option 1: Vercel**
\`\`\`bash
cd frontend
vercel deploy
\`\`\`

**Option 2: Netlify**
\`\`\`bash
cd frontend
npm run build
# Upload thư mục dist/ lên Netlify
\`\`\`

**Lưu ý:** Nhớ cập nhật `VITE_API_URL` trong frontend environment variables để trỏ đến backend URL production.

## 🔒 Bảo Mật

### Quan Trọng Cho Production:

1. **Thay đổi JWT_SECRET:**
\`\`\`bash
# Tạo secret key mạnh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
\`\`\`

2. **Sử dụng HTTPS:**
- Luôn dùng HTTPS cho production
- Cấu hình CORS đúng cách

3. **Rate Limiting:**
\`\`\`bash
cd backend
npm install express-rate-limit
\`\`\`

4. **Helmet.js cho security headers:**
\`\`\`bash
cd backend
npm install helmet
\`\`\`

5. **Validate Input:**
- Backend đã có express-validator
- Thêm validation cho tất cả endpoints

## 🐛 Troubleshooting

### Backend không chạy
\`\`\`bash
# Kiểm tra port 5000 có bị chiếm không
lsof -i :5000
# Hoặc thay đổi PORT trong .env
\`\`\`

### Frontend không kết nối được Backend
- Kiểm tra `VITE_API_URL` trong frontend/.env
- Đảm bảo backend đang chạy
- Kiểm tra CORS settings trong backend

### Lỗi CORS
Backend đã cấu hình CORS cho tất cả origins. Nếu cần giới hạn:
\`\`\`javascript
// backend/server.js
app.use(cors({
  origin: 'http://localhost:3000'  // Chỉ cho phép frontend
}))
\`\`\`

### Lỗi JWT Token
- Xóa localStorage trong browser
- Đăng nhập lại
- Kiểm tra JWT_SECRET giống nhau giữa các lần restart

### Lỗi build
\`\`\`bash
# Backend
cd backend
rm -rf node_modules
npm install

# Frontend
cd frontend
rm -rf node_modules dist
npm install
\`\`\`

## 📞 Hỗ Trợ

- **Express.js Docs:** [expressjs.com](https://expressjs.com)
- **React Docs:** [react.dev](https://react.dev)
- **Vite Docs:** [vitejs.dev](https://vitejs.dev)
- **React Router:** [reactrouter.com](https://reactrouter.com)

## 🚀 Tính Năng Tiếp Theo

- [ ] Tích hợp database thật (PostgreSQL/MongoDB)
- [ ] Real-time updates với WebSocket
- [ ] Email notifications cho price alerts
- [ ] Export data to Excel/PDF
- [ ] Mobile app với React Native
- [ ] AI price prediction model
- [ ] Multi-language support

## 📄 License

MIT License - Tự do sử dụng cho mục đích cá nhân và thương mại.

---

**Kiến trúc Backend + Frontend tách biệt** 🚀
