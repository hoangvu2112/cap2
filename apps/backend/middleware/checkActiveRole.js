import pool from "../db.js"

const buildRoleChangedError = (message = "Vai trò đã thay đổi. Vui lòng đăng nhập lại.") => ({
  error: message,
  code: "ROLE_CHANGED",
})

export const checkActiveRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Chưa đăng nhập" })
      }

      const [rows] = await pool.query(
        `
          SELECT id, name, email, avatar_url, role, status
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [req.user.id]
      )

      const currentUser = rows[0]
      if (!currentUser) {
        return res.status(403).json({ error: "Tài khoản không tồn tại", code: "USER_NOT_FOUND" })
      }

      if (currentUser.status !== "active") {
        return res.status(403).json({ error: "Tài khoản không còn hoạt động", code: "ACCOUNT_INACTIVE" })
      }

      const currentRole = currentUser.role
      const roleChanged = req.user.role && req.user.role !== currentRole

      if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
        if (roleChanged) {
          return res.status(403).json(buildRoleChangedError())
        }

        return res.status(403).json({ error: "Bạn không có quyền truy cập tài nguyên này", code: "FORBIDDEN_ROLE" })
      }

      req.user = {
        ...req.user,
        ...currentUser,
      }

      next()
    } catch (error) {
      console.error("❌ Lỗi checkActiveRole:", error)
      return res.status(500).json({ error: "Lỗi máy chủ" })
    }
  }
}

export const roleChangedError = buildRoleChangedError