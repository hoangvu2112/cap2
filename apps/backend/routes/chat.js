import express from "express";
import pool from "../db.js";
import OpenAI from "openai";

const router = express.Router();

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// 1️⃣ Tạo session mới
router.post("/session", async (req, res) => {
    try {
        const { user_id } = req.body;

        const [result] = await pool.query(`
            INSERT INTO conversation_sessions (user_id)
            VALUES (?)
        `, [user_id]);

        res.json({
            success: true,
            session_id: result.insertId
        });

    } catch (error) {
        console.error("Lỗi tạo session:", error);
        res.status(500).json({ error: "Lỗi tạo session" });
    }
});


// 2️⃣ API chat thông minh (đọc DB + dự đoán giá + kiểm duyệt câu hỏi)
router.post("/message", async (req, res) => {
    try {
        const { session_id, user_id, message } = req.body;

        // ⭐ Kiểm tra câu hỏi có liên quan nông sản hay không
        const allowedKeywords = [
            "giá", "nông sản", "trend", "lịch sử", "dự đoán", "biến động",
            "cà phê", "hồ tiêu", "cao su", "lúa", "sản phẩm", "khu vực",
            "thị trường", "market",
            // Cho phép chào hỏi & hướng dẫn
            "xin chào", "hello", "hi", "chào", "bạn là ai", "hướng dẫn",
            "giúp", "help", "cảm ơn", "thanks", "tạm biệt"
        ];

        const isRelated = allowedKeywords.some(keyword =>
            message.toLowerCase().includes(keyword)
        );

        if (!isRelated) {
            return res.json({
                success: true,
                reply: "Xin lỗi, tôi chỉ trả lời các câu hỏi liên quan đến nông sản, thị trường, giá, xu hướng và phân tích dữ liệu. Bạn có thể hỏi ví dụ: 'Giá cà phê hôm nay bao nhiêu?'"
            });
        }

        // 1️⃣ Lưu message user vào DB
        await pool.query(`
            INSERT INTO conversation_messages (session_id, user_id, role, message)
            VALUES (?, ?, 'user', ?)
        `, [session_id, user_id, message]);


        // 2️⃣ Lấy lịch sử chat
        const [history] = await pool.query(
            `SELECT role, message FROM conversation_messages WHERE session_id = ? ORDER BY id ASC`,
            [session_id]
        );

        // 3️⃣ TƯ ĐỘNG truy vấn database tùy thuộc câu hỏi
        let dbContext = "";
        const lower = message.toLowerCase();

        // LẤY DANH SÁCH SẢN PHẨM
        if (lower.includes("sản phẩm") || lower.includes("nông sản")) {
            const [rows] = await pool.query(`
                SELECT id, name, currentPrice, region FROM products LIMIT 50
            `);
            dbContext += `\nDANH SÁCH SẢN PHẨM:\n${JSON.stringify(rows, null, 2)}\n`;
        }

        // LẤY GIÁ HIỆN TẠI
        if (lower.includes("giá") || lower.includes("bao nhiêu")) {
            const [rows] = await pool.query(`
                SELECT name, currentPrice, region FROM products
            `);
            dbContext += `\nGIÁ HIỆN TẠI:\n${JSON.stringify(rows, null, 2)}\n`;
        }

        // LỊCH SỬ GIÁ
        if (lower.includes("lịch sử") || lower.includes("biến động") || lower.includes("trend")) {
            const [rows] = await pool.query(`
                SELECT product_id, price, updated_at
                FROM price_history
                ORDER BY updated_at DESC LIMIT 100
            `);
            dbContext += `\nLỊCH SỬ GIÁ:\n${JSON.stringify(rows, null, 2)}\n`;
        }


        // 4️⃣ THUẬT TOÁN DỰ ĐOÁN GIÁ (simple regression)
        let predictionResult = "";

        if (lower.includes("dự đoán") || lower.includes("dự báo")) {
            const [priceRows] = await pool.query(`
                SELECT price FROM price_history ORDER BY updated_at ASC LIMIT 30
            `);

            // Không đủ data
            if (priceRows.length > 5) {
                const prices = priceRows.map(p => p.price);
                const n = prices.length;

                const avg = prices.reduce((a, b) => a + b, 0) / n;
                const trend = prices[n - 1] - prices[0];

                const forecast = prices[n - 1] + trend * 0.1; // simple predict

                predictionResult = `
DỰ BÁO GIÁ:
- Giá hiện tại: ${prices[n - 1]}
- Xu hướng: ${trend > 0 ? "tăng" : "giảm"}
- Dự đoán giá vài ngày tới: khoảng ${forecast}
                `;
            } else {
                predictionResult = "Không đủ dữ liệu để dự đoán.";
            }
        }


        // 5️⃣ XÂY DỰNG PROMPT GỬI OPENAI
        const now = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

        const messages = [
            {
                role: "system",
                content: `
Bạn là trợ lý phân tích nông sản.
Nhiệm vụ của bạn:
- Trả lời dựa trên dữ liệu trong database.
- Nếu người dùng hỏi ngày → ngày hiện tại là: ${now}.
- Không được bịa.
- Nếu không có dữ liệu liên quan → nói không đủ dữ liệu.
- Nếu có phần "DỰ BÁO GIÁ" thì hãy dùng để phân tích.
================================================
DATA TỪ DATABASE:
${dbContext || "Không có dữ liệu phù hợp câu hỏi."}
================================================
${predictionResult}
`
            },
            ...history.map(m => ({
                role: m.role,
                content: m.message
            }))
        ];

        // 6️⃣ Gọi OpenAI (có xử lý lỗi graceful)
        if (!process.env.OPENAI_API_KEY) {
            return res.json({
                success: true,
                reply: "⚠️ Trợ lý AI hiện chưa được cấu hình (thiếu API Key). Vui lòng liên hệ quản trị viên."
            });
        }

        let aiReply;
        try {
            const completion = await client.chat.completions.create({
                model: "gpt-4o-mini",
                messages
            });
            aiReply = completion.choices[0].message.content;

            // 7️⃣ Lưu reply AI
            await pool.query(`
                INSERT INTO conversation_messages (session_id, role, message, tokens_used)
                VALUES (?, 'assistant', ?, ?)
            `, [
                session_id,
                aiReply,
                completion.usage?.total_tokens || 0
            ]);
        } catch (aiError) {
            console.error("Lỗi gọi OpenAI:", aiError);
            aiReply = "⚠️ Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại sau.";
        }

        res.json({
            success: true,
            reply: aiReply
        });

    } catch (error) {
        console.error("Lỗi gửi tin nhắn:", error);
        res.status(500).json({ error: "Lỗi gửi tin nhắn" });
    }
});

