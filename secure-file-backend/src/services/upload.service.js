import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { query } from "../config/db.js";
import { config } from "../config/env.js";
import { sha256 } from "../utils/crypto.js";
import { securityLog } from "./log.service.js";

const UPLOAD_DIR = config.uploadDir;
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const SESSION_EXPIRY_HOURS = 24;

export async function createUploadSession({
  userId,
  originalName,
  mimeType,
  totalSize,
  chunkSize = DEFAULT_CHUNK_SIZE
}) {
  if (totalSize > config.maxUploadBytes) {
    throw new Error(`File size exceeds maximum allowed (${config.maxUploadBytes} bytes)`);
  }

  const totalChunks = Math.ceil(totalSize / chunkSize);
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

  await query(
    `INSERT INTO upload_sessions
      (id, user_id, original_name, mime_type, total_size, chunk_size, total_chunks, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [sessionId, userId, originalName, mimeType, totalSize, chunkSize, totalChunks, expiresAt]
  );

  await securityLog({
    userId,
    action: "UPLOAD_SESSION_CREATED",
    resourceType: "upload_session",
    resourceId: sessionId,
    req: null,
    details: { originalName, totalSize, totalChunks }
  });

  return { sessionId, chunkSize, totalChunks, expiresAt };
}

export async function getUploadSession(sessionId, userId) {
  const { rows } = await query(
    `SELECT * FROM upload_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId]
  );
  return rows[0] || null;
}

export async function uploadChunk({
  sessionId,
  userId,
  chunkIndex,
  chunkData
}) {
  const session = await getUploadSession(sessionId, userId);
  if (!session) {
    throw new Error("Upload session not found");
  }

  if (session.status !== "pending" && session.status !== "uploading") {
    throw new Error(`Session status is ${session.status}, cannot upload`);
  }

  if (new Date(session.expires_at) < new Date()) {
    await query(`UPDATE upload_sessions SET status = 'expired' WHERE id = $1`, [sessionId]);
    throw new Error("Upload session has expired");
  }

  if (chunkIndex < 0 || chunkIndex >= session.total_chunks) {
    throw new Error(`Invalid chunk index: ${chunkIndex}`);
  }

  const uploadedChunks = session.uploaded_chunks || [];
  if (uploadedChunks.includes(chunkIndex)) {
    return { chunkIndex, status: "already_uploaded" };
  }

  const chunkDir = path.join(UPLOAD_DIR, ".chunks", sessionId);
  await fs.mkdir(chunkDir, { recursive: true });
  const chunkPath = path.join(chunkDir, `${chunkIndex}.part`);
  await fs.writeFile(chunkPath, chunkData);

  uploadedChunks.push(chunkIndex);
  const newStatus = uploadedChunks.length === session.total_chunks ? "completed" : "uploading";

  await query(
    `UPDATE upload_sessions
     SET uploaded_chunks = $1, status = $2, updated_at = NOW()
     WHERE id = $3`,
    [uploadedChunks, newStatus, sessionId]
  );

  return { chunkIndex, status: "uploaded", progress: uploadedChunks.length / session.total_chunks };
}

export async function completeUpload(sessionId, userId, expectedSha256) {
  const session = await getUploadSession(sessionId, userId);
  if (!session) {
    throw new Error("Upload session not found");
  }

  if (session.status !== "completed") {
    throw new Error(`Upload not complete: ${session.uploaded_chunks?.length || 0}/${session.total_chunks} chunks`);
  }

  const chunkDir = path.join(UPLOAD_DIR, ".chunks", sessionId);
  const fileId = crypto.randomUUID();
  const storedName = `${fileId}.enc`;
  const finalPath = path.join(UPLOAD_DIR, storedName);

  // Combine chunks and calculate hash
  let hasher = crypto.createHash("sha256");
  const writeStream = fs.createWriteStream(finalPath);

  for (let i = 0; i < session.total_chunks; i++) {
    const chunkPath = path.join(chunkDir, `${i}.part`);
    const chunkData = await fs.readFile(chunkPath);
    hasher.update(chunkData);
    writeStream.write(chunkData);
  }

  writeStream.end();
  await new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  const actualSha256 = hasher.digest("hex");

  if (expectedSha256 && actualSha256 !== expectedSha256) {
    await fs.unlink(finalPath).catch(() => {});
    throw new Error("SHA256 mismatch: file integrity verification failed");
  }

  // Encrypt the combined file
  const { encryptBuffer } = await import("./security.service.js");
  const encrypted = await encryptBuffer(await fs.readFile(finalPath));
  await fs.writeFile(finalPath, encrypted);
  await fs.unlink(finalPath + ".tmp").catch(() => {});

  // Clean up chunks
  await fs.rm(chunkDir, { recursive: true, force: true });

  // Create file record
  await query(
    `INSERT INTO files (id, owner_id, original_name, stored_name, mime_type, size_bytes, sha256)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [fileId, session.user_id, session.original_name, storedName, session.mime_type, session.total_size, actualSha256]
  );

  // Update session with file_id and sha256
  await query(
    `UPDATE upload_sessions SET file_id = $1, sha256 = $2, status = 'completed' WHERE id = $3`,
    [fileId, actualSha256, sessionId]
  );

  await securityLog({
    userId: session.user_id,
    action: "FILE_UPLOAD_COMPLETED",
    resourceType: "file",
    resourceId: fileId,
    req: null,
    details: { originalName: session.original_name, size: session.total_size, sha256: actualSha256 }
  });

  return { fileId, sha256: actualSha256 };
}

export async function deleteUploadSession(sessionId, userId) {
  const session = await getUploadSession(sessionId, userId);
  if (!session) return false;

  const chunkDir = path.join(UPLOAD_DIR, ".chunks", sessionId);
  await fs.rm(chunkDir, { recursive: true, force: true }).catch(() => {});

  await query(`DELETE FROM upload_sessions WHERE id = $1`, [sessionId]);
  return true;
}

export async function cleanupExpiredSessions() {
  const { rows } = await query(
    `SELECT id FROM upload_sessions WHERE expires_at < NOW() AND status IN ('pending', 'uploading')`
  );

  for (const session of rows) {
    const chunkDir = path.join(UPLOAD_DIR, ".chunks", session.id);
    await fs.rm(chunkDir, { recursive: true, force: true }).catch(() => {});
    await query(`UPDATE upload_sessions SET status = 'expired' WHERE id = $1`, [session.id]);
  }

  return rows.length;
}