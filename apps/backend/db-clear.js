import mysql from "mysql2/promise"
import dotenv from "dotenv"

dotenv.config()

const DB_NAME = process.env.DB_NAME || "agrirend"
const DB_HOST = process.env.DB_HOST || "localhost"
const DB_USER = process.env.DB_USER || "root"
const DB_PASS = process.env.DB_PASS || ""

const clearDB = async () => {
    try {
        const connection = await mysql.createConnection({
            host: DB_HOST,
            user: DB_USER,
            password: DB_PASS,
        })

        // Xoá cả database
        await connection.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``)
        console.log(`💣 Đã xoá toàn bộ database "${DB_NAME}".`)

        await connection.end()
        console.log("✅ Kết nối MySQL đã đóng.")
    } catch (error) {
        console.error("❌ Lỗi khi xoá database:", error)
    }
}

// Gọi hàm chính
clearDB()
