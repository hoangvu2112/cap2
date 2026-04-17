import express from "express"
import { authenticateToken } from "../middleware/auth.js"
import pool from "../db.js"

const router = express.Router()

// Lấy danh sách sản phẩm yêu thích của user hiện tại
router.get("/", authenticateToken, async (req, res) => {
    const userId = req.user.id

    try {
        const [rows] = await pool.query(`
  SELECT 
    f.product_id AS productId, 
    p.name, 
    c.name AS category_name,
    p.currentPrice, 
    p.unit, 
    p.region, 
    p.trend
  FROM favorites f
  JOIN products p ON f.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE f.user_id = ?
`, [req.user.id])



        res.json(rows)
    } catch (error) {
        console.error("❌ Lỗi khi lấy danh sách yêu thích:", error)
        res.status(500).json({ error: "Lỗi máy chủ khi lấy danh sách yêu thích" })
    }
})

// Thêm hoặc bỏ yêu thích (toggle)
router.post("/:productId", authenticateToken, async (req, res) => {
    const userId = req.user.id
    const productId = parseInt(req.params.productId)

    try {
        // Kiểm tra có tồn tại chưa
        const [existing] = await pool.query(
            "SELECT * FROM favorites WHERE user_id = ? AND product_id = ?",
            [userId, productId]
        )

        if (existing.length > 0) {
            // Nếu có rồi thì xóa (bỏ yêu thích)
            await pool.query("DELETE FROM favorites WHERE user_id = ? AND product_id = ?", [
                userId,
                productId,
            ])
            return res.json({ message: "Đã bỏ yêu thích", isFavorite: false })
        } else {
            // Nếu chưa có thì thêm mới
            await pool.query("INSERT INTO favorites (user_id, product_id) VALUES (?, ?)", [
                userId,
                productId,
            ])
            return res.json({ message: "Đã thêm vào yêu thích", isFavorite: true })
        }
    } catch (error) {
        console.error("❌ Lỗi khi cập nhật yêu thích:", error)
        res.status(500).json({ error: "Lỗi máy chủ khi cập nhật yêu thích" })
    }
})

export default router
