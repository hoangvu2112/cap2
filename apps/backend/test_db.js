import pool from "./db.js";

(async () => {
  try {
    const [result] = await pool.query(
      "INSERT INTO user_supply_listings (user_id, product_id, quantity_available, harvest_start, harvest_end, supply_status, note) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [2, 1, 5000, "2026-05-01", "2026-05-30", "partial", "hàng loại 1"]
    );
    console.log("Success Insert:", result.insertId);
    
    const [[created]] = await pool.query(
      `
        SELECT
          usl.id,
          usl.user_id,
          usl.product_id,
          usl.quantity_available,
          usl.harvest_start,
          usl.harvest_end,
          usl.supply_status,
          usl.note,
          usl.created_at,
          usl.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          p.currentPrice AS current_price,
          p.previousPrice AS previous_price
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        WHERE usl.id = ?
      `,
      [result.insertId]
    );
    console.log("Success Select:", created);
    process.exit(0);
  } catch (e) {
    console.error("DB Error:", e.message);
    process.exit(1);
  }
})();
