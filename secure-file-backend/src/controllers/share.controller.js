import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { getPool, query } from "../config/db.js";
import { generateShareToken } from "../services/security.service.js";
import { getFileById, readVerifiedFile } from "../services/file.service.js";
import { securityLog } from "../services/log.service.js";
import { hashToken } from "../utils/crypto.js";
import { serializeShare } from "../utils/serialize.js";
import { fail, ok } from "../utils/http.js";
import { sendAccessCode } from "../services/email.service.js";

const CODE_LENGTH = 6;
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

function generateAccessCode() {
  return crypto.randomInt(100000, 999999).toString();
}

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
  const { fileId, password, expiration, maxDownloads, allowedEmail } = req.body;
  const file = await getFileById(fileId);

  if (!file) return fail(res, 404, "File not found");
  if (file.owner_id !== req.user.id) return fail(res, 403, "Forbidden");

  const token = await generateShareToken();
  const tokenHash = hashToken(token);
  const passwordHash = password ? await bcrypt.hash(password, 12) : null;
  const expiresAt = resolveExpiration(expiration);
  const maxDownloadsValue = maxDownloads === "unlimited" ? null : maxDownloads ?? null;
  let allowedEmailValue = null;
  if (allowedEmail?.trim()) {
    const emails = [...new Set(
      allowedEmail.split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
    )];
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = emails.find(e => !emailRe.test(e));
    if (invalid) return fail(res, 400, `Invalid email address: ${invalid}`);
    if (emails.length > 0) allowedEmailValue = emails.join(",");
  }

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
     (id,file_id,token_hash,password_hash,allowed_email,expires_at,max_downloads,created_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id,file_id,expires_at,max_downloads,download_count,revoked_at,created_at,password_hash,allowed_email`,
    [id, file.id, tokenHash, passwordHash, allowedEmailValue, expiresAt, maxDownloadsValue, req.user.id]
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
     WHERE ${filter} AND s.deleted_at IS NULL
     ORDER BY s.created_at DESC`,
    values
  );
  return ok(res, { shares: rows.map(serializeShare) });
}

export async function accessShare(req, res) {
  const share = await findShare(req.params.token);
  if (!share) return fail(res, 404, "Share not found");

  // Auto-revoke if download limit reached
  if (share.max_downloads !== null && share.download_count >= share.max_downloads && !share.revoked_at) {
    await query(`UPDATE shares SET revoked_at=NOW() WHERE id=$1`, [share.id]);
    share.revoked_at = new Date();
  }

  if (share.revoked_at) {
    await securityLog({ action: "REVOKED_SHARE_ACCESS", resourceType: "share", resourceId: share.id, success: false, req });
    return fail(res, 410, "Share link has been revoked");
  }
  if (share.expires_at && new Date(share.expires_at) <= new Date()) {
    await securityLog({ action: "EXPIRED_SHARE_ACCESS", resourceType: "share", resourceId: share.id, success: false, req });
    return fail(res, 410, "Share link has expired");
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

async function findShare(idOrToken) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrToken);
  if (isUuid) {
    const { rows } = await query(
      `SELECT s.*, f.owner_id, f.original_name, f.mime_type, f.size_bytes, f.sha256, f.stored_name
       FROM shares s JOIN files f ON f.id=s.file_id
       WHERE s.id=$1 AND s.deleted_at IS NULL`,
      [idOrToken]
    );
    return rows[0];
  }
  const { rows } = await query(
    `SELECT s.*, f.owner_id, f.original_name, f.mime_type, f.size_bytes, f.sha256, f.stored_name
     FROM shares s JOIN files f ON f.id=s.file_id
     WHERE s.token_hash=$1 AND s.deleted_at IS NULL`,
    [hashToken(idOrToken)]
  );
  return rows[0];
}

