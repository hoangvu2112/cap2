import express from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import axios from "axios"
import pool from "../db.js"
import nodemailer from "nodemailer";
import rateLimit from "express-rate-limit";
import { authenticateToken } from "../middleware/auth.js"

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID

const normalizeEmail = (value) => String(value || "").trim().toLowerCase()

const verifyGoogleCredential = async (credential) => {
  if (!credential) {
    throw new Error("Missing Google credential")
  }

  const { data } = await axios.get("https://oauth2.googleapis.com/tokeninfo", {
    params: { id_token: credential },
  })

  if (GOOGLE_CLIENT_ID && data.aud !== GOOGLE_CLIENT_ID) {
    throw new Error("Google client ID mismatch")
  }

  if (data.email_verified !== "true") {
    throw new Error("Google email is not verified")
  }

  return {
    email: data.email,
    name: data.name || data.given_name || data.email?.split("@")[0] || "Người dùng Google",
    imageUrl: data.picture || "",
    googleId: data.sub,
  }
}

// Rate limiter cho endpoint forgot-password (giảm spam)
const forgotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 5,
  message: { error: "Vui lòng thử lại sau vài phút." },
});

// Config nodemailer (GMAIL example: dùng App Password)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Helper tạo OTP 6 chữ số
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Gửi email
const sendOTPEmail = async (to, otp) => {
  const html = `
    <div style="font-family: sans-serif; line-height:1.4">
      <h3>Mã OTP khôi phục mật khẩu</h3>
      <p>Mã OTP của bạn là: <strong style="font-size:20px">${otp}</strong></p>
      <p>Mã có hiệu lực trong <strong>5 phút</strong>.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"AgriPrice" <${process.env.SMTP_EMAIL}>`,
    to,
    subject: "AgriPrice - Mã OTP khôi phục mật khẩu",
    text: `Mã OTP: ${otp} (hết hạn trong 5 phút)`,
    html,
  });
};
/**
 * POST /auth/forgot-password
 * body: { email }
 */
router.post("/forgot-password", forgotLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ error: "Email bắt buộc" });

    // Kiểm tra user tồn tại
    const [rows] = await pool.query("SELECT id, email FROM users WHERE email = ?", [email]);
    if (rows.length === 0) {
      // Email không tồn tại → trả lỗi
      return res.status(404).json({ error: "Email không tồn tại" });
    }

    const user = rows[0];

    // Kiểm tra xem OTP còn hiệu lực chưa
    const [existingTokens] = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE user_id = ? AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [user.id]
    );

    if (existingTokens.length > 0) {
      return res.status(400).json({ error: "OTP trước đó vẫn còn hiệu lực. Vui lòng kiểm tra email." });
    }

    // Tạo OTP mới
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 phút
    console.log(otp, email);
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, otp, expires_at, used)
       VALUES (?, ?, ?, FALSE)`,
      [user.id, otp, expiresAt]
    );

    try {
      await sendOTPEmail(email, otp);
    } catch (mailErr) {
      console.error("Mail error:", mailErr);
      return res.status(500).json({ error: "Không thể gửi email. Vui lòng thử lại sau." });
    }

    return res.json({ message: "OTP đã được gửi đến email của bạn" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server" });
  }
});


/**
 * POST /auth/verify-otp
 * body: { email, otp }
 * Trả về success nếu otp hợp lệ (chưa used và chưa hết hạn)
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const { otp } = req.body
    if (!email || !otp)
      return res.status(400).json({ error: "Email và OTP bắt buộc" })

    const [[user]] = await pool.query("SELECT id FROM users WHERE email = ?", [email])
    if (!user) return res.status(400).json({ error: "Email không hợp lệ" })

    const [[token]] = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE user_id = ? AND otp = ? AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, otp]
    )

    if (!token) return res.status(400).json({ error: "OTP không đúng" })

    if (new Date() > new Date(token.expires_at))
      return res.status(400).json({ error: "OTP đã hết hạn" })

    return res.json({ message: "OTP hợp lệ" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Lỗi server" })
  }
})

/**
 * POST /auth/reset-password
 * body: { email, otp, newPassword }
 * -> verify otp one more time (or rely on previous verify step)
 */
router.post("/reset-password", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const { otp, newPassword } = req.body
    if (!email || !otp || !newPassword)
      return res.status(400).json({ error: "Thiếu dữ liệu" })

    const [[user]] = await pool.query("SELECT id FROM users WHERE email = ?", [email])
    if (!user) return res.status(400).json({ error: "Email không hợp lệ" })

    const [[token]] = await pool.query(
      `SELECT * FROM password_reset_tokens
       WHERE user_id = ? AND otp = ? AND used = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [user.id, otp]
    )

    if (!token) return res.status(400).json({ error: "OTP không đúng" })

    if (new Date() > new Date(token.expires_at))
      return res.status(400).json({ error: "OTP đã hết hạn" })

    // Hash password
    const hashed = await bcrypt.hash(newPassword, 10)

    await pool.query("UPDATE users SET password = ? WHERE id = ?", [hashed, user.id])

    // ❗ Mark used tại đây mới đúng
    await pool.query("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", [token.id])

    return res.json({ message: "Đổi mật khẩu thành công" })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Lỗi server" })
  }
})

