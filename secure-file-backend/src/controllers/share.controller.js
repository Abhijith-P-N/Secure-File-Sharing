import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { query } from "../config/db.js";
import { generateShareToken } from "../services/security.service.js";
import { getFileById, readVerifiedFile } from "../services/file.service.js";
import { securityLog } from "../services/log.service.js";
import { hashToken } from "../utils/crypto.js";
import { fail, ok } from "../utils/http.js";

export async function createShare(req, res) {
  const { fileId, password, expiration, maxDownloads } = req.body;
  const file = await getFileById(fileId);

  if (!file) return fail(res, 404, "File not found");
  if (file.owner_id !== req.user.id) return fail(res, 403, "Forbidden");

  const token = await generateShareToken();
  const tokenHash = hashToken(token);
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  const expiresAt = expiration ? new Date(expiration) : null;

  if (expiresAt && expiresAt <= new Date()) {
    return fail(res, 400, "Expiration must be in the future");
  }
  if (maxDownloads !== undefined && maxDownloads < 1) {
    return fail(res, 400, "maxDownloads must be at least 1");
  }

  const id = crypto.randomUUID();
  const { rows } = await query(
    `INSERT INTO shares
     (id,file_id,token_hash,password_hash,expires_at,max_downloads,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7)
     RETURNING id,file_id,expires_at,max_downloads,download_count,revoked_at,created_at`,
    [id, file.id, tokenHash, passwordHash, expiresAt, maxDownloads ?? null, req.user.id]
  );

  await securityLog({
    userId: req.user.id, action: "SHARE_CREATED",
    resourceType: "share", resourceId: id, req
  });

  return ok(res, { share: { ...rows[0], token } }, 201);
}

export async function accessShare(req, res) {
  const tokenHash = hashToken(req.params.token);
  const password = typeof req.query.password === "string" ? req.query.password : "";
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
  if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
    return fail(res, 403, "Download limit reached");
  }
  if (share.password_hash) {
    const valid = await bcrypt.compare(password, share.password_hash);
    if (!valid) {
      await securityLog({
        action: "FAILED_SHARE_PASSWORD", resourceType: "share",
        resourceId: share.id, success: false, req
      });
      return fail(res, 401, "Incorrect share password");
    }
  }

  // GET /shares/:token returns metadata, not the file.
  return ok(res, {
    share: {
      id: share.id,
      fileId: share.file_id,
      originalName: share.original_name,
      mimeType: share.mime_type,
      sizeBytes: share.size_bytes,
      expiresAt: share.expires_at,
      maxDownloads: share.max_downloads,
      downloadCount: share.download_count,
      passwordRequired: Boolean(share.password_hash)
    }
  });
}

export async function downloadShare(req, res) {
  const tokenHash = hashToken(req.params.token);
  const password = req.query.password || "";

  const client = await (await import("../config/db.js")).pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT s.*, f.owner_id, f.original_name, f.mime_type, f.size_bytes, f.sha256, f.stored_name
       FROM shares s JOIN files f ON f.id=s.file_id
       WHERE s.token_hash=$1 FOR UPDATE`,
      [tokenHash]
    );
    const share = rows[0];

    if (!share) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Share not found");
    }
    if (share.revoked_at) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Share link has been revoked");
    }
    if (share.expires_at && new Date(share.expires_at) <= new Date()) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Share link has expired");
    }
    if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Download limit reached");
    }

    if (share.password_hash) {
      const valid = await bcrypt.compare(password, share.password_hash);
      if (!valid) {
        await client.query("ROLLBACK");
        await securityLog({ action: "FAILED_SHARE_PASSWORD", resourceType: "share", resourceId: share.id, success: false, req });
        return fail(res, 401, "Incorrect share password");
      }
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
    `UPDATE shares s SET revoked_at=NOW()
     WHERE s.id=$1 AND s.created_by=$2
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