// 4️⃣ Lấy danh sách session của người dùng
// 4️⃣ Lấy danh sách session có tin nhắn (loại bỏ session rỗng)
router.get("/sessions/:user_id", async (req, res) => {
    try {
        const { user_id } = req.params;

        const [rows] = await pool.query(`
            SELECT s.id, s.title, s.created_at
            FROM conversation_sessions s
            JOIN conversation_messages m ON m.session_id = s.id
            WHERE s.user_id = ?
            GROUP BY s.id
            HAVING COUNT(m.id) > 0
            ORDER BY s.created_at DESC
        `, [user_id]);

        res.json({
            success: true,
            sessions: rows
        });

    } catch (error) {
        console.error("Lỗi lấy session:", error);
        res.status(500).json({ error: "Lỗi lấy session" });
    }
});

// 3️⃣ Lấy lịch sử chat
router.get("/:session_id/messages", async (req, res) => {
    try {
        const { session_id } = req.params;

        const [rows] = await pool.query(`
            SELECT id, role, message, created_at
            FROM conversation_messages
            WHERE session_id = ?
            ORDER BY id ASC
        `, [session_id]);

        res.json({
            success: true,
            messages: rows
        });

    } catch (error) {
        console.error("Lỗi lấy tin nhắn:", error);
        res.status(500).json({ error: "Lỗi lấy tin nhắn" });
    }
});


router.patch("/session/title", async (req, res) => {
    try {
        const { session_id, title } = req.body;

        await pool.query(`
            UPDATE conversation_sessions
            SET title = ?
            WHERE id = ?
        `, [title, session_id]);

        res.json({
            success: true,
            message: "Đã đổi tên phiên chat."
        });

    } catch (error) {
        console.error("Lỗi đổi tên session:", error);
        res.status(500).json({ error: "Lỗi đổi tên session" });
    }
});



export default router;
