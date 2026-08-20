import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { getPool, query } from "../config/db.js";
import { generateShareToken } from "../services/security.service.js";
import { getFileById, readVerifiedFile } from "../services/file.service.js";
import { securityLog } from "../services/log.service.js";
import { hashToken } from "../utils/crypto.js";
import { serializeShare } from "../utils/serialize.js";
import { fail, ok } from "../utils/http.js";

const DURATION_MS = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000
};

function resolveExpiration(expiration) {
  if (!expiration) return null;
  if (typeof expiration === "string" && DURATION_MS[expiration]) {
    return new Date(Date.now() + DURATION_MS[expiration]);
  }
  const date = new Date(expiration);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

export async function createShare(req, res) {
  const { fileId, password, expiration, maxDownloads } = req.body;
  const file = await getFileById(fileId);

  if (!file) return fail(res, 404, "File not found");
  if (file.owner_id !== req.user.id) return fail(res, 403, "Forbidden");

  const token = await generateShareToken();
  const tokenHash = hashToken(token);
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  const expiresAt = resolveExpiration(expiration);
  const maxDownloadsValue = maxDownloads === "unlimited" ? null : maxDownloads ?? null;

  if (expiresAt === undefined) return fail(res, 400, "Invalid expiration value");
  if (expiresAt && expiresAt <= new Date()) {
    return fail(res, 400, "Expiration must be in the future");
  }
  if (
    maxDownloadsValue !== null &&
    (!Number.isInteger(maxDownloadsValue) || maxDownloadsValue < 1)
  ) {
    return fail(res, 400, "maxDownloads must be at least 1");
  }

  const id = crypto.randomUUID();
  const { rows } = await query(
    `INSERT INTO shares
     (id,file_id,token_hash,password_hash,expires_at,max_downloads,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     RETURNING id,file_id,expires_at,max_downloads,download_count,revoked_at,created_at,password_hash`,
    [id, file.id, tokenHash, passwordHash, expiresAt, maxDownloadsValue, req.user.id]
  );

  await securityLog({
    userId: req.user.id, action: "SHARE_CREATED",
    resourceType: "share", resourceId: id, req
  });

  return ok(res, { share: serializeShare({ ...rows[0], token }) }, 201);
}

export async function listShares(req, res) {
  const fileId = req.query.fileId || null;
  const values = [req.user.id];
  let filter = "s.created_by=$1";
  if (fileId) {
    filter += " AND s.file_id=$2";
    values.push(fileId);
  }
  const { rows } = await query(
    `SELECT s.id, s.file_id, s.expires_at, s.max_downloads, s.download_count,
            s.revoked_at, s.created_at, f.original_name
     FROM shares s JOIN files f ON f.id = s.file_id
     WHERE ${filter}
     ORDER BY s.created_at DESC`,
    values
  );
  return ok(res, { shares: rows.map(serializeShare) });
}

export async function accessShare(req, res) {
  const tokenHash = hashToken(req.params.token);
  const { rows } = await query(
    `SELECT s.*, f.owner_id, f.original_name, f.mime_type, f.size_bytes, f.sha256,
            f.stored_name
     FROM shares s JOIN files f ON f.id=s.file_id
     WHERE s.token_hash=$1`,
    [tokenHash]
  );

  const share = rows[0];
  if (!share) return fail(res, 404, "Share not found");
  if (share.revoked_at) {
    await securityLog({ action: "REVOKED_SHARE_ACCESS", resourceType: "share", resourceId: share.id, success: false, req });
    return fail(res, 403, "Share link has been revoked");
  }
  if (share.expires_at && new Date(share.expires_at) <= new Date()) {
    await securityLog({ action: "EXPIRED_SHARE_ACCESS", resourceType: "share", resourceId: share.id, success: false, req });
    return fail(res, 403, "Share link has expired");
  }

  // Metadata (name/size/expiry/limits/passwordRequired) is visible to anyone
  // with the link. The password only protects the file bytes: it is verified
  // on download, or here when a password was supplied for pre-validation.
  const suppliedPassword = typeof req.query.password === "string" ? req.query.password : "";
  if (share.password_hash && suppliedPassword) {
    const valid = await bcrypt.compare(suppliedPassword, share.password_hash);
    if (!valid) {
      await securityLog({
        action: "FAILED_SHARE_PASSWORD", resourceType: "share",
        resourceId: share.id, success: false, req
      });
      return fail(res, 401, "Incorrect share password");
    }
  }

  // GET /shares/:token returns metadata, not the file.
  return ok(res, { share: serializeShare(share) });
}

async function readShareRow(client, token) {
  const { rows } = await client.query(
    `SELECT s.*, f.owner_id, f.original_name, f.mime_type, f.size_bytes, f.sha256, f.stored_name
     FROM shares s JOIN files f ON f.id=s.file_id
     WHERE s.token_hash=$1 FOR UPDATE`,
    [hashToken(token)]
  );
  return rows[0];
}

export async function downloadShare(req, res) {
  const password = typeof req.body?.password === "string" ? req.body.password
    : typeof req.query?.password === "string" ? req.query.password : "";

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const share = await readShareRow(client, req.params.token);

    const deny = async (status, message, action) => {
      await client.query("ROLLBACK");
      await securityLog({ action, resourceType: "share", resourceId: share?.id || null, success: false, req });
      return fail(res, status, message);
    };

    if (!share) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Share not found");
    }
    if (share.revoked_at) return deny(403, "Share link has been revoked", "REVOKED_SHARE_ACCESS");
    if (share.expires_at && new Date(share.expires_at) <= new Date()) {
      return deny(403, "Share link has expired", "EXPIRED_SHARE_ACCESS");
    }
    if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
      return deny(403, "Download limit reached", "SHARE_DOWNLOAD_LIMIT");
    }

    if (share.password_hash) {
      const valid = await bcrypt.compare(password, share.password_hash);
      if (!valid) return deny(401, "Incorrect share password", "FAILED_SHARE_PASSWORD");
    }

    await client.query(
      `UPDATE shares SET download_count=download_count+1 WHERE id=$1`,
      [share.id]
    );
    await client.query("COMMIT");

    const data = await readVerifiedFile(share);

    await securityLog({ action: "SHARE_DOWNLOAD", resourceType: "share", resourceId: share.id, req });
    res.setHeader("Content-Type", share.mime_type);
    res.setHeader("Content-Length", data.length);
    res.setHeader("Content-Disposition", `attachment; filename="${share.original_name.replace(/"/g, "")}"`);
    return res.send(data);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function revokeShare(req, res) {
  const { rows } = await query(
    `UPDATE shares SET revoked_at=NOW()
     WHERE id=$1 AND created_by=$2
     RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return fail(res, 403, "Forbidden");

  await securityLog({
    userId: req.user.id, action: "SHARE_REVOKED",
    resourceType: "share", resourceId: req.params.id, req
  });
  return ok(res, { message: "Share revoked" });
}

export async function deleteShare(req, res) {
  const { rows } = await query(
    `DELETE FROM shares WHERE id=$1 AND created_by=$2 RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return fail(res, 403, "Forbidden");
  return ok(res, { message: "Share deleted" });
}