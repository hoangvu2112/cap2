import pool from './db.js';

async function inspect() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM users");
    console.log("COLUMNS:", JSON.stringify(cols, null, 2));
    
    const [rows] = await pool.query("SELECT email FROM users WHERE email = 'vitran24@gmail.com'");
    console.log("EXISTING USER:", rows);
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    process.exit(0);
  }
}

inspect();
