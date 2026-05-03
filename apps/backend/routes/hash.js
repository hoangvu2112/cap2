import bcrypt from "bcryptjs";

async function createHashes() {
    const adminHash = await bcrypt.hash("admin123", 10);
    const userHash = await bcrypt.hash("user123", 10);

    console.log("Admin hash:", adminHash);
    console.log("User hash:", userHash);
}

createHashes();
