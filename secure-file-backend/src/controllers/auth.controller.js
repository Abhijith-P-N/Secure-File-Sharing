import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { query } from "../config/db.js";
import { config } from "../config/env.js";
import { securityLog } from "../services/log.service.js";
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
  const { email, password } = req.body;
  const { rows } = await query(
    `SELECT id,email,password_hash,role,name FROM users WHERE email=$1`,
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