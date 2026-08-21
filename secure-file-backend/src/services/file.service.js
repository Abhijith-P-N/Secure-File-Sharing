import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { query } from "../config/db.js";
import { config } from "../config/env.js";
import {
  encryptBuffer, decryptBuffer, hashSha256, verifyIntegrity
} from "./security.service.js";

function storedPath(storedName) {
  const resolved = path.resolve(config.uploadDir, storedName);
  if (!resolved.startsWith(config.uploadDir + path.sep)) {
    throw new Error("Unsafe storage path");
  }
  return resolved;
}

export async function saveEncryptedFile({ ownerId, file }) {
  await fs.mkdir(config.uploadDir, { recursive: true });

  const cleanName = file.originalname;
  const id = crypto.randomUUID();
  const storedName = `${id}.bin`;
  const plainHash = await hashSha256(file.buffer);
  const encrypted = await encryptBuffer(file.buffer);

  await fs.writeFile(storedPath(storedName), encrypted, { flag: "wx", mode: 0o600 });

  try {
    const { rows } = await query(
      `INSERT INTO files
       (id, owner_id, original_name, stored_name, mime_type, size_bytes, sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, owner_id, original_name, mime_type, size_bytes, sha256, created_at`,
      [id, ownerId, cleanName, storedName, file.mimetype, file.size, plainHash]
    );
    return rows[0];
  } catch (e) {
    await fs.rm(storedPath(storedName), { force: true });
    throw e;
  }
}

export async function getOwnedFile(id, userId) {
  const { rows } = await query(
    `SELECT id, owner_id, original_name, stored_name, mime_type, size_bytes, sha256, created_at
     FROM files WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return rows[0] || null;
}

export async function getFileById(id) {
  const { rows } = await query(
    `SELECT id, owner_id, original_name, stored_name, mime_type, size_bytes, sha256, created_at
     FROM files WHERE id=$1 AND deleted_at IS NULL`,
    [id]
  );
  return rows[0] || null;
}

export async function readVerifiedFile(file) {
  const encrypted = await fs.readFile(storedPath(file.stored_name));
  const plain = await decryptBuffer(encrypted);
  const valid = await verifyIntegrity(plain, file.sha256);

  if (!valid) throw new Error("File integrity verification failed");
  return plain;
}

export async function deleteOwnedFile(id, userId) {
  const file = await getOwnedFile(id, userId);
  if (!file) return null;

  await query(
    `UPDATE files SET deleted_at = NOW() WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL`,
    [id, userId]
  );
  return file;
}
