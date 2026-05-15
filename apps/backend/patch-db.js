import pool from './db.js';

async function patch() {
  try {
    console.log("🛠️ Đang nâng cấp Enum cho wallet_transactions...");
    await pool.query("ALTER TABLE wallet_transactions MODIFY COLUMN purpose ENUM('boost_pin', 'commission', 'mock_deposit', 'upgrade_dealer') NOT NULL");
    console.log("✅ Thành công!");
  } catch (err) {
    console.error("❌ Lỗi:", err.message);
  } finally {
    process.exit(0);
  }
}

patch();
