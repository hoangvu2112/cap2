import { createClerkClient } from "@clerk/backend"
import { verifyToken } from "@clerk/express"

const clerk = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
})

export const verifyClerkToken = async (req, res, next) => {
    try {
        const authHeader = req.headers["authorization"]
        const token = authHeader && authHeader.split(" ")[1]
        if (!token) return res.status(401).json({ error: "Missing token" })

        // ✅ Xác thực token
        const payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
        })

        // ✅ Lấy user chi tiết từ Clerk
        const user = await clerk.users.getUser(payload.sub)

        req.clerkUser = {
            id: user.id,
            email: user.emailAddresses?.[0]?.emailAddress || null,
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            name:
                [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
                user.username ||
                user.emailAddresses?.[0]?.emailAddress?.split("@")[0],
            imageUrl: user.imageUrl || null,
        }
        // console.log("👤 Clerk user data:", {
        //     id: user.id,
        //     firstName: user.firstName,
        //     lastName: user.lastName,
        //     email: user.emailAddresses?.[0]?.emailAddress,
        //     name: [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
        //         user.username ||
        //         user.emailAddresses?.[0]?.emailAddress?.split("@")[0],

        // })
        //console.log("raw clerk user:", JSON.stringify(user, null, 2))

        next()
    } catch (error) {
        console.error("❌ Clerk token verify failed:", error)
        return res.status(401).json({ error: "Invalid Clerk token" })
    }
}
