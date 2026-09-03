import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { query } from "../config/db.js";
import { config } from "../config/env.js";
import { securityLog } from "../services/log.service.js";
import { sendPasswordResetCode } from "../services/email.service.js";
import { serializeUser } from "../utils/serialize.js";
import { sha256 } from "../utils/crypto.js";
import { fail, ok } from "../utils/http.js";

const REFRESH_TOKEN_STATUS_OK = "ok";
const REFRESH_TOKEN_STATUS_REVOKED = "revoked";
const REFRESH_TOKEN_STATUS_EXPIRED = "expired";

function issueAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn, issuer: "secure-file-api" }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(config.refreshTokenBytes).toString("base64url");
}

function refreshTokenExpiry() {
  return new Date(Date.now() + config.refreshTokenExpiryMs);
}

async function storeRefreshToken({ userId, token, req }) {
  const id = crypto.randomUUID();
  const tokenHash = sha256(token);
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, tokenHash, refreshTokenExpiry(), req?.ip || null, req?.get("user-agent") || null]
  );
  return tokenHash;
}

async function revokeRefreshToken(token) {
  const tokenHash = sha256(token);
  const { rows } = await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id`,
    [tokenHash]
  );
  return Boolean(rows[0]);
}

async function consumeRefreshToken(token, req) {
  const tokenHash = sha256(token);
  const { rows } = await query(
    `SELECT id, user_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1`,
    [tokenHash]
  );
  const record = rows[0];
  if (!record) return { status: "invalid" };
  if (record.revoked_at) return { status: REFRESH_TOKEN_STATUS_REVOKED, record };
  if (record.expires_at && new Date(record.expires_at) <= new Date()) {
    return { status: REFRESH_TOKEN_STATUS_EXPIRED, record };
  }

  // Rotate: revoke the presented token before returning replacements.
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`,
    [record.id]
  );

  const { rows: userRows } = await query(
    `SELECT id, email, role, name FROM users WHERE id = $1`,
    [record.user_id]
  );
  return { status: REFRESH_TOKEN_STATUS_OK, record, user: userRows[0] };
}

export async function register(req, res) {
  const { email, password, name } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();

  try {
    const { rows } = await query(
      `INSERT INTO users(id,email,password_hash,name)
       VALUES($1,$2,$3,$4)
       RETURNING id,email,role,name,created_at`,
      [id, email.toLowerCase(), passwordHash, name || null]
    );
    await securityLog({
      userId: id, action: "REGISTER",
      resourceType: "user", resourceId: id, req
    });
    return ok(res, { user: serializeUser(rows[0]) }, 201);
  } catch (e) {
    if (e.code === "23505") return fail(res, 409, "Email is already registered");
    throw e;
  }
}

export async function login(req, res) {
  const { email, password, twofaToken } = req.body;
  const { rows } = await query(
    `SELECT id,email,password_hash,role,name,totp_enabled,totp_secret FROM users WHERE email=$1`,
    [email.toLowerCase()]
  );
  const user = rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;

  await securityLog({
    userId: user?.id || null,
    action: valid ? "LOGIN_SUCCESS" : "LOGIN_FAILURE",
    success: valid,
    req,
    details: { email: email.toLowerCase() }
  });

  if (!valid) return fail(res, 401, "Invalid email or password");

  // Check if 2FA is enabled
  if (user.totp_enabled) {
    if (!twofaToken) {
      return ok(res, { requires2FA: true, userId: user.id });
    }

    const { authenticator } = await import("otplib");
    const isValid = authenticator.check(twofaToken, user.totp_secret);
    if (!isValid) {
      await securityLog({
        userId: user.id,
        action: "2FA_LOGIN_FAILURE",
        success: false,
        req,
        details: { email: email.toLowerCase() }
      });
      return fail(res, 401, "Invalid 2FA token");
    }

    await securityLog({
      userId: user.id,
      action: "2FA_LOGIN_SUCCESS",
      success: true,
      req
    });
  }

  const refreshToken = generateRefreshToken();
  await storeRefreshToken({ userId: user.id, token: refreshToken, req });

  return ok(res, {
    accessToken: issueAccessToken(user),
    refreshToken,
    expiresIn: config.jwtExpiresIn,
    user: serializeUser(user)
  });
}

export async function refresh(req, res) {
  const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (!token) return fail(res, 400, "refreshToken is required");

  const result = await consumeRefreshToken(token, req);

  if (result.status === "invalid") {
    await securityLog({ action: "REFRESH_INVALID", success: false, req });
    return fail(res, 401, "Invalid refresh token");
  }
  if (result.status === REFRESH_TOKEN_STATUS_REVOKED) {
    await securityLog({ userId: result.record.user_id, action: "REFRESH_REVOKED", success: false, req });
    return fail(res, 401, "Refresh token has been revoked");
  }
  if (result.status === REFRESH_TOKEN_STATUS_EXPIRED) {
    await securityLog({ userId: result.record.user_id, action: "REFRESH_EXPIRED", success: false, req });
    return fail(res, 401, "Refresh token has expired");
  }

  if (!result.user) return fail(res, 401, "User no longer exists");

  const newRefreshToken = generateRefreshToken();
  await storeRefreshToken({ userId: result.user.id, token: newRefreshToken, req });

  await securityLog({
    userId: result.user.id, action: "TOKEN_REFRESHED", req
  });

  return ok(res, {
    accessToken: issueAccessToken(result.user),
    refreshToken: newRefreshToken,
    expiresIn: config.jwtExpiresIn,
    user: serializeUser(result.user)
  });
}

