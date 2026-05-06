import pool from "./db.js";

async function seedFakeHistorySmart() {
  try {
    console.log("🚀 Bắt đầu kiểm tra và trám dữ liệu lịch sử...");
    
    // 1. Lấy danh sách sản phẩm hiện có
    const [products] = await pool.query("SELECT id, name, currentPrice FROM products");
    
    let totalProductsFaked = 0;
    let totalRecordsInserted = 0;
    const daysToBackfill = 180; // 6 tháng

    for (const p of products) {
      // 2. KIỂM TRA: Sản phẩm này đã có lịch sử chưa?
      const [history] = await pool.query(
        "SELECT COUNT(*) as count FROM price_history WHERE product_id = ?", 
        [p.id]
      );

      // Nếu đã có dữ liệu lịch sử (count > 0), bỏ qua sản phẩm này
      if (history[0].count > 0) {
        console.log(`- ⏩ Bỏ qua [${p.name}]: Đã có ${history[0].count} bản ghi thực.`);
        continue; 
      }

      // 3. THỰC HIỆN FAKE: Nếu chưa có dữ liệu nào
      totalProductsFaked++;
      let basePrice = Number(p.currentPrice);
      if (!basePrice || basePrice <= 0) basePrice = 50000;

      // Cấu hình biên độ dao động (Giữ nguyên logic của bạn vì khá ổn)
      let maxDeviation, stepMin, stepMax;
      if (basePrice < 40000) {
        maxDeviation = 5000; stepMin = 500; stepMax = 1500;
      } else if (basePrice <= 100000) {
        maxDeviation = 7000; stepMin = 1000; stepMax = 2500;
      } else if (basePrice <= 150000) {
        maxDeviation = 9000; stepMin = 1500; stepMax = 3000;
      } else {
        maxDeviation = 12000; stepMin = 2000; stepMax = 4000;
      }

      let minPrice = basePrice - maxDeviation;
      let maxPrice = basePrice + maxDeviation;
      if (minPrice < 1000) minPrice = 1000;

      console.log(`- 🛠 Đang tạo 6 tháng dữ liệu cho [${p.name}] (Giá gốc: ${basePrice})`);
      
      let currentSimulatedPrice = basePrice;
      const inserts = [];

      for (let i = 1; i <= daysToBackfill; i++) {
        let step = Math.floor(Math.random() * (stepMax - stepMin + 1)) + stepMin;
        
        // Thuật toán Mean Reversion: Giữ giá xoay quanh giá thực tế vừa cào
        let upProb = 0.5;
        if (currentSimulatedPrice > basePrice + maxDeviation * 0.5) upProb = 0.2;
        else if (currentSimulatedPrice < basePrice - maxDeviation * 0.5) upProb = 0.8;

        let direction = Math.random() < upProb ? 1 : -1;
        if (Math.random() < 0.2) step = 0; // 20% giữ nguyên giá

        currentSimulatedPrice += (step * direction);

        // Chặn biên
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
        totalRecordsInserted += inserts.length;
      }
    }

    console.log(`\n✅ HOÀN TẤT:`);
    console.log(`- Số sản phẩm mới được bổ sung lịch sử: ${totalProductsFaked}`);
    console.log(`- Tổng số bản ghi fake đã thêm: ${totalRecordsInserted}`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi nghiêm trọng:", error);
    process.exit(1);
  }
}

seedFakeHistorySmart();
