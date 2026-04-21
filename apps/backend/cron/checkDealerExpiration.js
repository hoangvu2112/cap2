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

export async function checkDealerExpiration() {
  console.log("⏱️ Cảnh báo & Hết hạn Đại Lý: Đang kiểm tra...");
  try {
    // 1. Quét cảnh báo (còn <= 3 ngày)
    const [warnings] = await pool.query(`
      SELECT r.id, r.user_id, r.expires_at, u.email, u.name, p.name as plan_name
      FROM dealer_upgrade_requests r
      JOIN users u ON u.id = r.user_id
      JOIN dealer_plans p ON p.id = r.plan_id
      WHERE r.status = 'approved' 
        AND r.warning_sent = 0
        AND r.expires_at <= DATE_ADD(NOW(), INTERVAL 3 DAY)
        AND r.expires_at > NOW()
    `);

    for (const req of warnings) {
      try {
        const emailHtml = `
          <h2>Cảnh báo hết hạn gói Đại lý</h2>
          <p>Chào <b>${req.name || req.email}</b>,</p>
          <p>Gói đại lý <b>${req.plan_name}</b> của bạn sẽ hết hạn vào <b>${new Date(req.expires_at).toLocaleString("vi-VN")}</b>.</p>
          <p>Vui lòng đăng nhập và đăng ký gia hạn nếu bạn muốn giữ các đặc quyền hiện có nhé.</p>
        `;
        await sendDealerEmail(req.email, "⚠️ Gói Đại Lý sắp hết hạn", emailHtml);
        await pool.query("UPDATE dealer_upgrade_requests SET warning_sent = 1 WHERE id = ?", [req.id]);
        console.log(`📩 Đã gửi cảnh báo hết hạn tới ${req.email}`);
      } catch (err) {
        if (err.message === "SMTP_NOT_CONFIGURED") {
            console.warn("⚠️ Bỏ qua gửi email cảnh báo đại lý: SMTP chưa cấu hình.");
        } else {
            console.error("❌ Lỗi gửi email cảnh báo đại lý:", err.message);
        }
      }
    }

    // 2. Quét hết hạn (quá hạn)
    const [expired] = await pool.query(`
      SELECT r.id, r.user_id, r.expires_at, u.email, u.name, p.name as plan_name
      FROM dealer_upgrade_requests r
      JOIN users u ON u.id = r.user_id
      JOIN dealer_plans p ON p.id = r.plan_id
      WHERE r.status = 'approved' 
        AND r.expires_at <= NOW()
    `);

    for (const req of expired) {
      // Hạ cấp role của users
      await pool.query("UPDATE users SET role = 'user' WHERE id = ?", [req.user_id]);
      // Cập nhật trạng thái request
      await pool.query("UPDATE dealer_upgrade_requests SET status = 'expired' WHERE id = ?", [req.id]);
      
      try {
        const emailHtml = `
          <h2>Thông báo Gói Đại Lý Đã Hết Hạn</h2>
          <p>Chào <b>${req.name || req.email}</b>,</p>
          <p>Gói đại lý <b>${req.plan_name}</b> của bạn đã hết hạn vào <b>${new Date(req.expires_at).toLocaleString("vi-VN")}</b>.</p>
          <p>Tài khoản của bạn đã được chuyển về cấp độ Người dùng cơ bản. Bạn có thể đăng ký nâng cấp lại trên hệ thống bất cứ lúc nào.</p>
        `;
        await sendDealerEmail(req.email, "⏳ Gói Đại Lý Của Bạn Đã Hết Hạn", emailHtml);
        console.log(`📩 Đã gửi thông báo hết hạn tới ${req.email} và hạ cấp thành user`);
      } catch (err) {
        if (err.message === "SMTP_NOT_CONFIGURED") {
            console.warn("⚠️ Bỏ qua gửi email hết hạn đại lý: SMTP chưa cấu hình.");
        } else {
            console.error("❌ Lỗi gửi email hết hạn đại lý:", err.message);
        }
      }
    }
  } catch (error) {
    console.error("❌ Lỗi khi chạy cron checkDealerExpiration:", error.message);
  }
}