export async function logout(req, res) {
  // Revoke the presented refresh token if one was supplied (rotation-friendly).
  const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
  if (token) {
    await revokeRefreshToken(token);
  }
  await securityLog({ userId: req.user.id, action: "LOGOUT", req });
  return ok(res, { message: "Logged out; access token should be discarded by the client" });
}

export async function me(req, res) {
  const { rows } = await query(
    `SELECT id,email,role,name,created_at FROM users WHERE id=$1`,
    [req.user.id]
  );
  if (!rows[0]) return fail(res, 404, "User not found");
  return ok(res, { user: serializeUser(rows[0]) });
}

// --- Forgot password (OTP) flow ---------------------------------------------

const OTP_LENGTH = 6;
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 5;

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Step 1: Request an OTP for a registered email address.
// Responds identically whether or not the account exists to avoid user enumeration.
export async function forgotPassword(req, res) {
  const email = normalizeEmail(req.body.email);
  if (!validEmail(email)) {
    return fail(res, 400, "Valid email address is required");
  }

  const { rows } = await query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (rows[0]) {
    // Invalidate any previous unused OTPs for this email.
    await query(
      `UPDATE password_reset_otps SET used_at = NOW()
       WHERE email = $1 AND used_at IS NULL`,
      [email]
    );

    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    await query(
      `INSERT INTO password_reset_otps (email, code_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [email, codeHash, expiresAt]
    );

    await securityLog({
      userId: rows[0].id,
      action: "PASSWORD_RESET_REQUESTED",
      success: true,
      req
    });

    await sendPasswordResetCode(email, code);
  } else {
    await securityLog({
      userId: null,
      action: "PASSWORD_RESET_ATTEMPT",
      success: false,
      req,
      details: { email }
    });
  }

  // Always return the same response, regardless of whether the account exists.
  return ok(res, {
    message: "If that email is registered, a password reset code has been sent."
  });
}

// Step 2: Verify the OTP and set a new password.
export async function resetPasswordWithOtp(req, res) {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || "").trim();
  const newPassword = String(req.body.newPassword || "");

  if (!validEmail(email) || code.length !== OTP_LENGTH || newPassword.length < 8) {
    return fail(res, 400, "A valid email, 6-digit code, and password of at least 8 characters are required");
  }

  // Fetch the most recent unused, unexpired OTP for this email.
  const { rows } = await query(
    `SELECT id, code_hash, expires_at, used_at, attempts
     FROM password_reset_otps
     WHERE email = $1 AND used_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  );

  const record = rows[0];
  if (!record) {
    await securityLog({ userId: null, action: "PASSWORD_RESET_FAILED", success: false, req, details: { email, reason: "no_valid_otp" } });
    return fail(res, 400, "This reset code is invalid or has expired. Please request a new one.");
  }

  const codeMatches = await bcrypt.compare(code, record.code_hash);
  if (!codeMatches) {
    const nextAttempts = record.attempts + 1;
    if (nextAttempts >= OTP_MAX_ATTEMPTS) {
      await query(`UPDATE password_reset_otps SET used_at = NOW(), attempts = $2 WHERE id = $1`, [
        record.id, nextAttempts
      ]);
      await securityLog({ userId: null, action: "PASSWORD_RESET_OTP_LOCKED", success: false, req, details: { email } });
      return fail(res, 429, "Too many incorrect attempts. Please request a new code.");
    }
    await query(`UPDATE password_reset_otps SET attempts = $2 WHERE id = $1`, [
      record.id, nextAttempts
    ]);
    await securityLog({ userId: null, action: "PASSWORD_RESET_OTP_MISMATCH", success: false, req });
    return fail(res, 400, "Incorrect code. Please try again.");
  }

  // Mark the OTP as used immediately (single-use).
  await query(`UPDATE password_reset_otps SET used_at = NOW() WHERE id = $1`, [record.id]);

  // Update the user's password and revoke all their refresh tokens.
  const passwordHash = await bcrypt.hash(newPassword, 12);
  const { rows: userRows } = await query(
    `UPDATE users SET password_hash = $1 WHERE email = $2
     RETURNING id`,
    [passwordHash, email]
  );

  if (!userRows[0]) {
    return fail(res, 404, "Account not found");
  }

  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userRows[0].id]
  );

  await securityLog({
    userId: userRows[0].id,
    action: "PASSWORD_RESET_SUCCESS",
    success: true,
    req
  });

  return ok(res, { message: "Password has been reset successfully." });
}