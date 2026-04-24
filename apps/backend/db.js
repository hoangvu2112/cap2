import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Đảm bảo luôn load đúng file .env ở apps/backend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "./.env") });

const DB_NAME = process.env.DB_NAME || "agrirend"
const DB_HOST = process.env.DB_HOST || "localhost"
const DB_USER = process.env.DB_USER || "root"
const DB_PASS = process.env.DB_PASS || ""

// Hàm khởi tạo DB
const initDB = async () => {
  try {
    // 1️⃣ Kết nối MySQL tạm để tạo database nếu chưa có
    const connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
    })

    await connection.query(`
      CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_unicode_ci
    `)
    console.log(`✅ Database "${DB_NAME}" đã sẵn sàng.`)
    await connection.end()

    // 2️⃣ Kết nối tới database
    const pool = await mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASS,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })

    // Bảng users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(191) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(255) NOT NULL,
        region VARCHAR(100) DEFAULT NULL,
        role ENUM('admin','user','dealer') DEFAULT 'user',
        status VARCHAR(50) DEFAULT 'active',
        joinDate DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log("✅ Bảng 'users' đã sẵn sàng.")

    // Đồng bộ enum role cho DB cũ
    await pool.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('admin','user','dealer') DEFAULT 'user'"
    )

    // Đảm bảo cột region tồn tại
    const [userColumns] = await pool.query(`
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'region'
    `, [DB_NAME]);
    if (userColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN region VARCHAR(100) DEFAULT NULL");
      console.log("✅ Đã thêm cột 'region' vào bảng 'users'.");
    }

    const [userCount] = await pool.query("SELECT COUNT(*) AS c FROM users")
    if (userCount[0].c === 0) {
      await pool.query(`
        INSERT INTO users (name, email, password, avatar_url, role, status, joinDate)
        VALUES
        ('Quản Trị Viên', 'admin@agriprice.vn',
        '$2a$10$T29JR61meNJ4J.rApPd4Gut9qzdrLBdXHeKGeAP0jlzeHWM.RYEOG', '', 'admin', 'active', '2024-01-10'),
        ('User', 'user@example.com',
        '$2a$10$vq5MDtbp4C5vX1NtcE0f9eOgIw.yeLZAlMQacfMa838PlK10H2iQC', '', 'user', 'active', '2024-01-15')
      `)
      console.log("🍀 Đã chèn người dùng mẫu vào bảng 'users'.")
    }

    // Bảng categories
    await pool.query(`
  CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
    console.log("✅ Bảng 'categories' đã sẵn sàng.");

    // Dữ liệu mẫu cho categories
    const [catCount] = await pool.query("SELECT COUNT(*) AS c FROM categories");
    if (catCount[0].c === 0) {
      await pool.query(`
    INSERT INTO categories (name)
    VALUES
    ('Lúa gạo'),
    ('Trái cây'),
    ('Cà phê'),
    ('Hồ tiêu'),
    ('Thủy hải sản'),
    ('Gia vị & Rau củ')
  `);
      console.log("🍀 Đã chèn dữ liệu mẫu vào bảng 'categories'.");
    }

    // Bảng products (liên kết categories)
    await pool.query(`
  CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT,
    currentPrice DECIMAL(10,2),
    previousPrice DECIMAL(10,2),
    unit VARCHAR(50),
    region VARCHAR(100),
    quantity_available DECIMAL(12,2) DEFAULT 0,
    harvest_start DATE NULL,
    harvest_end DATE NULL,
    farmer_user_id INT NULL,
    lastUpdate DATETIME,
    trend ENUM('up','down','stable'),
    analysis_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (farmer_user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);
    console.log("✅ Bảng 'products' đã sẵn sàng (đã liên kết category_id).");

    // Đồng bộ cột cho DB cũ (tương thích cả MySQL cũ không hỗ trợ IF NOT EXISTS)
    const ensureProductColumn = async (columnName, definitionSql) => {
      const [colRows] = await pool.query(
        `
          SELECT 1
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'products'
            AND COLUMN_NAME = ?
          LIMIT 1
        `,
        [DB_NAME, columnName]
      )

      if (colRows.length === 0) {
        try {
          await pool.query(`ALTER TABLE products ADD COLUMN ${definitionSql}`)
        } catch (error) {
          if (error.code !== "ER_DUP_FIELDNAME") {
            throw error
          }
        }
      }
    }

    await ensureProductColumn("quantity_available", "quantity_available DECIMAL(12,2) DEFAULT 0")
    await ensureProductColumn("harvest_start", "harvest_start DATE NULL")
    await ensureProductColumn("harvest_end", "harvest_end DATE NULL")
    await ensureProductColumn("farmer_user_id", "farmer_user_id INT NULL")

    try {
      await pool.query("ALTER TABLE products ADD CONSTRAINT fk_products_farmer_user FOREIGN KEY (farmer_user_id) REFERENCES users(id) ON DELETE SET NULL")
    } catch {
      // Bỏ qua nếu constraint đã tồn tại
    }

    // Bảng analysis_data (Lưu bản mới nhất)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_data (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL UNIQUE,
        analysis_json JSON NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ Bảng 'analysis_data' đã sẵn sàng.");

    // Bảng analysis_history (Lưu lịch sử)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        analysis_json JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ Bảng 'analysis_history' đã sẵn sàng.");


  //   const [productCount] = await pool.query("SELECT COUNT(*) AS c FROM products")
  //   if (productCount[0].c === 0) {
  //     // Lấy id của từng category
  //     const [cats] = await pool.query("SELECT id, name FROM categories")
  //     const cat = Object.fromEntries(cats.map(c => [c.name, c.id]))

  //     await pool.query(`
  //   INSERT INTO products (name, category_id, currentPrice, previousPrice, unit, region, lastUpdate, trend)
  //   VALUES
  //   ('Lúa Gạo ST25', ?, 8500, 8200, 'kg', 'Đồng bằng sông Cửu Long', '2025-09-10 13:42:00', 'up'),
  //   ('Xoài Cát Hòa Lộc', ?, 45000, 47000, 'kg', 'Tiền Giang', '2025-09-09 10:30:00', 'down'),
  //   ('Cà Phê Robusta', ?, 120000, 118000, 'kg', 'Đắk Lắk', '2025-09-11 08:20:00', 'up'),
  //   ('Sầu Riêng Ri6', ?, 150000, 145000, 'kg', 'Cần Thơ', '2025-09-11 09:00:00', 'up'),
  //   ('Hồ Tiêu Chư Sê', ?, 155000, 158000, 'kg', 'Gia Lai', '2025-09-11 07:30:00', 'down'),
  //   ('Thanh Long Bình Thuận', ?, 15000, 14000, 'kg', 'Bình Thuận', '2025-09-10 15:20:00', 'up'),
  //   ('Tôm Thẻ Chân Trắng', ?, 135000, 135000, 'kg', 'Sóc Trăng', '2025-09-11 10:00:00', 'stable'),
  //   ('Cá Tra Phi Lê', ?, 32000, 31500, 'kg', 'An Giang', '2025-09-11 06:45:00', 'up')
  // `, [cat["Lúa gạo"], cat["Trái cây"], cat["Cà phê"], cat["Trái cây"], cat["Hồ tiêu"], cat["Trái cây"], cat["Thủy hải sản"], cat["Thủy hải sản"]])
  //     console.log("🍀 Đã chèn sản phẩm mẫu vào bảng 'products'.")
  //   }

    // Bảng price_history ở đây
    await pool.query(`
            CREATE TABLE IF NOT EXISTS price_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                product_id INT NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
`)
    console.log("✅ Bảng 'price_history' đã sẵn sàng.")

    // Chèn dữ liệu mẫu cho bảng price_history
    const [countHist] = await pool.query("SELECT COUNT(*) AS c FROM price_history");
    if (countHist[0].c === 0) {
      const [products] = await pool.query("SELECT id, currentPrice FROM products");

      for (const product of products) { // ✅ dùng đúng biến products
        const historyData = [];
        for (let i = 0; i < 30; i++) {
          const date = new Date();
          date.setDate(date.getDate() - (29 - i));

          // ✅ Kiểm tra & đảm bảo giá hợp lệ
          const basePrice = Number(product.currentPrice) || 10000;
          const randomChange = Math.random() * 2000 - 1000;
          const price = Math.max(500, Math.round(basePrice + randomChange));

          historyData.push([product.id, price, date.toISOString().slice(0, 19).replace("T", " ")]);
        }

        await pool.query(
          "INSERT INTO price_history (product_id, price, updated_at) VALUES ?",
          [historyData]
        );
      }

      console.log("📈 Đã tạo dữ liệu ảo 30 ngày cho bảng 'price_history'.");
    }


    // Bảng favorites
    await pool.query(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_product (user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `)
    console.log("✅ Bảng 'favorites' đã sẵn sàng.")

    // Bảng price_alerts
    await pool.query(`
  CREATE TABLE IF NOT EXISTS price_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    target_price DECIMAL(10,2) NOT NULL,
    alert_condition ENUM('above', 'below') NOT NULL,
    email VARCHAR(191) NOT NULL,
    notified BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  )
`)
    console.log("✅ Bảng 'price_alerts' đã sẵn sàng.")

    // Bảng chi phí của người dùng
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_costs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        cost_price DECIMAL(10,2) NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_product (user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `)
    console.log("✅ Bảng 'user_costs' đã sẵn sàng.")

    // Bảng community_posts
    await pool.query(`
      CREATE TABLE IF NOT EXISTS community_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        content TEXT NOT NULL,
        tags LONGTEXT,
        image_url TEXT,
        likes INT DEFAULT 0,
        comments_count INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
    
    // Đảm bảo cột image_url tồn tại cho các DB cũ
    const [commColumns] = await pool.query(`
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'community_posts' AND COLUMN_NAME = 'image_url'
    `, [DB_NAME]);
    
    if (commColumns.length === 0) {
      await pool.query("ALTER TABLE community_posts ADD COLUMN image_url TEXT AFTER tags");
      console.log("✅ Đã thêm cột 'image_url' vào bảng 'community_posts'.");
    }
    
    console.log("✅ Bảng 'community_posts' đã sẵn sàng.")

    // Bảng community_comments
    await pool.query(`
  CREATE TABLE IF NOT EXISTS community_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)
    console.log("✅ Bảng 'community_comments' đã sẵn sàng.")

    // Đảm bảo cột deleted_at tồn tại cho bảng bình luận (Soft Delete)
    const [commentCols] = await pool.query(`
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'community_comments' AND COLUMN_NAME = 'deleted_at'
    `, [DB_NAME]);
    
    if (commentCols.length === 0) {
      await pool.query("ALTER TABLE community_comments ADD COLUMN deleted_at DATETIME DEFAULT NULL AFTER content");
      console.log("✅ Đã thêm cột 'deleted_at' vào bảng 'community_comments'.");
    }

    // Bảng community_likes
    await pool.query(`
  CREATE TABLE IF NOT EXISTS community_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_like (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)
    console.log("✅ Bảng 'community_likes' đã sẵn sàng.")

    // Bảng lưu session chat
    await pool.query(`
  CREATE TABLE IF NOT EXISTS direct_message_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_one_id INT NOT NULL,
    user_two_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_pair (user_one_id, user_two_id),
    FOREIGN KEY (user_one_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_two_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (user_one_id < user_two_id)
  )
`);
    console.log("âœ… Báº£ng 'direct_message_conversations' Ä‘Ã£ sáºµn sÃ ng.");

    await pool.query(`
  CREATE TABLE IF NOT EXISTS direct_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES direct_message_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conversation_created (conversation_id, created_at),
    INDEX idx_recipient_read (recipient_id, is_read)
  )
`);
    console.log("âœ… Báº£ng 'direct_messages' Ä‘Ã£ sáºµn sÃ ng.");

    await pool.query(`
  CREATE TABLE IF NOT EXISTS conversation_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    bot_mode VARCHAR(20) NOT NULL DEFAULT 'user',
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    title VARCHAR(255) DEFAULT 'Cuộc trò chuyện',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);
    console.log("✅ Bảng 'conversation_sessions' đã sẵn sàng.");

    const [sessionModeColumns] = await pool.query(
      `
        SELECT 1
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'conversation_sessions'
          AND COLUMN_NAME = 'bot_mode'
        LIMIT 1
      `,
      [DB_NAME]
    )
    if (sessionModeColumns.length === 0) {
      try {
        await pool.query("ALTER TABLE conversation_sessions ADD COLUMN bot_mode VARCHAR(20) NOT NULL DEFAULT 'user'")
      } catch (error) {
        if (error.code !== "ER_DUP_FIELDNAME") {
          throw error
        }
      }
    }

    const ensureSessionFlagColumn = async (columnName, definitionSql) => {
      const [flagRows] = await pool.query(
        `
          SELECT 1
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'conversation_sessions'
            AND COLUMN_NAME = ?
          LIMIT 1
        `,
        [DB_NAME, columnName]
      )

      if (flagRows.length === 0) {
        try {
          await pool.query(`ALTER TABLE conversation_sessions ADD COLUMN ${definitionSql}`)
        } catch (error) {
          if (error.code !== "ER_DUP_FIELDNAME") {
            throw error
          }
        }
      }
    }

    await ensureSessionFlagColumn("is_archived", "is_archived BOOLEAN NOT NULL DEFAULT FALSE")
    await ensureSessionFlagColumn("is_pinned", "is_pinned BOOLEAN NOT NULL DEFAULT FALSE")
    await ensureSessionFlagColumn("updated_at", "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")

    // Bảng lưu tin nhắn của AI + User
    await pool.query(`
  CREATE TABLE IF NOT EXISTS conversation_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    user_id INT,
    role ENUM('user','assistant','system') NOT NULL,
    message LONGTEXT NOT NULL,
    tokens_used INT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  )
`);
    console.log("✅ Bảng 'conversation_messages' đã sẵn sàng.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dealer_plans (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(120) NOT NULL,
        price_vnd INT NOT NULL DEFAULT 0,
        duration_days INT NOT NULL DEFAULT 30,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
    console.log("✅ Bảng 'dealer_plans' đã sẵn sàng.")

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dealer_upgrade_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        plan_id INT NOT NULL,
        status ENUM('pending_payment','pending_review','approved','rejected','cancelled') NOT NULL DEFAULT 'pending_payment',
        payment_status ENUM('unpaid','paid','refunded') NOT NULL DEFAULT 'unpaid',
        payment_ref VARCHAR(120) DEFAULT NULL,
        note TEXT,
        admin_note TEXT,
        warning_sent BOOLEAN DEFAULT FALSE,
        reviewed_by INT DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        approved_at DATETIME DEFAULT NULL,
        expires_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dealer_request_user (user_id, status),
        INDEX idx_dealer_request_status (status, payment_status),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (plan_id) REFERENCES dealer_plans(id) ON DELETE RESTRICT,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `)
    console.log("✅ Bảng 'dealer_upgrade_requests' đã sẵn sàng.")

    // Thêm các cột thông tin pháp lý cho đại lý
    const ensureUpgradeColumn = async (columnName, definitionSql) => {
      const [colRows] = await pool.query(`
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'dealer_upgrade_requests' AND COLUMN_NAME = ?
      `, [DB_NAME, columnName]);
      if (colRows.length === 0) {
        await pool.query(`ALTER TABLE dealer_upgrade_requests ADD COLUMN ${definitionSql}`);
        console.log(`✅ Đã thêm cột '${columnName}' vào bảng 'dealer_upgrade_requests'.`);
      }
    };

    await ensureUpgradeColumn("business_name", "business_name VARCHAR(255) DEFAULT NULL");
    await ensureUpgradeColumn("tax_code", "tax_code VARCHAR(50) DEFAULT NULL");
    await ensureUpgradeColumn("business_address", "business_address TEXT DEFAULT NULL");
    await ensureUpgradeColumn("representative_name", "representative_name VARCHAR(100) DEFAULT NULL");
    await ensureUpgradeColumn("phone_contact", "phone_contact VARCHAR(20) DEFAULT NULL");
    await ensureUpgradeColumn("business_items", "business_items TEXT DEFAULT NULL"); // Các mặt hàng kinh doanh

    // Vô hiệu hóa gói membership cũ nếu tồn tại
    await pool.query("UPDATE dealer_plans SET is_active = FALSE WHERE code = 'dealer_membership'");

    // Cập nhật/Thêm các gói cước đại lý mới
    const ensureDealerPlan = async (code, name, price, days) => {
      const [rows] = await pool.query("SELECT id FROM dealer_plans WHERE code = ? LIMIT 1", [code]);
      if (rows.length === 0) {
        await pool.query(
          "INSERT INTO dealer_plans (code, name, price_vnd, duration_days, is_active) VALUES (?, ?, ?, ?, TRUE)",
          [code, name, price, days]
        );
      } else {
        await pool.query(
          "UPDATE dealer_plans SET name = ?, price_vnd = ?, duration_days = ?, is_active = TRUE WHERE code = ?",
          [name, price, days, code]
        );
      }
    };

    await ensureDealerPlan("dealer_30", "Gói Đại lý 30 ngày", 100000, 30);
    await ensureDealerPlan("dealer_90", "Gói Đại lý 90 ngày", 250000, 90);
    await ensureDealerPlan("dealer_365", "Gói Đại lý 1 năm", 800000, 365);

    await pool.query(`
  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    otp VARCHAR(10) NOT NULL,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX (user_id),
    INDEX (expires_at)
  )
