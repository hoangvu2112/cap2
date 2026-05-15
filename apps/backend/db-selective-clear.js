import pool from "./db.js"

async function selectiveClear() {
  try {
    console.log("🧹 Bắt đầu dọn dẹp dữ liệu chọn lọc...")

    // Tạm thời tắt kiểm tra khóa ngoại để truncate
    await pool.query("SET FOREIGN_KEY_CHECKS = 0")

    const tablesToTruncate = [
      "purchase_request_messages",
      "purchase_requests",
      "dealer_reports",
      "wallet_transactions",
      "community_likes",
      "community_comments",
      "community_posts",
      "favorites",
      "price_alerts",
      "user_costs",
      "user_supply_listings",
      "listing_boosts",
      "conversation_messages",
      "conversation_sessions",
      "direct_messages",
      "direct_message_conversations",
      "password_reset_tokens"
    ]

    for (const table of tablesToTruncate) {
      try {
        await pool.query(`TRUNCATE TABLE ${table}`)
        console.log(`- ✅ Đã dọn sạch bảng: ${table}`)
      } catch (err) {
        console.warn(`- ⚠️ Không thể dọn bảng ${table}: ${err.message}`)
      }
    }

    // Reset ví tiền về 0 thay vì xóa (vì wallets liên kết 1-1 với users)
    await pool.query("UPDATE wallets SET balance = 0, bonus_balance = 0")
    console.log("- ✅ Đã reset số dư ví về 0.")

    // Xóa các user không phải admin hoặc user mẫu mặc định
    // Admin: admin@agriprice.vn, User: user@example.com
    await pool.query("DELETE FROM users WHERE email NOT IN ('admin@agriprice.vn', 'user@example.com')")
    console.log("- ✅ Đã xóa các tài khoản người dùng test.")

    // Bật lại kiểm tra khóa ngoại
    await pool.query("SET FOREIGN_KEY_CHECKS = 1")

    // Dọn dẹp thư mục uploads (xóa các ảnh test)
    console.log("📂 Đang dọn dẹp thư mục uploads...")
    try {
      const fs = await import("fs")
      const path = await import("path")
      const uploadsDir = path.resolve(process.cwd(), "uploads")
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir)
        for (const file of files) {
          if (file !== ".gitkeep") {
            fs.unlinkSync(path.join(uploadsDir, file))
          }
        }
        console.log("- ✅ Đã dọn sạch các tệp tin trong thư mục uploads.")
      }
    } catch (err) {
      console.warn("- ⚠️ Không thể dọn dẹp thư mục uploads:", err.message)
    }

    console.log("✨ Hoàn tất dọn dẹp dữ liệu chọn lọc!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Lỗi khi dọn dẹp dữ liệu:", error)
    process.exit(1)
  }
}

selectiveClear()
