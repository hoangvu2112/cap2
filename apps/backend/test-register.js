import pool from './db.js';
import bcrypt from 'bcryptjs';

async function testRegister() {
  try {
    const name = "Test User";
    const email = "test_" + Date.now() + "@example.com";
    const password = "password123";
    const hashedPassword = await bcrypt.hash(password, 10);
    const normalizedRole = "user";

    console.log("🛠️ Đang thử đăng ký user mới:", email);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, avatar_url, role, status, joinDate) VALUES (?, ?, ?, ?, ?, 'active', CURDATE())",
      [name, email, hashedPassword, "", normalizedRole]
    );
    console.log("✅ Đăng ký thành công! ID:", result.insertId);
  } catch (err) {
    console.error("❌ Lỗi đăng ký:", err);
  } finally {
    process.exit(0);
  }
}

testRegister();
