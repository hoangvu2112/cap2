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
  console.log("⏱️ Cảnh báo & Hết hạn Đại Lý: Đang kiểm tra...");
  try {
    // 1. Quét cảnh báo (Còn đúng 3 ngày)
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
          <h2>Cảnh báo hết hạn gói Đại lý</h2>
          <p>Chào <b>${user.name || user.email}</b>,</p>
          <p>Gói đại lý của bạn sẽ hết hạn vào <b>${new Date(user.dealer_expires_at).toLocaleString("vi-VN")}</b>.</p>
          <p>Vui lòng đăng nhập và thanh toán phí Nông Xu để tiếp tục giữ hạng đại lý nhé.</p>
        `;
        await sendDealerEmail(user.email, "⚠️ Gói Đại Lý sắp hết hạn", emailHtml);
        console.log(`📩 Đã gửi cảnh báo hết hạn tới ${user.email}`);
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
      SELECT id, email, name, dealer_expires_at
      FROM users
      WHERE role = 'dealer' 
        AND dealer_expires_at IS NOT NULL
        AND dealer_expires_at <= NOW()
    `);

    for (const user of expired) {
      // Hạ cấp role của users và ẩn dữ liệu dealer
      await pool.query("UPDATE users SET role = 'user', dealer_expires_at = NULL WHERE id = ?", [user.id]);
      await hideDealerProducts(user.id)

      forceLogoutDealer(io, user.id, "Vai trò đại lý của bạn đã hết hạn. Vui lòng đăng nhập lại để cập nhật phiên làm việc.")
      
      try {
        const emailHtml = `
          <h2>Thông báo Gói Đại Lý Đã Hết Hạn</h2>
          <p>Chào <b>${user.name || user.email}</b>,</p>
          <p>Gói đại lý của bạn đã hết hạn vào <b>${new Date(user.dealer_expires_at).toLocaleString("vi-VN")}</b>.</p>
          <p>Tài khoản của bạn đã được chuyển về cấp độ Người dùng cơ bản. Bạn có thể đăng ký nâng cấp lại trên hệ thống bằng Ví Nông Xu bất cứ lúc nào.</p>
        `;
        await sendDealerEmail(user.email, "⏳ Gói Đại Lý Của Bạn Đã Hết Hạn", emailHtml);
        console.log(`📩 Đã gửi thông báo hết hạn tới ${user.email} và hạ cấp thành user`);
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
