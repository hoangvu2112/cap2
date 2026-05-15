import pool from "../db.js";

async function simulateMarket() {
  try {
    console.log("🚀 Đang khởi tạo kịch bản biến động thị trường...");

    // 1. Lấy danh sách sản phẩm
    const [products] = await pool.query("SELECT id, currentPrice FROM products");

    if (products.length === 0) {
      console.log("⚠️ Không tìm thấy sản phẩm nào để giả lập.");
      return;
    }

    // 2. Xóa lịch sử cũ để làm mới hoàn toàn
    await pool.query("DELETE FROM price_history");
    console.log("🗑️ Đã dọn dẹp lịch sử giá cũ.");

    const historyEntries = [];
    const now = new Date();

    for (const product of products) {
      const basePrice = Number(product.currentPrice);
      console.log(`📊 Đang giả lập cho sản phẩm #${product.id} (Giá gốc: ${basePrice})`);

      // Giả lập 365 ngày
      let lastPrice = basePrice;
      
      for (let i = 0; i < 365; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (364 - i));

        // Biến động ngẫu nhiên +/- 3% mỗi ngày
        const volatility = 0.03;
        const change = 1 + (Math.random() * volatility * 2 - volatility);
        
        // Thêm một chút xu hướng dài hạn (Random walk)
        lastPrice = Math.round(lastPrice * change);
        
        // Giới hạn giá không thấp quá hoặc cao quá so với gốc (biên độ +/- 40%)
        if (lastPrice < basePrice * 0.6) lastPrice = Math.round(basePrice * 0.6);
        if (lastPrice > basePrice * 1.4) lastPrice = Math.round(basePrice * 1.4);

        historyEntries.push([
          product.id,
          lastPrice,
          date.toISOString().slice(0, 19).replace("T", " ")
        ]);
      }
      
      // Cập nhật giá hiện tại và giá trước đó cho sản phẩm để đồng bộ trend
      const prevPrice = historyEntries[historyEntries.length - 2][1];
      const trend = lastPrice > prevPrice ? "up" : lastPrice < prevPrice ? "down" : "stable";
      
      await pool.query(
        "UPDATE products SET currentPrice = ?, previousPrice = ?, trend = ?, lastUpdate = NOW() WHERE id = ?",
        [lastPrice, prevPrice, trend, product.id]
      );
    }

    // 3. Chèn dữ liệu vào DB (Batch insert để nhanh)
    const chunkSize = 1000;
    for (let i = 0; i < historyEntries.length; i += chunkSize) {
      const chunk = historyEntries.slice(i, i + chunkSize);
      await pool.query(
        "INSERT INTO price_history (product_id, price, updated_at) VALUES ?",
        [chunk]
      );
      console.log(`✅ Đã chèn ${i + chunk.length}/${historyEntries.length} bản ghi...`);
    }

    console.log("✨ Hoàn tất giả lập biến động thị trường!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi giả lập:", error);
    process.exit(1);
  }
}

simulateMarket();
