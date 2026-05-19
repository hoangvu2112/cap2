import express from "express"
import pool from "../db.js"
import { authenticateToken } from "../middleware/auth.js"

const router = express.Router()

/**
 * GET /api/dealer-locations
 * Lấy tất cả địa điểm đại lý (public - hiển thị trên bản đồ)
 */
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        l.id, l.user_id, l.branch_name, l.region_label, l.address,
        l.latitude, l.longitude, l.province, l.ward,
        l.phone, l.business_hours, l.image_url,
        l.created_at, l.updated_at,
        u.name AS dealer_name, u.email AS dealer_email, u.avatar_url
      FROM dealer_locations l
      JOIN users u ON u.id = l.user_id
      WHERE u.role = 'dealer'
      ORDER BY l.updated_at DESC
    `)
    res.json({ success: true, locations: rows })
  } catch (err) {
    console.error("GET /dealer-locations error:", err)
    res.status(500).json({ error: "Không thể tải danh sách địa điểm đại lý" })
  }
})

/**
 * GET /api/dealer-locations/me
 * Lấy địa điểm của dealer đang đăng nhập
 */
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT * FROM dealer_locations WHERE user_id = ? LIMIT 1",
      [req.user.id]
    )
    res.json({ success: true, location: row || null })
  } catch (err) {
    console.error("GET /dealer-locations/me error:", err)
    res.status(500).json({ error: "Không thể tải địa điểm của bạn" })
  }
})

/**
 * POST /api/dealer-locations
 * Tạo hoặc cập nhật địa điểm cho dealer hiện tại
 */
router.post("/", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "dealer" && req.user.role !== "admin") {
      return res.status(403).json({ error: "Chỉ đại lý mới có thể đăng ký địa điểm" })
    }

    const {
      address, latitude, longitude, place_id, province, ward,
      branch_name, region_label, phone, business_hours, image_url,
    } = req.body

    if (!address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Thiếu thông tin địa chỉ hoặc tọa độ" })
    }

    const lat = Number(latitude)
    const lng = Number(longitude)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "Tọa độ không hợp lệ" })
    }

    // Validate phone (nếu có): bắt đầu bằng 0, có 10-11 số
    if (phone && phone.trim()) {
      const cleaned = phone.replace(/\s|-|\./g, "")
      if (!/^0\d{9,10}$/.test(cleaned)) {
        return res.status(400).json({ error: "Số điện thoại không hợp lệ" })
      }
    }

    // Upsert: 1 dealer chỉ có 1 địa điểm (UNIQUE user_id)
    await pool.query(
      `
        INSERT INTO dealer_locations
          (user_id, branch_name, region_label, address, place_id, latitude, longitude, province, ward, phone, business_hours, image_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          branch_name = VALUES(branch_name),
          region_label = VALUES(region_label),
          address = VALUES(address),
          place_id = VALUES(place_id),
          latitude = VALUES(latitude),
          longitude = VALUES(longitude),
          province = VALUES(province),
          ward = VALUES(ward),
          phone = VALUES(phone),
          business_hours = VALUES(business_hours),
          image_url = VALUES(image_url),
          updated_at = CURRENT_TIMESTAMP
      `,
      [
        req.user.id,
        branch_name?.trim() || null,
        region_label?.trim() || null,
        address.trim(),
        place_id || null,
        lat, lng,
        province || null, ward || null,
        phone?.trim() || null,
        business_hours?.trim() || null,
        image_url?.trim() || null,
      ]
    )

    const [[saved]] = await pool.query(
      "SELECT * FROM dealer_locations WHERE user_id = ? LIMIT 1",
      [req.user.id]
    )
    res.json({ success: true, location: saved })
  } catch (err) {
    console.error("POST /dealer-locations error:", err)
    res.status(500).json({ error: "Không thể lưu địa điểm" })
  }
})

/**
 * DELETE /api/dealer-locations/me
 */
router.delete("/me", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM dealer_locations WHERE user_id = ?", [req.user.id])
    res.json({ success: true })
  } catch (err) {
    console.error("DELETE /dealer-locations/me error:", err)
    res.status(500).json({ error: "Không thể xóa địa điểm" })
  }
})

/**
 * PUT /api/dealer-locations/:id
 * Admin chỉnh sửa địa điểm bất kỳ
 */
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Chỉ admin mới có quyền sửa địa điểm của đại lý khác" })
    }

    const id = Number(req.params.id)
    const {
      address, latitude, longitude, place_id, province, ward,
      branch_name, region_label, phone, business_hours, image_url,
    } = req.body

    if (!address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Thiếu thông tin địa chỉ hoặc tọa độ" })
    }

    const lat = Number(latitude)
    const lng = Number(longitude)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: "Tọa độ không hợp lệ" })
    }

    if (phone && phone.trim()) {
      const cleaned = phone.replace(/\s|-|\./g, "")
      if (!/^0\d{9,10}$/.test(cleaned)) {
        return res.status(400).json({ error: "Số điện thoại không hợp lệ" })
      }
    }

    const [result] = await pool.query(
      `
        UPDATE dealer_locations
        SET branch_name = ?, region_label = ?, address = ?, place_id = ?,
            latitude = ?, longitude = ?, province = ?, ward = ?,
            phone = ?, business_hours = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        branch_name?.trim() || null,
        region_label?.trim() || null,
        address.trim(),
        place_id || null,
        lat, lng,
        province || null, ward || null,
        phone?.trim() || null,
        business_hours?.trim() || null,
        image_url?.trim() || null,
        id,
      ]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy địa điểm" })
    }

    const [[saved]] = await pool.query("SELECT * FROM dealer_locations WHERE id = ? LIMIT 1", [id])
    res.json({ success: true, location: saved })
  } catch (err) {
    console.error("PUT /dealer-locations/:id error:", err)
    res.status(500).json({ error: "Không thể cập nhật địa điểm" })
  }
})

/**
 * DELETE /api/dealer-locations/:id
 * Admin xóa địa điểm bất kỳ
 */
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Chỉ admin mới có quyền xóa địa điểm của đại lý khác" })
    }
    const id = Number(req.params.id)
    const [result] = await pool.query("DELETE FROM dealer_locations WHERE id = ?", [id])
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Không tìm thấy địa điểm" })
    }
    res.json({ success: true })
  } catch (err) {
    console.error("DELETE /dealer-locations/:id error:", err)
    res.status(500).json({ error: "Không thể xóa địa điểm" })
  }
})

export default router
