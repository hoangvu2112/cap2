import pool from "./db.js";

async function seedFakeHistory() {
  try {
    console.log("Xóa dữ liệu fake cũ để làm lại...");
    await pool.query("DELETE FROM price_history WHERE DATE(updated_at) < CURDATE()");

    console.log("Bắt đầu tạo dữ liệu lịch sử giá mới...");
    const [products] = await pool.query("SELECT id, name, currentPrice FROM products");

    let totalInserted = 0;
    const daysToBackfill = 180; // 6 tháng

    for (const p of products) {
      let basePrice = Number(p.currentPrice);
      if (!basePrice || basePrice <= 0) basePrice = 50000;

      // Phân loại mặt hàng >70k và <70k
      const isHighValue = basePrice >= 70000;
      const maxDeviation = isHighValue ? 30000 : 15000;
      
      let minPrice = basePrice - maxDeviation;
      let maxPrice = basePrice + maxDeviation;
      if (minPrice < 5000) minPrice = 5000; // Không để rớt giá xuống quá rẻ mạt

      console.log(`Đang tính toán cho: ${p.name} (Base: ${basePrice})`);
      let currentSimulatedPrice = basePrice;
      const inserts = [];

      for (let i = 1; i <= daysToBackfill; i++) {
        // Mức chênh lệch ngày tuỳ theo giá
        let step = isHighValue 
            ? (Math.floor(Math.random() * 6) + 5) * 1000  // 5k -> 10k
            : (Math.floor(Math.random() * 2) + 2) * 1000; // 2k -> 3k

        // Tính lực hồi (Mean Reversion để giá lên xuống luân phiên theo sóng)
        let upProb = 0.5;
        if (currentSimulatedPrice > basePrice + maxDeviation * 0.6) {
           upProb = 0.1; // Chạm trần -> ép rớt giá
        } else if (currentSimulatedPrice < basePrice - maxDeviation * 0.6) {
           upProb = 0.9; // Chạm đáy -> ép tăng giá
        } else {
           // Đi lướt sóng nhẹ
           upProb = Math.random() > 0.5 ? 0.65 : 0.35;
        }

        let direction = Math.random() < upProb ? 1 : -1;
        let change = step * direction;

        // 25% tỷ lệ giá không thay đổi trong ngày (đóng băng giá)
        if (Math.random() < 0.25) {
            change = 0;
        }

        currentSimulatedPrice += change;

        // Bo biên độ nghiêm ngặt không cho vượt rào
        if (currentSimulatedPrice > maxPrice) currentSimulatedPrice = maxPrice;
        if (currentSimulatedPrice < minPrice) currentSimulatedPrice = minPrice;

        const date = new Date();
        date.setDate(date.getDate() - i);
        
        inserts.push([p.id, currentSimulatedPrice, date]);
      }

      if (inserts.length > 0) {
          await pool.query(
              "INSERT INTO price_history (product_id, price, updated_at) VALUES ?",
              [inserts]
          );
          totalInserted += inserts.length;
      }
    }

    console.log(`Hoàn thành! Đã reset và thêm lại ${totalInserted} dòng dữ liệu theo yêu cầu.`);
    process.exit(0);
  } catch (error) {
    console.error("Lỗi:", error);
    process.exit(1);
  }
}

seedFakeHistory();