async function readShareRow(client, idOrToken) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrToken);
  if (isUuid) {
    const { rows } = await client.query(
      `SELECT s.*, f.owner_id, f.original_name, f.mime_type, f.size_bytes, f.sha256, f.stored_name
       FROM shares s JOIN files f ON f.id=s.file_id
       WHERE s.id=$1 AND s.deleted_at IS NULL FOR UPDATE`,
      [idOrToken]
    );
    return rows[0];
  }
  const { rows } = await client.query(
    `SELECT s.*, f.owner_id, f.original_name, f.mime_type, f.size_bytes, f.sha256, f.stored_name
     FROM shares s JOIN files f ON f.id=s.file_id
     WHERE s.token_hash=$1 AND s.deleted_at IS NULL FOR UPDATE`,
    [hashToken(idOrToken)]
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

    const deny = async (status, message, action, extra = {}) => {
      await client.query("ROLLBACK");
      await securityLog({ action, resourceType: "share", resourceId: share?.id || null, success: false, req });
      return fail(res, status, message, extra);
    };

    if (!share) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Share not found");
    }
    if (share.revoked_at) return deny(410, "Share link has been revoked", "REVOKED_SHARE_ACCESS");
    if (share.expires_at && new Date(share.expires_at) <= new Date()) {
      return deny(410, "Share link has expired", "EXPIRED_SHARE_ACCESS");
    }
    if (share.max_downloads !== null && share.download_count >= share.max_downloads) {
      return deny(410, "Download limit reached — this file has already been downloaded the maximum number of times", "SHARE_DOWNLOAD_LIMIT", { code: "SHARE_DOWNLOAD_LIMIT" });
    }

    if (share.password_hash) {
      const valid = await bcrypt.compare(password, share.password_hash);
      if (!valid) return deny(401, "Incorrect share password", "FAILED_SHARE_PASSWORD");
    }

    // Email-verified share: require valid download token
    if (share.allowed_email) {
      const downloadToken = req.body?.downloadToken || req.query?.downloadToken;
      if (!downloadToken) return deny(403, "Email verification required", "EMAIL_VERIFICATION_REQUIRED");

      const tokenHash = hashToken(downloadToken);
      const { rows: tokenRows } = await client.query(
        `SELECT id FROM share_access_codes
         WHERE share_id = $1 AND code = $2 AND used_at IS NULL AND expires_at > NOW()`,
        [share.id, tokenHash]
      );
      if (!tokenRows[0]) {
        return deny(403, "Invalid or expired verification token. Please verify your email again.", "INVALID_DOWNLOAD_TOKEN");
      }
      // Mark download token as used
      await client.query(`UPDATE share_access_codes SET used_at = NOW() WHERE id = $1`, [tokenRows[0].id]);
    }

    // Increment download count and auto-revoke if limit reached
    const newCount = share.download_count + 1;
    const shouldRevoke = share.max_downloads !== null && newCount >= share.max_downloads;

    if (shouldRevoke) {
      await client.query(
        `UPDATE shares SET download_count=$1, revoked_at=NOW() WHERE id=$2`,
        [newCount, share.id]
      );
    } else {
      await client.query(
        `UPDATE shares SET download_count=$1 WHERE id=$2`,
        [newCount, share.id]
      );
    }
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
    `UPDATE shares SET deleted_at = NOW() WHERE id=$1 AND created_by=$2 AND deleted_at IS NULL RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return fail(res, 403, "Forbidden");
  return ok(res, { message: "Share deleted" });
}

export async function requestAccess(req, res) {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail(res, 400, "Valid email address is required");
  }

  const share = await findShare(req.params.token);
  if (!share) return fail(res, 404, "Share not found");
  if (share.revoked_at) return fail(res, 410, "Share link has been revoked");
  if (share.expires_at && new Date(share.expires_at) <= new Date()) {
    return fail(res, 410, "Share link has expired");
  }
  if (share.allowed_email) {
    const allowedList = share.allowed_email.split(",").map(e => e.trim().toLowerCase());
    if (!allowedList.includes(email.toLowerCase())) {
      await securityLog({
        action: "EMAIL_MISMATCH", resourceType: "share",
        resourceId: share.id, success: false, req
      });
      return fail(res, 403, "This email is not authorized to access this file");
    }
  }

  // Invalidate any previous unused codes for this share+email
  await query(
    `UPDATE share_access_codes SET used_at = NOW()
     WHERE share_id = $1 AND email = $2 AND used_at IS NULL`,
    [share.id, email.toLowerCase()]
  );

  const code = generateAccessCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);

  await query(
    `INSERT INTO share_access_codes (share_id, email, code, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [share.id, email.toLowerCase(), codeHash, expiresAt]
  );

  await sendAccessCode(email.toLowerCase(), code, share.original_name);

  return ok(res, { message: "Access code sent to your email", email: email.toLowerCase() });
}

export async function verifyAccess(req, res) {
  const { email, code } = req.body;

  if (!email || !code) {
    return fail(res, 400, "Email and code are required");
  }

  const share = await findShare(req.params.token);
  if (!share) return fail(res, 404, "Share not found");
  if (share.revoked_at) return fail(res, 410, "Share link has been revoked");
  if (share.expires_at && new Date(share.expires_at) <= new Date()) {
    return fail(res, 410, "Share link has expired");
  }

  const { rows: codeRows } = await query(
    `SELECT * FROM share_access_codes
     WHERE share_id = $1 AND email = $2 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [share.id, email.toLowerCase()]
  );
  const record = codeRows[0];
  if (!record) {
    return fail(res, 400, "No valid code found. Please request a new one.");
  }

  const valid = await bcrypt.compare(code, record.code);
  if (!valid) {
    await securityLog({
      action: "FAILED_ACCESS_CODE", resourceType: "share",
      resourceId: share.id, success: false, req
    });
    return fail(res, 401, "Incorrect code. Please try again.");
  }

  // Mark code as used
  await query(`UPDATE share_access_codes SET used_at = NOW() WHERE id = $1`, [record.id]);

  await securityLog({
    action: "EMAIL_ACCESS_VERIFIED", resourceType: "share",
    resourceId: share.id, success: true, req
  });

  // Generate a short-lived download token (valid 5 min)
  const downloadToken = crypto.randomBytes(32).toString("base64url");
  const downloadTokenHash = hashToken(downloadToken);
  const downloadExpires = new Date(Date.now() + 5 * 60 * 1000);

  await query(
    `INSERT INTO share_access_codes (share_id, email, code, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [share.id, email.toLowerCase(), downloadTokenHash, downloadExpires]
  );

  return ok(res, {
    message: "Email verified",
    downloadToken,
    expiresAt: downloadExpires.toISOString()
  });
}