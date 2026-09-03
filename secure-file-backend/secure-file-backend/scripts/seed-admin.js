import "dotenv/config";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { query } from "../src/config/db.js";

const email = (process.env.ADMIN_EMAIL || "admin@secure-share.local").toLowerCase();
const password = process.env.ADMIN_PASSWORD || "ChangeMe_Admin_2026";
const id = crypto.randomUUID();

if (!/^.{8,128}$/.test(password)) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await query(`SELECT id, role FROM users WHERE email = $1`, [email]);

  if (existing.rows.length) {
    await query(`UPDATE users SET role = 'admin' WHERE id = $1`, [existing.rows[0].id]);
    console.log(`Admin role granted to existing user: ${email}`);
  } else {
    await query(
      `INSERT INTO users (id, email, password_hash, name, role)
       VALUES ($1, $2, $3, $4, 'admin')`,
      [id, email, passwordHash, "Administrator"]
    );
    console.log(`Admin user created: ${email}`);
  }

  await query(`INSERT INTO access_logs (action, success, details)
               VALUES ('ADMIN_SEEDED', true, $1)`,
    [JSON.stringify({ email })]);
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed admin:", err.message);
  process.exit(1);
});