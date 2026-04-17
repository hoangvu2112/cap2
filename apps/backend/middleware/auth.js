import jwt from "jsonwebtoken"

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production"

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  //console.log("Auth header:", authHeader);
  const token = authHeader && authHeader.split(" ")[1]
  if (!token) return res.status(401).json({ error: "Chưa đăng nhập" })

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    next()
  } catch {
    return res.status(403).json({ error: "Token không hợp lệ" })
  }
}

export const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" })
  }
  next()
}
