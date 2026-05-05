import express from "express";
import pool from "../db.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";

const router = express.Router();

// Lấy TẤT CẢ chi phí của người dùng hiện tại (kèm tên sản phẩm)
router.get("/", authenticateToken, requireRole("user"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         uc.product_id, 
         uc.cost_price, 
         p.name AS product_name, 
         p.unit AS product_unit
       FROM user_costs uc
       JOIN products p ON uc.product_id = p.id
       WHERE uc.user_id = ?`,
      [req.user.id]
    );
    res.json(rows.map(r => ({ ...r, cost_price: Number(r.cost_price) })));
  } catch (error) {
    console.error("❌ Lỗi khi lấy chi phí người dùng:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// Lấy chi phí cho MỘT sản phẩm cụ thể
router.get("/:productId", authenticateToken, requireRole("user"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT cost_price FROM user_costs WHERE user_id = ? AND product_id = ?",
      [req.user.id, req.params.productId]
    );
    if (rows.length > 0) {
      res.json({ cost_price: Number(rows[0].cost_price) });
    } else {
      res.json({ cost_price: 0 }); // Mặc định là 0 nếu chưa đặt
    }
  } catch (error) {
    console.error("❌ Lỗi khi lấy chi phí sản phẩm:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// Thêm hoặc Cập nhật chi phí (Hàm "Upsert")
router.post("/", authenticateToken, requireRole("user"), async (req, res) => {
  const { product_id, cost_price } = req.body;
  if (!product_id || cost_price === undefined) {
    return res.status(400).json({ error: "Thiếu product_id hoặc cost_price" });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO user_costs (user_id, product_id, cost_price)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE cost_price = ?`,
      [req.user.id, product_id, cost_price, cost_price]
    );

    res.status(201).json({
      user_id: req.user.id,
      product_id,
      cost_price: Number(cost_price),
    });
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật chi phí:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});

// ==========================================================
// --- 🚀 TÍNH NĂNG MỚI: Xóa một chi phí ---
// ==========================================================
router.delete("/:productId", authenticateToken, requireRole("user"), async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM user_costs WHERE user_id = ? AND product_id = ?",
      [req.user.id, req.params.productId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy chi phí để xóa" });
    }

    res.json({ message: "Đã xóa chi phí thành công" });
  } catch (error) {
    console.error("❌ Lỗi khi xóa chi phí:", error);
    res.status(500).json({ error: "Lỗi máy chủ" });
  }
});


export default router;