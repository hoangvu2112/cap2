import express from "express"
import pool from "../db.js"
import { authenticateToken, requireRole } from "../middleware/auth.js"
import { SYSTEM_FEES } from "../utils/constants.js"

const router = express.Router()

// Thanh to├ín ghim tin bß║▒ng V├¡ N├┤ng Xu
router.post("/create-payment", authenticateToken, requireRole("user"), async (req, res) => {
  const connection = await pool.getConnection()

  try {
    const listingId = Number(req.body.listing_id)
    const userId = req.user.id

    if (!listingId) {
      return res.status(400).json({ error: "Thiß║┐u nguß╗ôn h├áng" })
    }

    const planPrice = SYSTEM_FEES.BOOST_PIN.price
    const planDuration = SYSTEM_FEES.BOOST_PIN.duration_days

    await connection.beginTransaction()

    const [[listing]] = await connection.query(
      `
        SELECT usl.id, usl.user_id, usl.product_id, p.name AS product_name
        FROM user_supply_listings usl
        JOIN products p ON p.id = usl.product_id
        WHERE usl.id = ? AND usl.user_id = ?
        LIMIT 1
      `,
      [listingId, userId]
    )

    if (!listing) {
      await connection.rollback()
      return res.status(404).json({ error: "Kh├┤ng t├¼m thß║Ñy nguß╗ôn h├áng hoß║╖c bß║ín kh├┤ng c├│ quyß╗ün ghim" })
    }

    const [[activeBoost]] = await connection.query(
      `
        SELECT id, boost_end_at
        FROM listing_boosts
        WHERE listing_id = ? AND status = 'active' AND boost_end_at > NOW()
        ORDER BY boost_end_at DESC
        LIMIT 1
      `,
      [listingId]
    )

    if (activeBoost) {
      await connection.rollback()
      return res.status(409).json({ error: "Nguß╗ôn h├áng n├áy ─æang ─æ╞░ß╗úc ghim, vui l├▓ng ─æß╗úi hß║┐t hß║ín rß╗ôi mua tiß║┐p" })
    }

    // 1. Kiß╗âm tra V├¡ N├┤ng Xu
    let [[wallet]] = await connection.query(
      "SELECT * FROM wallets WHERE user_id = ? FOR UPDATE",
      [userId]
    )

    if (!wallet) {
      await connection.rollback()
      return res.status(400).json({ error: "Bß║ín ch╞░a c├│ V├¡ N├┤ng Xu, vui l├▓ng nß║íp tiß╗ün tr╞░ß╗¢c" })
    }

    let currentBonus = Number(wallet.bonus_balance)
    let currentBalance = Number(wallet.balance)

    if (currentBonus + currentBalance < planPrice) {
      await connection.rollback()
      return res.status(400).json({ error: "Sß╗æ d╞░ V├¡ N├┤ng Xu kh├┤ng ─æß╗º ─æß╗â thanh to├ín g├│i ghim n├áy" })
    }

    let deductBonus = 0
    let deductBalance = 0

    if (currentBonus >= planPrice) {
      deductBonus = planPrice
    } else {
      deductBonus = currentBonus
      deductBalance = planPrice - currentBonus
    }

    // 2. Trß╗½ tiß╗ün
    await connection.query(
      "UPDATE wallets SET bonus_balance = bonus_balance - ?, balance = balance - ? WHERE user_id = ?",
      [deductBonus, deductBalance, userId]
    )

    // 3. Ghi log v├¡
    if (deductBonus > 0) {
      await connection.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
         VALUES (?, ?, 'deduct', 'boost_pin', 'bonus_balance', ?)`,
        [userId, deductBonus, `Thanh to├ín g├│i Ghim tin ${planDuration} ng├áy (trß╗½ tiß╗ün th╞░ß╗ƒng)`]
      )
    }
    if (deductBalance > 0) {
      await connection.query(
        `INSERT INTO wallet_transactions (user_id, amount, type, purpose, source, note) 
         VALUES (?, ?, 'deduct', 'boost_pin', 'balance', ?)`,
        [userId, deductBalance, `Thanh to├ín g├│i Ghim tin ${planDuration} ng├áy (trß╗½ tiß╗ün nß║íp)`]
      )
    }

    // 4. Active g├│i ghim lu├┤n (Bß╗Å plan_id, payment_id)
    const [boostResult] = await connection.query(
      `
        INSERT INTO listing_boosts (listing_id, user_id, status, boost_start_at, boost_end_at)
        VALUES (?, ?, 'active', NOW(), DATE_ADD(NOW(), INTERVAL ? DAY))
      `,
      [listingId, userId, planDuration]
    )

    await connection.commit()

    const [[boost]] = await connection.query(
      "SELECT * FROM listing_boosts WHERE id = ?",
      [boostResult.insertId]
    )

    res.status(201).json({
      success: true,
      message: "Thanh to├ín th├ánh c├┤ng v├á ─æ├ú k├¡ch hoß║ít g├│i ghim",
      boost,
      payment: {
        amount: planPrice,
        status: "paid"
      }
    })
  } catch (error) {
    await connection.rollback()
    console.error("POST /listing-boosts/create-payment error:", error)
    res.status(500).json({ error: "Kh├┤ng thß╗â thanh to├ín g├│i ghim tin" })
  } finally {
    connection.release()
  }
})

export default router
