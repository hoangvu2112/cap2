import express from "express";
import db from "../db.js";
import { calculateTotalFee, splitFee } from "../utils/calculateFee.js";

const router = express.Router();


// 🔹 CREATE ORDER
router.post("/create", async (req, res) => {
  try {
    const { product_id, farmer_id, dealer_id, quantity, price_per_unit } = req.body;

    const total = quantity * price_per_unit;

    const totalFee = calculateTotalFee(total);
    const { farmerFee, dealerFee } = splitFee(totalFee);

    const [result] = await db.execute(
      `INSERT INTO orders 
      (product_id, farmer_id, dealer_id, quantity, price_per_unit, total_amount, total_fee, farmer_fee, dealer_fee)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [product_id, farmer_id, dealer_id, quantity, price_per_unit, total, totalFee, farmerFee, dealerFee]
    );

    const orderId = result.insertId;

    res.json({
      success: true,
      orderId,
      total,
      totalFee,
      farmerFee,
      dealerFee
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Create order failed" });
  }
});


// 🔹 PAY ORDER
router.post("/:id/pay", async (req, res) => {
  try {
    const orderId = req.params.id;

    await db.execute(
      `UPDATE orders SET status = 'completed' WHERE id = ?`,
      [orderId]
    );

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment failed" });
  }
});


// 🔹 GET MY ORDERS
router.get("/my/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const [rows] = await db.execute(
      `SELECT * FROM orders 
       WHERE farmer_id = ? OR dealer_id = ?
       ORDER BY created_at DESC`,
      [userId, userId]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Fetch orders failed" });
  }
});

export default router;