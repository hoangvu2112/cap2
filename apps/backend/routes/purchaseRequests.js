import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole, isAdmin } from "../middleware/auth.js"
import { checkActiveRole } from "../middleware/checkActiveRole.js"

const router = express.Router()

// Bß║ún ─æß╗ô ph├ón v├╣ng 34 tß╗ënh th├ánh theo miß╗ün
const REGION_GROUPS = {
  "Bß║»c Bß╗Ö": [
    "H├á Nß╗Öi", "Hß║úi Ph├▓ng", "Ninh B├¼nh", "H╞░ng Y├¬n", "Bß║»c Ninh",
    "Quß║úng Ninh", "Th├íi Nguy├¬n", "Ph├║ Thß╗ì", "L├áo Cai", "Tuy├¬n Quang",
    "Lß║íng S╞ín", "─Éiß╗çn Bi├¬n", "Lai Ch├óu", "S╞ín La", "Cao Bß║▒ng",
  ],
  "Trung Bß╗Ö": [
    "Thanh H├│a", "Nghß╗ç An", "H├á T─⌐nh", "Quß║úng Trß╗ï", "Huß║┐",
    "─É├á Nß║╡ng", "Quß║úng Ng├úi", "B├¼nh ─Éß╗ïnh", "Gia Lai", "Kh├ính H├▓a",
    "L├óm ─Éß╗ông",
  ],
  "Nam Bß╗Ö": [
    "Hß╗ô Ch├¡ Minh", "─Éß╗ông Nai", "T├óy Ninh", "Cß║ºn Th╞í", "─Éß╗ông Th├íp",
    "An Giang", "V─⌐nh Long", "C├á Mau",
  ],
}

function getRegionGroup(province) {
  for (const [group, provinces] of Object.entries(REGION_GROUPS)) {
    if (provinces.includes(province)) return group
  }
  return null
}

