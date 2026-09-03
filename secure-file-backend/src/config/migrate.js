import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { query, getPool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

export async function ensureMigrationsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getAppliedMigrations() {
  const { rows } = await query(`SELECT name FROM _migrations ORDER BY id`);
  return rows.map((r) => r.name);
}

export async function getPendingMigrations() {
  await ensureMigrationsTable();
  const applied = await getAppliedMigrations();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return files.filter((f) => !applied.includes(f));
}

export async function runMigration(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, "utf8");

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(sql);
    await client.query(`INSERT INTO _migrations (name) VALUES ($1)`, [filename]);
    await client.query("COMMIT");
    console.log(`✓ Applied migration: ${filename}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`✗ Failed migration ${filename}: ${err.message}`);
    throw err;
  } finally {
    client.release();
  }
}

export async function runAllPending() {
  const pending = await getPendingMigrations();
  if (pending.length === 0) {
    console.log("No pending migrations");
    return 0;
  }

  console.log(`Running ${pending.length} pending migration(s)...`);
  for (const migration of pending) {
    await runMigration(migration);
  }
  console.log("All migrations applied");
  return pending.length;
}

export async function migrateStatus() {
  const applied = await getAppliedMigrations();
  const pending = await getPendingMigrations();
  return { applied, pending };
}