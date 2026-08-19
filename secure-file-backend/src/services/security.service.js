/*
  SECURITY INTEGRATION POINT FOR ADHIL.

  Replace/adapt the four exported functions below to call Adhil's security
  module. The interface is deliberately small so the backend does not depend
  on the security implementation.

  Production note:
  - AES-256-GCM is used here as a runnable default.
  - The encryption key must come from a secret manager/environment, never DB.
  - The key is NOT returned by any API.
*/
import crypto from "node:crypto";
import { sha256, secureToken } from "../utils/crypto.js";

if (process.env.NODE_ENV === "production" && !process.env.FILE_ENCRYPTION_KEY) {
  throw new Error("FILE_ENCRYPTION_KEY is required in production");
}

const key = crypto.createHash("sha256")
  .update(process.env.FILE_ENCRYPTION_KEY || "CHANGE_ME_IN_PRODUCTION")
  .digest();

export async function hashSha256(buffer) {
  return sha256(buffer);
}

export async function verifyIntegrity(buffer, expectedHash) {
  return (await hashSha256(buffer)) === expectedHash;
}

export async function generateShareToken() {
  return secureToken();
}

export async function encryptBuffer(buffer) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Stored file format: [12-byte IV][16-byte GCM tag][ciphertext]
  return Buffer.concat([iv, tag, ciphertext]);
}

export async function decryptBuffer(encrypted) {
  if (encrypted.length < 28) throw new Error("Invalid encrypted file");
  const iv = encrypted.subarray(0, 12);
  const tag = encrypted.subarray(12, 28);
  const ciphertext = encrypted.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
