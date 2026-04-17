// apps/backend/routes/test.js
import express from "express";
import pool from "../db.js";

const router = express.Router();

// Route kiểm tra kết nối DB & xem dữ liệu products
router.get("/db", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM products");
        res.json({ success: true, data: rows });
    } catch (error) {
        console.error("❌ Lỗi DB:", error);
        res.status(500).json({ success: false, message: "Database error" });
    }
});

export default router;
