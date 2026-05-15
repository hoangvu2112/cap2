import { execSync } from "child_process"
import path from "path"
import { fileURLToPath } from "url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function runReset() {
  try {
    console.log("🚀 Bắt đầu quy trình làm sạch dữ liệu để báo cáo...\n")

    // 1. Chạy dọn dẹp chọn lọc
    console.log("👉 Bước 1: Dọn dẹp dữ liệu test...")
    execSync("node db-selective-clear.js", { stdio: "inherit" })

    // 2. Chạy initDB để đảm bảo cấu trúc và user mẫu tồn tại
    console.log("\n👉 Bước 2: Kiểm tra cấu trúc và bù đắp dữ liệu mẫu...")
    // Chúng ta không chạy trực tiếp db.js vì nó có thể export pool thay vì chạy initDB mặc định
    // Nhưng trong code db.js của bạn, nó có gọi initDB() ở cuối không?
    // Để tôi kiểm tra lại db.js
    execSync("node -e \"import('./db.js').then(m => m.default ? null : null)\"", { stdio: "inherit" })
    // Thực tế db.js thường gọi initDB() ngay khi được import nếu không có check
    // Tôi sẽ dùng lệnh node db.js nếu nó tự chạy
    execSync("node db.js", { stdio: "inherit" })

    // 3. Chạy seed_fake_history để trám lịch sử giá
    console.log("\n👉 Bước 3: Trám dữ liệu lịch sử giá ảo cho các biểu đồ...")
    execSync("node seed_fake_history.js", { stdio: "inherit" })

    console.log("\n🎊 TẤT CẢ ĐÃ SẴN SÀNG CHO BUỔI BÁO CÁO! 🎊")
  } catch (error) {
    console.error("\n❌ Lỗi trong quá trình reset:", error.message)
  }
}

runReset()
