// ============================================================================
// Local, zero-install development runner.
//
// Boots the full backend against an IN-MEMORY PostgreSQL (pg-mem) so you can
// develop/demo without installing a database. All data is lost on restart.
//
//   npm run dev:local
//
// For a persistent local database (recommended), use a real PostgreSQL:
//   see README.md / database1/docs/SETUP.md
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newDb } from "pg-mem";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../src/config/schema.sql");

const db = newDb({ autoCreateForeignKeyIndices: true });
db.public.none(fs.readFileSync(schemaPath, "utf8"));
const { Pool } = db.adapters.createPg();

globalThis[Symbol.for("sfs.test.pool")] = new Pool();

console.warn(
  "[dev:local] Using an IN-MEMORY PostgreSQL (pg-mem). Data will be lost when the process stops."
);

await import("../server.js");