/**
 * GET /auth/otp-status?email=...
 * Trả về: { otpValid: boolean, expiresAt: DATETIME }
 */
router.get("/otp-status", async (req, res) => {
  try {
    const email = normalizeEmail(req.query?.email);
    if (!email) return res.status(400).json({ error: "Email bắt buộc" });

    const [[user]] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (!user) return res.status(404).json({ error: "Email không tồn tại" });

    const [token] = await pool.query(
      `SELECT otp, expires_at FROM password_reset_tokens
       WHERE user_id = ? AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );

    if (!token || token.length === 0) {
      return res.json({ otpValid: false });
    }

    return res.json({
      otpValid: true,
      expiresAt: token[0].expires_at // ISO string có thể dùng client tính countdown
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
});

// Đăng ký tài khoản (email + password)
router.post("/register", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const { password, name } = req.body

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Thiếu thông tin đăng ký" })
    }

    const normalizedRole = "user"

    // Kiểm tra email tồn tại
    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email])
    if (rows.length > 0) {
      return res.status(400).json({ error: "Email đã được sử dụng" })
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10)

    // Thêm user mới
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password, avatar_url, role, status, joinDate) VALUES (?, ?, ?, ?, ?, 'active', CURDATE())",
      [name, email, hashedPassword, "", normalizedRole]
    )

    const newUser = {
      id: result.insertId,
      email,
      name,
      role: normalizedRole,
    }

    // Tạo JWT
    const token = jwt.sign(newUser, JWT_SECRET, { expiresIn: "1h" })
    res.status(201).json({ token, user: newUser })
  } catch (error) {
    console.error("❌ Lỗi khi đăng ký:", error)
    res.status(500).json({ error: "Đăng ký thất bại" })
  }
})

// Đăng nhập bằng email + password
router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email)
    const { password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Thiếu email hoặc mật khẩu" })
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email])
    if (rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" })
    }

    const user = rows[0]

    // Kiểm tra trạng thái tài khoản
    if (user.status === "banned") {
      return res.status(403).json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ error: "Sai mật khẩu" })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, avatar_url: user.avatar_url, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    )

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
      },
    })
  } catch (error) {
    console.error("❌ Lỗi khi đăng nhập:", error)
    res.status(500).json({ error: "Đăng nhập thất bại" })
  }
})

router.post("/google-login", async (req, res) => {
  try {
    const { credential } = req.body
    const { email: rawEmail, name, imageUrl, googleId } = await verifyGoogleCredential(credential)
    const email = normalizeEmail(rawEmail)

    if (!email) {
      return res.status(400).json({ error: "Không lấy được email từ Google" })
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email])

    let user
    if (rows.length === 0) {
      const dummyPassword = await bcrypt.hash(googleId || email, 5)
      const [result] = await pool.query(
        "INSERT INTO users (name, email, avatar_url, password, role, status, joinDate) VALUES (?, ?, ?, ?, 'user', 'active', CURDATE())",
        [name, email, imageUrl, dummyPassword]
      )

      user = {
        id: result.insertId,
        email,
        name,
        avatar_url: imageUrl,
        role: "user",
      }
    } else {
      user = rows[0]

      if ((!user.avatar_url && imageUrl) || (name && user.name !== name)) {
        await pool.query(
          "UPDATE users SET name = COALESCE(NULLIF(?, ''), name), avatar_url = COALESCE(NULLIF(?, ''), avatar_url) WHERE id = ?",
          [name, imageUrl, user.id]
        )
        user = {
          ...user,
          name: name || user.name,
          avatar_url: imageUrl || user.avatar_url,
        }
      }
    }

    if (user.status === "banned") {
      return res.status(403).json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." })
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, avatar_url: user.avatar_url },
      JWT_SECRET,
      { expiresIn: "1h" }
    )

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
        role: user.role,
      },
      loginType: "google",
    })
  } catch (error) {
    console.error("Google login failed:", error.response?.data || error.message || error)
    res.status(401).json({ error: "Đăng nhập Google thất bại" })
  }
})


// Lấy thông tin user hiện tại (JWT)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, avatar_url, role, status, joinDate FROM users WHERE id = ?",
      [req.user.id]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: "Không tìm thấy người dùng" })
    }

    res.json(rows[0])
  } catch (error) {
    console.error("❌ Lỗi khi lấy thông tin user:", error)
    res.status(500).json({ error: "Lỗi server" })
  }
})

export default router
