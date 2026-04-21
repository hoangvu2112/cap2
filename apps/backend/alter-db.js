import pool from "./db.js";

async function alterDb() {
  try {
    console.log("Altering the enum...");
    await pool.query("ALTER TABLE dealer_upgrade_requests MODIFY COLUMN status ENUM('pending_payment','pending_review','approved','rejected','cancelled','expired') NOT NULL DEFAULT 'pending_payment'");
    
    console.log("Adding warning_sent column...");
    await pool.query("ALTER TABLE dealer_upgrade_requests ADD COLUMN warning_sent BOOLEAN DEFAULT FALSE");
    
    console.log("Database updated successfully");
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log("Column warning_sent already exists, that's fine.");
      process.exit(0);
    }
    console.error("Error altering DB:", error);
    process.exit(1);
  }
}

alterDb();
