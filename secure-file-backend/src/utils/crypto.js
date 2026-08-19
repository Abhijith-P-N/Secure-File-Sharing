import crypto from "node:crypto";

export function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export function secureToken(bytes = Number(process.env.SHARE_TOKEN_BYTES || 32)) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function safeFilename(name) {
  const base = String(name || "file")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .replace(/[\\/]/g, "_")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 180)
    .trim();

  return base || "file";
}