router.get("/partners", authenticateToken, async (req, res) => {
  try {
    const productId = Number(req.query.productId)
    if (!productId) {
      return res.status(400).json({ error: "Thiß║┐u productId" })
    }

    // 1. Lß║Ñy th├┤ng tin khu vß╗▒c cß╗ºa CH├ìNH NG╞»ß╗£I D├ÖNG HIß╗åN Tß║áI
    const [[currentUser]] = await pool.query(
      "SELECT region FROM users WHERE id = ?",
      [req.user.id]
    )

    const userRegion = currentUser?.region || ""
    const userGroup = getRegionGroup(userRegion)

    // 2. Lß║Ñy danh s├ích tß╗ënh c├╣ng miß╗ün ─æß╗â d├╣ng trong SQL
    const sameGroupProvinces = userGroup ? REGION_GROUPS[userGroup] : []

    // 3. X├íc ─æß╗ïnh vai tr├▓ hiß╗çn tß║íi tß╗½ DB ─æß╗â tr├ính d├╣ng JWT c┼⌐
    const [[currentRoleRow]] = await pool.query(
      "SELECT role FROM users WHERE id = ? AND status = 'active'",
      [req.user.id]
    )

    const isDealer = currentRoleRow?.role === 'dealer'
    const targetRoles = isDealer ? "('user', 'dealer')" : "('dealer')"

    // 4. Truy vß║Ñn vß╗¢i 3 cß║Ñp ╞░u ti├¬n:
    //    priority 1 = c├╣ng tß╗ënh, priority 2 = c├╣ng miß╗ün, priority 3 = miß╗ün kh├íc
    let sql = `
      SELECT 
        u.id, 
        u.name, 
        u.avatar_url, 
        u.role,
        u.region AS user_region,
        CASE 
          WHEN u.region = ? AND u.region IS NOT NULL AND u.region != '' THEN 1
          WHEN u.region IN (${sameGroupProvinces.map(() => '?').join(',') || "''"}) THEN 2
          ELSE 3
        END AS priority_level
      FROM users u
      WHERE u.id != ?
        AND u.status = 'active'
        AND u.role IN ${targetRoles}
      ORDER BY priority_level ASC, u.created_at ASC 
      LIMIT 20
    `

    const params = [userRegion, ...sameGroupProvinces, req.user.id]
    const [rows] = await pool.query(sql, params)

    // 5. Th├¬m th├┤ng tin region_group cho mß╗ùi ─æß╗æi t├íc
    const result = rows.map(row => ({
      ...row,
      region_group: getRegionGroup(row.user_region) || "Kh├íc",
      user_group: userGroup || "Ch╞░a x├íc ─æß╗ïnh",
    }))

    res.json(result)
  } catch (error) {
    console.error("GET /purchase-requests/partners error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.post("/", authenticateToken, async (req, res) => {
  try {
    const initiatorId = req.user.id
    const { product_id, partner_id, quantity, proposed_price, note } = req.body

    if (!product_id || !partner_id || !quantity || !proposed_price) {
      return res.status(400).json({ error: "Thiß║┐u th├┤ng tin y├¬u cß║ºu" })
    }

    const [[product]] = await pool.query(
      "SELECT id, farmer_user_id FROM products WHERE id = ?",
      [product_id]
    )

    if (!product) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy sß║ún phß║⌐m" })
    }

    const [[partner]] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND status = 'active'",
      [partner_id]
    )

    if (!partner) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy ─æß╗æi t├íc" })
    }

    const [[initiator]] = await pool.query(
      "SELECT id, role FROM users WHERE id = ? AND status = 'active'",
      [initiatorId]
    )

    if (!initiator) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy ng╞░ß╗¥i khß╗ƒi tß║ío" })
    }

    // X├íc ─æß╗ïnh ai l├á ng╞░ß╗¥i mua, ai l├á n├┤ng d├ón dß╗▒a tr├¬n vai tr├▓ cß╗ºa ng╞░ß╗¥i khß╗ƒi tß║ío
    let buyer_id, farmer_id;
    if (initiator.role === 'dealer') {
      buyer_id = initiatorId;
      farmer_id = partner_id;
    } else {
      buyer_id = partner_id; // Dealer l├á ng╞░ß╗¥i mua
      farmer_id = initiatorId; // User l├á n├┤ng d├ón
    }

    const [result] = await pool.query(
      `
        INSERT INTO purchase_requests (buyer_id, farmer_id, product_id, quantity, proposed_price, note, status)
        VALUES (?, ?, ?, ?, ?, ?, 'pending')
      `,
      [buyer_id, farmer_id, product_id, Number(quantity), Number(proposed_price), note?.trim() || null]
    )

    const [[created]] = await pool.query(
      `
        SELECT
          pr.*,
          p.name AS product_name,
          p.unit AS product_unit,
          buyer.name AS buyer_name,
          farmer.name AS farmer_name
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users buyer ON buyer.id = pr.buyer_id
        JOIN users farmer ON farmer.id = pr.farmer_id
        WHERE pr.id = ?
      `,
      [result.insertId]
    )

    res.status(201).json(created)
  } catch (error) {
    console.error("POST /purchase-requests error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/all", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          pr.id,
          pr.product_id,
          pr.buyer_id,
          pr.farmer_id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.created_at,
          pr.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          buyer.name AS buyer_name,
          buyer.avatar_url AS buyer_avatar,
          farmer.name AS farmer_name,
          farmer.avatar_url AS farmer_avatar,
          c.farmer_status,
          c.buyer_status
        FROM purchase_requests pr
        LEFT JOIN products p ON p.id = pr.product_id
        LEFT JOIN users buyer ON buyer.id = pr.buyer_id
        LEFT JOIN users farmer ON farmer.id = pr.farmer_id
        LEFT JOIN commissions c ON c.request_id = pr.id
        WHERE pr.buyer_id = ? OR pr.farmer_id = ?
        ORDER BY pr.created_at DESC, pr.id DESC
      `,
      [req.user.id, req.user.id]
    )

    res.json(rows)
  } catch (error) {
    console.error("GET /purchase-requests/all error:", error)
    res.status(500).json({ error: "Lß╗ùi hß╗ç thß╗æng khi tß║úi danh s├ích th╞░╞íng l╞░ß╗úng" })
  }
})

router.get("/sent", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          pr.id,
          pr.product_id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.dealer_fee_status,
          pr.dealer_fee_amount,
          pr.dealer_action_at,
          pr.dealer_report_status,
          pr.created_at,
          pr.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          farmer.id AS farmer_id,
          farmer.name AS farmer_name,
          farmer.avatar_url AS farmer_avatar,
          c.farmer_status,
          c.buyer_status
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users farmer ON farmer.id = pr.farmer_id
        LEFT JOIN commissions c ON c.request_id = pr.id
        WHERE pr.buyer_id = ?
        ORDER BY pr.created_at DESC, pr.id DESC
      `,
      [req.user.id]
    )

    res.json(rows)
  } catch (error) {
    console.error("GET /purchase-requests/sent error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.patch("/:id/dealer-confirm", authenticateToken, checkActiveRole("dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    if (!requestId) {
      return res.status(400).json({ error: "M├ú y├¬u cß║ºu kh├┤ng hß╗úp lß╗ç" })
    }

    const [[request]] = await pool.query(
      `
        SELECT id, buyer_id, farmer_id, status, dealer_fee_status, dealer_fee_amount, dealer_action_at
        FROM purchase_requests
        WHERE id = ?
      `,
      [requestId]
    )

    if (!request) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy y├¬u cß║ºu" })
    }

    if (request.buyer_id !== req.user.id) {
      return res.status(403).json({ error: "Bß║ín kh├┤ng c├│ quyß╗ün thß╗▒c hiß╗çn thao t├íc n├áy" })
    }

    if (request.status !== "closed") {
      return res.status(400).json({ error: "Chß╗ë c├│ thß╗â x├íc nhß║¡n khi user ─æ├ú chß╗æt giao dß╗ïch" })
    }

    if (request.dealer_fee_status === "recorded") {
      return res.status(409).json({ error: "Ph├¡ ─æß║íi l├╜ cß╗ºa y├¬u cß║ºu n├áy ─æ├ú ─æ╞░ß╗úc ghi nhß║¡n" })
    }

    await pool.query(
      `
        UPDATE purchase_requests
        SET
          dealer_fee_status = 'recorded',
          dealer_action_at = NOW(),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [requestId]
    )

    const [[updated]] = await pool.query(
      `
        SELECT
          pr.id,
          pr.product_id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.dealer_fee_status,
          pr.dealer_fee_amount,
          pr.dealer_action_at,
          pr.created_at,
          pr.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          farmer.id AS farmer_id,
          farmer.name AS farmer_name,
          farmer.avatar_url AS farmer_avatar
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users farmer ON farmer.id = pr.farmer_id
        WHERE pr.id = ?
      `,
      [requestId]
    )

    res.json(updated)
  } catch (error) {
    console.error("PATCH /purchase-requests/:id/dealer-confirm error:", error)
    res.status(500).json({ error: "Kh├┤ng thß╗â ghi nhß║¡n ph├¡ ─æß║íi l├╜" })
  }
})

router.post("/:id/report", authenticateToken, checkActiveRole("dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    const reason = String(req.body?.reason || "").trim()
    const note = String(req.body?.note || "").trim()

    if (!requestId) {
      return res.status(400).json({ error: "M├ú y├¬u cß║ºu kh├┤ng hß╗úp lß╗ç" })
    }
    if (!reason) {
      return res.status(400).json({ error: "Vui l├▓ng nhß║¡p l├╜ do b├ío c├ío" })
    }

    const [[request]] = await pool.query(
      `
        SELECT id, buyer_id, farmer_id, status, dealer_report_status
        FROM purchase_requests
        WHERE id = ?
      `,
      [requestId]
    )

    if (!request) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy y├¬u cß║ºu" })
    }

    if (request.buyer_id !== req.user.id) {
      return res.status(403).json({ error: "Bß║ín kh├┤ng c├│ quyß╗ün b├ío c├ío y├¬u cß║ºu n├áy" })
    }

    if (!["closed"].includes(request.status)) {
      return res.status(400).json({ error: "Chß╗ë b├ío c├ío ─æ╞░ß╗úc khi ─æ╞ín ─æ├ú chß╗æt" })
    }

    if (request.dealer_report_status === "reported") {
      return res.status(409).json({ error: "Y├¬u cß║ºu n├áy ─æ├ú ─æ╞░ß╗úc b├ío c├ío tr╞░ß╗¢c ─æ├│" })
    }

    await pool.query(
      `
        INSERT INTO dealer_reports (request_id, reporter_id, reported_user_id, reason, note)
        VALUES (?, ?, ?, ?, ?)
      `,
      [requestId, req.user.id, request.farmer_id, reason, note || null]
    )

    await pool.query(
      `
        UPDATE purchase_requests
        SET dealer_report_status = 'reported', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [requestId]
    )

    res.status(201).json({ success: true })
  } catch (error) {
    console.error("POST /purchase-requests/:id/report error:", error)
    res.status(500).json({ error: "Kh├┤ng thß╗â gß╗¡i b├ío c├ío" })
  }
})

