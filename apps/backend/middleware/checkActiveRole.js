import pool from "../db.js"

const buildRoleChangedError = (message = "Vai tr├▓ ─æ├ú thay ─æß╗òi. Vui l├▓ng ─æ─âng nhß║¡p lß║íi.") => ({
  error: message,
  code: "ROLE_CHANGED",
})

export const checkActiveRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Ch╞░a ─æ─âng nhß║¡p" })
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
        return res.status(403).json({ error: "T├ái khoß║ún kh├┤ng tß╗ôn tß║íi", code: "USER_NOT_FOUND" })
      }

      if (currentUser.status !== "active") {
        return res.status(403).json({ error: "T├ái khoß║ún kh├┤ng c├▓n hoß║ít ─æß╗Öng", code: "ACCOUNT_INACTIVE" })
      }

      const currentRole = currentUser.role
      const roleChanged = req.user.role && req.user.role !== currentRole

      if (allowedRoles.length > 0 && !allowedRoles.includes(currentRole)) {
        if (roleChanged) {
          return res.status(403).json(buildRoleChangedError())
        }

        return res.status(403).json({ error: "Bß║ín kh├┤ng c├│ quyß╗ün truy cß║¡p t├ái nguy├¬n n├áy", code: "FORBIDDEN_ROLE" })
      }

      req.user = {
        ...req.user,
        ...currentUser,
      }

      next()
    } catch (error) {
      console.error("Γ¥î Lß╗ùi checkActiveRole:", error)
      return res.status(500).json({ error: "Lß╗ùi m├íy chß╗º" })
    }
  }
}

export const roleChangedError = buildRoleChangedError
