import pg from "pg";
import { config } from "./env.js";

const { Pool } = pg;

const injectedPoolSymbol = Symbol.for("sfs.test.pool");

let realPool = null;

export function getPool() {
  const injected = globalThis[injectedPoolSymbol];
  if (injected) return injected;
  if (!realPool) {
    realPool = new Pool({
      connectionString: config.databaseUrl || "postgresql://localhost:5432/secure_files"
    });
    realPool.on("error", (err) => {
      console.error("Unexpected PostgreSQL pool error:", err.message);
    });
  }
  return realPool;
}

export const pool = getPool();

export async function query(text, params) {
  return getPool().query(text, params);
}