`);
    console.log("✅ Bảng 'password_reset_tokens' đã sẵn sàng.");

    // Bảng news (tin tức)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        content LONGTEXT,
        source VARCHAR(255),
        url VARCHAR(500),
        status ENUM('draft', 'published') DEFAULT 'draft',
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("✅ Bảng 'news' đã sẵn sàng.");

    // Dữ liệu mẫu cho news
    const [newsCount] = await pool.query("SELECT COUNT(*) AS c FROM news");
    if (newsCount[0].c === 0) {
      await pool.query(`
        INSERT INTO news (title, content, source, url, status, published_at)
        VALUES
        ('Giá lúa gạo tăng mạnh trong tuần qua', 'Giá lúa gạo tại Đồng bằng sông Cửu Long tăng 5% so với tuần trước, nguyên nhân chủ yếu do nhu cầu xuất khẩu tăng cao.', 'AgriTrend', '#', 'published', NOW()),
        ('Cà phê Robusta đạt mức cao kỷ lục', 'Giá cà phê Robusta trên sàn giao dịch London đã vượt mốc 4.000 USD/tấn, kéo giá trong nước tăng theo.', 'AgriTrend', '#', 'published', NOW()),
        ('Hồ tiêu phục hồi sau chuỗi ngày giảm', 'Sau 2 tuần liên tiếp giảm giá, hồ tiêu tại các tỉnh Tây Nguyên đã có dấu hiệu phục hồi nhẹ.', 'AgriTrend', '#', 'published', NOW())
      `);
      console.log("🍀 Đã chèn dữ liệu mẫu vào bảng 'news'.");
    }

    // Bảng yêu cầu mua giữa đại lý và nông dân
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        buyer_id INT NOT NULL,
        farmer_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity DECIMAL(12,2) NOT NULL,
        proposed_price DECIMAL(12,2) NOT NULL,
        note TEXT,
        status ENUM('pending','responded','closed') DEFAULT 'pending',
        dealer_fee_status ENUM('unpaid','recorded') NOT NULL DEFAULT 'unpaid',
        dealer_fee_amount INT NOT NULL DEFAULT 30000,
        dealer_action_at DATETIME DEFAULT NULL,
        dealer_report_status ENUM('none','reported') NOT NULL DEFAULT 'none',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        INDEX idx_purchase_buyer (buyer_id, status),
        INDEX idx_purchase_farmer (farmer_id, status)
      )
    `)
    console.log("✅ Bảng 'purchase_requests' đã sẵn sàng.")

    const ensurePurchaseRequestColumn = async (columnName, definitionSql) => {
      const [columnRows] = await pool.query(
        `
          SELECT 1
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = 'purchase_requests'
            AND COLUMN_NAME = ?
          LIMIT 1
        `,
        [DB_NAME, columnName]
      )

      if (columnRows.length === 0) {
        try {
          await pool.query(`ALTER TABLE purchase_requests ADD COLUMN ${definitionSql}`)
        } catch (error) {
          if (error.code !== "ER_DUP_FIELDNAME") {
            throw error
          }
        }
      }
    }

    await ensurePurchaseRequestColumn("dealer_fee_status", "dealer_fee_status ENUM('unpaid','recorded') NOT NULL DEFAULT 'unpaid'")
    await ensurePurchaseRequestColumn("dealer_fee_amount", "dealer_fee_amount INT NOT NULL DEFAULT 30000")
    await ensurePurchaseRequestColumn("dealer_action_at", "dealer_action_at DATETIME DEFAULT NULL")
    await ensurePurchaseRequestColumn("dealer_report_status", "dealer_report_status ENUM('none','reported') NOT NULL DEFAULT 'none'")

    // Tự động nâng cấp kiểu dữ liệu cho số lượng và giá đề xuất (DECIMAL 20,2)
    const ensureColumnType = async (tableName, columnName, desiredType) => {
      const [typeRows] = await pool.query(
        `
          SELECT COLUMN_TYPE
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND TABLE_NAME = ?
            AND COLUMN_NAME = ?
          LIMIT 1
        `,
        [DB_NAME, tableName, columnName]
      )

      if (typeRows.length > 0) {
        const currentType = typeRows[0].COLUMN_TYPE.toLowerCase()
        if (!currentType.includes(desiredType.toLowerCase())) {
          try {
            await pool.query(`ALTER TABLE ${tableName} MODIFY COLUMN ${columnName} ${desiredType} NOT NULL`)
            console.log(`✅ Đã nâng cấp cột '${columnName}' trong bảng '${tableName}' lên ${desiredType}.`)
          } catch (error) {
            console.error(`❌ Lỗi khi nâng cấp cột ${columnName}:`, error.message)
          }
        }
      }
    }

    await ensureColumnType("purchase_requests", "quantity", "DECIMAL(20,2)")
    await ensureColumnType("purchase_requests", "proposed_price", "DECIMAL(20,2)")

    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_request_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        sender_id INT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_request_messages (request_id, created_at)
      )
    `)
    console.log("✅ Bảng 'purchase_request_messages' đã sẵn sàng.")

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dealer_fee_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL UNIQUE,
        dealer_id INT NOT NULL,
        amount INT NOT NULL DEFAULT 30000,
        status ENUM('recorded','refunded') NOT NULL DEFAULT 'recorded',
        note VARCHAR(255) DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (dealer_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_dealer_fee_dealer (dealer_id, status)
      )
    `)
    console.log("✅ Bảng 'dealer_fee_transactions' đã sẵn sàng.")

    await pool.query(`
      CREATE TABLE IF NOT EXISTS dealer_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        request_id INT NOT NULL,
        reporter_id INT NOT NULL,
        reported_user_id INT NOT NULL,
        reason VARCHAR(255) NOT NULL,
        note TEXT,
        status ENUM('pending','resolved','rejected') NOT NULL DEFAULT 'pending',
        admin_note TEXT,
        reviewed_by INT DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES purchase_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_dealer_report_status (status, created_at)
      )
    `)
    console.log("✅ Bảng 'dealer_reports' đã sẵn sàng.")

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_sources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_key VARCHAR(120) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        source_type ENUM('website','database','file','api') NOT NULL DEFAULT 'database',
        source_url VARCHAR(1000) DEFAULT NULL,
        role_scope ENUM('shared','user','dealer') NOT NULL DEFAULT 'shared',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        crawl_config JSON NULL,
        last_crawled_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)
    console.log("✅ Bảng 'chatbot_sources' đã sẵn sàng.")

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        source_id INT NOT NULL,
        external_id VARCHAR(255) NOT NULL,
        title VARCHAR(1000) NOT NULL,
        source_url VARCHAR(1000) DEFAULT NULL,
        role_scope ENUM('shared','user','dealer') NOT NULL DEFAULT 'shared',
        content_hash CHAR(64) NOT NULL,
        content LONGTEXT NOT NULL,
        metadata_json LONGTEXT NULL,
        published_at DATETIME NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_chatbot_document (source_id, external_id),
        INDEX idx_chatbot_document_role (role_scope),
        INDEX idx_chatbot_document_source (source_id),
        FOREIGN KEY (source_id) REFERENCES chatbot_sources(id) ON DELETE CASCADE
      )
    `)
    console.log("✅ Bảng 'chatbot_documents' đã sẵn sàng.")

    await pool.query(`
      CREATE TABLE IF NOT EXISTS chatbot_chunks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_id INT NOT NULL,
        chunk_index INT NOT NULL,
        role_scope ENUM('shared','user','dealer') NOT NULL DEFAULT 'shared',
        content LONGTEXT NOT NULL,
        embedding_json LONGTEXT NULL,
        token_count INT NOT NULL DEFAULT 0,
        metadata_json LONGTEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_chatbot_chunk (document_id, chunk_index),
        INDEX idx_chatbot_chunk_role (role_scope),
        INDEX idx_chatbot_chunk_document (document_id),
        FOREIGN KEY (document_id) REFERENCES chatbot_documents(id) ON DELETE CASCADE
      )
    `)
    console.log("✅ Bảng 'chatbot_chunks' đã sẵn sàng.")

    console.log("✅ Tất cả bảng & dữ liệu mẫu đã được khởi tạo thành công.")
    return pool
  } catch (error) {
    console.error("❌ Lỗi khi khởi tạo MySQL:", error)
    process.exit(1)
  }
}

// Gọi hàm khởi tạo
const pool = await initDB()

export default pool;
