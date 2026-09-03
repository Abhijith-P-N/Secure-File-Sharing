import path from "node:path";

const isProduction = () => process.env.NODE_ENV === "production";

function secret(name, devFallback) {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (isProduction()) return null;
  return devFallback;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  isProduction: isProduction(),
  port: Number(process.env.PORT || 8000),
  jwtSecret: secret("JWT_SECRET", "development-only-secret"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",
  refreshTokenBytes: Number(process.env.REFRESH_TOKEN_BYTES || 32),
  refreshTokenExpiryMs: ms(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d"),
  encryptionKey: secret("FILE_ENCRYPTION_KEY", "CHANGE_ME_IN_PRODUCTION"),
  encryptionKeyId: process.env.FILE_ENCRYPTION_KEY_ID || "key-001",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  maxUploadBytes: Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024,
  shareTokenBytes: Number(process.env.SHARE_TOKEN_BYTES || 32),
  databaseUrl: process.env.DATABASE_URL || null
};

Object.defineProperty(config, "uploadDir", {
  enumerable: true,
  get() {
    return path.resolve(process.env.UPLOAD_DIR || "./uploads");
  }
});

export function ms(value) {
  if (!value) return 0;
  const match = /^(\d+)(ms|s|m|h|d|w)$/.exec(String(value).trim());
  if (!match) return Number(value);
  const n = Number(match[1]);
  switch (match[2]) {
    case "ms": return n;
    case "s": return n * 1000;
    case "m": return n * 60 * 1000;
    case "h": return n * 60 * 60 * 1000;
    case "d": return n * 24 * 60 * 60 * 1000;
    case "w": return n * 7 * 24 * 60 * 60 * 1000;
    default: return n;
  }
}

export function validateConfig() {
  // Production enforces strict secrets; development/test use safe dev defaults.
  if (!isProduction()) return [];

  const problems = [];
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be set and at least 32 characters in production (openssl rand -hex 64)");
  }
  if (!config.encryptionKey || config.encryptionKey.length < 32) {
    problems.push("FILE_ENCRYPTION_KEY must be set and at least 32 characters in production (openssl rand -hex 32)");
  }
  if (!process.env.CORS_ORIGIN) {
    problems.push("CORS_ORIGIN must be set in production (must match the frontend origin)");
  }
  if (!config.databaseUrl) {
    problems.push("DATABASE_URL must be set");
  }
  return problems;
}