router.get("/admin/reports", authenticateToken, isAdmin, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          r.id,
          r.request_id,
          r.reporter_id,
          r.reported_user_id,
          r.reason,
          r.note,
          r.status,
          r.admin_note,
          r.reviewed_by,
          r.reviewed_at,
          r.created_at,
          rep.name AS reporter_name,
          rep.email AS reporter_email,
          rep.role AS reporter_role,
          target.name AS reported_user_name,
          target.email AS reported_user_email,
          target.role AS reported_user_role,
          target.status AS reported_user_status,
          pr.status AS request_status,
          pr.dealer_fee_status,
          pr.dealer_fee_amount,
          pr.dealer_action_at,
          p.name AS product_name,
          p.unit AS product_unit
        FROM dealer_reports r
        JOIN users rep ON rep.id = r.reporter_id
        JOIN users target ON target.id = r.reported_user_id
        JOIN purchase_requests pr ON pr.id = r.request_id
        JOIN products p ON p.id = pr.product_id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 200
      `
    )

    res.json({ success: true, reports: rows })
  } catch (error) {
    console.error("GET /purchase-requests/admin/reports error:", error)
    res.status(500).json({ error: "Kh├┤ng thß╗â lß║Ñy danh s├ích b├ío c├ío" })
  }
})

router.patch("/admin/reports/:id/resolve", authenticateToken, isAdmin, async (req, res) => {
  try {
    const reportId = Number(req.params.id)
    const status = String(req.body?.status || "resolved").trim().toLowerCase()
    const adminNote = String(req.body?.admin_note || "").trim()

    if (!reportId) {
      return res.status(400).json({ error: "M├ú b├ío c├ío kh├┤ng hß╗úp lß╗ç" })
    }

    if (!["resolved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Trß║íng th├íi kh├┤ng hß╗úp lß╗ç" })
    }

    const [[report]] = await pool.query(
      `
        SELECT id, reported_user_id, status
        FROM dealer_reports
        WHERE id = ?
      `,
      [reportId]
    )

    if (!report) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy b├ío c├ío" })
    }

    await pool.query(
      `
        UPDATE dealer_reports
        SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW()
        WHERE id = ?
      `,
      [status, adminNote || null, req.user.id, reportId]
    )

    const [[updated]] = await pool.query(
      `
        SELECT
          r.id,
          r.request_id,
          r.reporter_id,
          r.reported_user_id,
          r.reason,
          r.note,
          r.status,
          r.admin_note,
          r.reviewed_by,
          r.reviewed_at,
          r.created_at,
          rep.name AS reporter_name,
          rep.email AS reporter_email,
          target.name AS reported_user_name,
          target.email AS reported_user_email,
          target.role AS reported_user_role,
          target.status AS reported_user_status
        FROM dealer_reports r
        JOIN users rep ON rep.id = r.reporter_id
        JOIN users target ON target.id = r.reported_user_id
        WHERE r.id = ?
      `,
      [reportId]
    )

    res.json({ success: true, report: updated })
  } catch (error) {
    console.error("PATCH /purchase-requests/admin/reports/:id/resolve error:", error)
    res.status(500).json({ error: "Kh├┤ng thß╗â xß╗¡ l├╜ b├ío c├ío" })
  }
})

router.get("/incoming", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
        SELECT
          pr.id,
          pr.product_id,
          pr.quantity,
          pr.proposed_price,
          pr.note,
          pr.status,
          pr.created_at,
          pr.updated_at,
          p.name AS product_name,
          p.unit AS product_unit,
          p.region AS product_region,
          buyer.id AS buyer_id,
          buyer.name AS buyer_name,
          buyer.avatar_url AS buyer_avatar,
          c.farmer_status,
          c.buyer_status
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        JOIN users buyer ON buyer.id = pr.buyer_id
        LEFT JOIN commissions c ON c.request_id = pr.id
        WHERE pr.farmer_id = ?
        ORDER BY pr.created_at DESC, pr.id DESC
      `,
      [req.user.id]
    )

    res.json(rows)
  } catch (error) {
    console.error("GET /purchase-requests/incoming error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.get("/:id/messages", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    if (!requestId) {
      return res.status(400).json({ error: "M├ú y├¬u cß║ºu kh├┤ng hß╗úp lß╗ç" })
    }

    const [[request]] = await pool.query(
      `
        SELECT
          pr.id,
          pr.buyer_id,
          pr.farmer_id,
          pr.status,
          pr.product_id,
          p.name AS product_name,
          p.unit AS product_unit,
          pr.quantity,
          pr.proposed_price,
          c.farmer_status,
          c.buyer_status,
          c.fee_amount
        FROM purchase_requests pr
        JOIN products p ON p.id = pr.product_id
        LEFT JOIN commissions c ON c.request_id = pr.id
        WHERE pr.id = ?
      `,
      [requestId]
    )

    if (!request) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy y├¬u cß║ºu" })
    }

    if (req.user.id !== request.buyer_id && req.user.id !== request.farmer_id) {
      return res.status(403).json({ error: "Kh├┤ng c├│ quyß╗ün truy cß║¡p" })
    }

    const [messages] = await pool.query(
      `
        SELECT
          m.id,
          m.request_id,
          m.sender_id,
          m.content,
          m.created_at,
          u.name AS sender_name,
          u.role AS sender_role
        FROM purchase_request_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.request_id = ?
        ORDER BY m.created_at ASC, m.id ASC
      `,
      [requestId]
    )

    res.json({ request, messages })
  } catch (error) {
    console.error("GET /purchase-requests/:id/messages error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.post("/:id/messages", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    const content = req.body.content?.trim()

    if (!requestId) {
      return res.status(400).json({ error: "M├ú y├¬u cß║ºu kh├┤ng hß╗úp lß╗ç" })
    }
    if (!content) {
      return res.status(400).json({ error: "Nß╗Öi dung kh├┤ng ─æ╞░ß╗úc ─æß╗â trß╗æng" })
    }

    const [[request]] = await pool.query(
      "SELECT id, buyer_id, farmer_id, status FROM purchase_requests WHERE id = ?",
      [requestId]
    )

    if (!request) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy y├¬u cß║ºu" })
    }
    if (request.status === "closed") {
      return res.status(400).json({ error: "Y├¬u cß║ºu ─æ├ú chß╗æt, kh├┤ng thß╗â nhß║»n th├¬m" })
    }
    if (req.user.id !== request.buyer_id && req.user.id !== request.farmer_id) {
      return res.status(403).json({ error: "Kh├┤ng c├│ quyß╗ün nhß║»n trong y├¬u cß║ºu n├áy" })
    }

    const [result] = await pool.query(
      `
        INSERT INTO purchase_request_messages (request_id, sender_id, content)
        VALUES (?, ?, ?)
      `,
      [requestId, req.user.id, content]
    )

    // Khi n├┤ng d├ón phß║ún hß╗ôi bß║▒ng tin nhß║»n ─æß║ºu ti├¬n/tiß║┐p theo th├¼ y├¬u cß║ºu chuyß╗ân sang responded
    if (req.user.id === request.farmer_id && request.status === "pending") {
      await pool.query(
        "UPDATE purchase_requests SET status = 'responded' WHERE id = ?",
        [requestId]
      )
    }

    const [[message]] = await pool.query(
      `
        SELECT
          m.id,
          m.request_id,
          m.sender_id,
          m.content,
          m.created_at,
          u.name AS sender_name,
          u.role AS sender_role
        FROM purchase_request_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.id = ?
      `,
      [result.insertId]
    )

    const [[updatedRequest]] = await pool.query(
      "SELECT id, status, updated_at FROM purchase_requests WHERE id = ?",
      [requestId]
    )

    res.status(201).json({ message, request: updatedRequest })
  } catch (error) {
    console.error("POST /purchase-requests/:id/messages error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

router.patch("/:id/status", authenticateToken, requireRole("user", "dealer"), async (req, res) => {
  try {
    const requestId = Number(req.params.id)
    const { status } = req.body

    if (!requestId) {
      return res.status(400).json({ error: "M├ú y├¬u cß║ºu kh├┤ng hß╗úp lß╗ç" })
    }

    if (!["pending", "responded", "closed"].includes(status)) {
      return res.status(400).json({ error: "Trß║íng th├íi kh├┤ng hß╗úp lß╗ç" })
    }

    const [[row]] = await pool.query(
      "SELECT id, buyer_id, farmer_id FROM purchase_requests WHERE id = ?",
      [requestId]
    )

    if (!row) {
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy y├¬u cß║ºu" })
    }

    if (row.buyer_id !== req.user.id && row.farmer_id !== req.user.id) {
      return res.status(403).json({ error: "Kh├┤ng c├│ quyß╗ün cß║¡p nhß║¡t y├¬u cß║ºu n├áy" })
    }

    if (status === "pending" || status === "responded") {
      return res.status(400).json({
        error: "Trß║íng th├íi pending/responded ─æ╞░ß╗úc cß║¡p nhß║¡t tß╗▒ ─æß╗Öng theo luß╗ông th╞░╞íng l╞░ß╗úng",
      })
    }

    if (status === "closed" && row.farmer_id !== req.user.id) {
      return res.status(403).json({ error: "Chß╗ë n├┤ng d├ón mß╗¢i c├│ quyß╗ün chß╗æt giao dß╗ïch" })
    }

    await pool.query(
      "UPDATE purchase_requests SET status = ? WHERE id = ?",
      [status, requestId]
    )

    res.json({ message: "─É├ú cß║¡p nhß║¡t trß║íng th├íi", status })
  } catch (error) {
    console.error("PATCH /purchase-requests/:id/status error:", error)
    res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
  }
})

export default router
