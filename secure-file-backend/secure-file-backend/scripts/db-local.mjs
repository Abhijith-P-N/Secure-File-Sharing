// ============================================================================
// Local development database runner.
//
// Starts a REAL PostgreSQL (bundled via the `embedded-postgres` devDependency)
// without requiring Docker or a system install / root privileges. Data is
// persisted in ./.localdb/data.
//
//   npm run db:local           # start the database (foreground, Ctrl+C to stop)
//   npm run seed:admin         # (in another terminal) create the admin user
//
// The backend then connects via DATABASE_URL (defaults below):
//   postgresql://app_user:app_password@127.0.0.1:5432/secure_files
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PORT = Number(process.env.PGPORT || 5432);
const USER = process.env.PGUSER || "app_user";
const PASSWORD = process.env.PGPASSWORD || "app_password";
const DATABASE = process.env.PGDATABASE || "secure_files";
const DATA_DIR = path.resolve(process.env.LOCALDB_DIR || path.join(ROOT, ".localdb/data"));
const SCHEMA = path.join(ROOT, "src/config/schema.sql");

const db = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  onLog: (line) => console.log(`[pg] ${typeof line === "string" ? line.trim() : ""}`),
  onError: (err) => console.error("[pg error]", String(err))
});

async function applySchema() {
  const client = new pg.Client({
    connectionString: `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`
  });
  await client.connect();
  try {
    const schema = fs.readFileSync(SCHEMA, "utf8");
    await client.query(schema);
    console.log("[db-local] schema applied from src/config/schema.sql");
  } finally {
    await client.end();
  }
}

function clusterAlreadyInitialised() {
  return fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
}

// initdb refuses to run into a non-empty directory, so only run it when no
// cluster exists yet. An existing cluster is reused (data persists).
let skippedInit = false;
fs.mkdirSync(DATA_DIR, { recursive: true });
if (clusterAlreadyInitialised()) {
  skippedInit = true;
  console.log(`[db-local] reusing existing cluster at ${DATA_DIR}`);
} else {
  const leftovers = fs
    .readdirSync(DATA_DIR)
    .filter((name) => !name.startsWith(".") && name !== "lost+found");
  if (leftovers.length > 0) {
    console.error(
      `[db-local] ${DATA_DIR} exists but is NOT a valid PostgreSQL cluster. ` +
        "Move it away or point LOCALDB_DIR at a fresh directory."
    );
    process.exit(1);
  }
  await db.initialise();
  console.log(`[db-local] initialised cluster at ${DATA_DIR}`);
}

await db.start();
console.log(`[db-local] PostgreSQL listening on 127.0.0.1:${PORT}`);

try {
  await db.createDatabase(DATABASE);
  console.log(`[db-local] database "${DATABASE}" ready`);
} catch (err) {
  console.log(`[db-local] database "${DATABASE}" already exists`);
}

await applySchema();

const url = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DATABASE}`;
console.log("");
console.log(`  ✅ Database is up and schema is applied.`);
console.log(`     DATABASE_URL=${url}`);
console.log("");
console.log(`  ▶ In another terminal, start the backend:`);
console.log(`     cd secure-file-backend && npm run dev`);
console.log("");
console.log(`  ▶ Seed the admin account (optional):`);
console.log(`     cd secure-file-backend && npm run seed:admin`);
console.log("");
console.log("  Press Ctrl+C here to stop the database.");

const stop = async () => {
  console.log("[db-local] stopping database...");
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// Keep this process alive so the database stays up (Ctrl+C stops it cleanly).
setInterval(() => {}, 1 << 30);