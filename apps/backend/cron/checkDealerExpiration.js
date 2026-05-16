import cron from "node-cron";
import pool from "../db.js";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function sendDealerEmail(to, subject, htmlContent) {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    throw new Error("SMTP_NOT_CONFIGURED");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"AgriTrend" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    html: htmlContent,
  });
}

async function hideDealerProducts(userId) {
  await pool.query(
    `
      UPDATE products
      SET
        dealer_visibility_status = 'hidden',
        dealer_hidden_at = NOW(),
        dealer_hidden_until = DATE_ADD(NOW(), INTERVAL 30 DAY)
      WHERE farmer_user_id = ?
    `,
    [userId]
  )
}

function forceLogoutDealer(io, userId, message) {
  if (!io || !userId) return
  io.to(`user:${userId}`).emit("auth:force_logout", {
    code: "ROLE_CHANGED",
    message,
  })
}

export async function checkDealerExpiration(io) {
  console.log("ΓÅ▒∩╕Å Cß║únh b├ío & Hß║┐t hß║ín ─Éß║íi L├╜: ─Éang kiß╗âm tra...");
  try {
    // 1. Qu├⌐t cß║únh b├ío (C├▓n ─æ├║ng 3 ng├áy)
    const [warnings] = await pool.query(`
      SELECT id, email, name, dealer_expires_at
      FROM users
      WHERE role = 'dealer' 
        AND dealer_expires_at IS NOT NULL
        AND DATE(dealer_expires_at) = DATE(DATE_ADD(NOW(), INTERVAL 3 DAY))
    `);

    for (const user of warnings) {
      try {
        const emailHtml = `
          <h2>Cß║únh b├ío hß║┐t hß║ín g├│i ─Éß║íi l├╜</h2>
          <p>Ch├áo <b>${user.name || user.email}</b>,</p>
          <p>G├│i ─æß║íi l├╜ cß╗ºa bß║ín sß║╜ hß║┐t hß║ín v├áo <b>${new Date(user.dealer_expires_at).toLocaleString("vi-VN")}</b>.</p>
          <p>Vui l├▓ng ─æ─âng nhß║¡p v├á thanh to├ín ph├¡ N├┤ng Xu ─æß╗â tiß║┐p tß╗Ñc giß╗» hß║íng ─æß║íi l├╜ nh├⌐.</p>
        `;
        await sendDealerEmail(user.email, "ΓÜá∩╕Å G├│i ─Éß║íi L├╜ sß║»p hß║┐t hß║ín", emailHtml);
        console.log(`≡ƒô⌐ ─É├ú gß╗¡i cß║únh b├ío hß║┐t hß║ín tß╗¢i ${user.email}`);
      } catch (err) {
        if (err.message === "SMTP_NOT_CONFIGURED") {
            console.warn("ΓÜá∩╕Å Bß╗Å qua gß╗¡i email cß║únh b├ío ─æß║íi l├╜: SMTP ch╞░a cß║Ñu h├¼nh.");
        } else {
            console.error("Γ¥î Lß╗ùi gß╗¡i email cß║únh b├ío ─æß║íi l├╜:", err.message);
        }
      }
    }

    // 2. Qu├⌐t hß║┐t hß║ín (qu├í hß║ín)
    const [expired] = await pool.query(`
      SELECT id, email, name, dealer_expires_at
      FROM users
      WHERE role = 'dealer' 
        AND dealer_expires_at IS NOT NULL
        AND dealer_expires_at <= NOW()
    `);

    for (const user of expired) {
      // Hß║í cß║Ñp role cß╗ºa users v├á ß║⌐n dß╗» liß╗çu dealer
      await pool.query("UPDATE users SET role = 'user', dealer_expires_at = NULL WHERE id = ?", [user.id]);
      await hideDealerProducts(user.id)

      forceLogoutDealer(io, user.id, "Vai tr├▓ ─æß║íi l├╜ cß╗ºa bß║ín ─æ├ú hß║┐t hß║ín. Vui l├▓ng ─æ─âng nhß║¡p lß║íi ─æß╗â cß║¡p nhß║¡t phi├¬n l├ám viß╗çc.")
      
      try {
        const emailHtml = `
          <h2>Th├┤ng b├ío G├│i ─Éß║íi L├╜ ─É├ú Hß║┐t Hß║ín</h2>
          <p>Ch├áo <b>${user.name || user.email}</b>,</p>
          <p>G├│i ─æß║íi l├╜ cß╗ºa bß║ín ─æ├ú hß║┐t hß║ín v├áo <b>${new Date(user.dealer_expires_at).toLocaleString("vi-VN")}</b>.</p>
          <p>T├ái khoß║ún cß╗ºa bß║ín ─æ├ú ─æ╞░ß╗úc chuyß╗ân vß╗ü cß║Ñp ─æß╗Ö Ng╞░ß╗¥i d├╣ng c╞í bß║ún. Bß║ín c├│ thß╗â ─æ─âng k├╜ n├óng cß║Ñp lß║íi tr├¬n hß╗ç thß╗æng bß║▒ng V├¡ N├┤ng Xu bß║Ñt cß╗⌐ l├║c n├áo.</p>
        `;
        await sendDealerEmail(user.email, "ΓÅ│ G├│i ─Éß║íi L├╜ Cß╗ºa Bß║ín ─É├ú Hß║┐t Hß║ín", emailHtml);
        console.log(`≡ƒô⌐ ─É├ú gß╗¡i th├┤ng b├ío hß║┐t hß║ín tß╗¢i ${user.email} v├á hß║í cß║Ñp th├ánh user`);
      } catch (err) {
        if (err.message === "SMTP_NOT_CONFIGURED") {
            console.warn("ΓÜá∩╕Å Bß╗Å qua gß╗¡i email hß║┐t hß║ín ─æß║íi l├╜: SMTP ch╞░a cß║Ñu h├¼nh.");
        } else {
            console.error("Γ¥î Lß╗ùi gß╗¡i email hß║┐t hß║ín ─æß║íi l├╜:", err.message);
        }
      }
    }
  } catch (error) {
    console.error("Γ¥î Lß╗ùi khi chß║íy cron checkDealerExpiration:", error.message);
  }
}
