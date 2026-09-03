import { TOTP } from "otplib";
import qrcode from "qrcode";
import { query } from "../config/db.js";
import { ok, fail } from "../utils/http.js";

const ISSUER = "Secure File Sharing";
const totp = new TOTP();

export async function setup2FA(req, res) {
  const userId = req.user.id;
  const { rows } = await query(
    `SELECT email, totp_secret, totp_enabled FROM users WHERE id = $1`,
    [userId]
  );
  const user = rows[0];

  if (user.totp_enabled) {
    return fail(res, 400, "2FA is already enabled");
  }

  const secret = totp.generateSecret();
  const otpauth = totp.generate(user.email, ISSUER, secret);

  await query(
    `UPDATE users SET totp_secret = $1 WHERE id = $2`,
    [secret, userId]
  );

  const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

  return ok(res, { qrCode: qrCodeDataUrl, secret });
}

export async function verify2FA(req, res) {
  const userId = req.user.id;
  const { token } = req.body;

  if (!token || typeof token !== "string") {
    return fail(res, 400, "Token is required");
  }

  const { rows } = await query(
    `SELECT totp_secret, totp_enabled FROM users WHERE id = $1`,
    [userId]
  );
  const user = rows[0];

  if (user.totp_enabled) {
    return fail(res, 400, "2FA is already enabled");
  }

  if (!user.totp_secret) {
    return fail(res, 400, "2FA setup not initiated");
  }

  const isValid = totp.check(token, user.totp_secret);

  if (!isValid) {
    await query(
      `INSERT INTO access_logs (user_id, action, resource_type, success, ip, user_agent)
       VALUES ($1, '2fa_verify', 'user', false, $2, $3)`,
      [userId, req.ip, req.get("user-agent")]
    );
    return fail(res, 401, "Invalid 2FA token");
  }

  await query(
    `UPDATE users SET totp_enabled = TRUE WHERE id = $1`,
    [userId]
  );

  await query(
    `INSERT INTO access_logs (user_id, action, resource_type, success, ip, user_agent)
     VALUES ($1, '2fa_enable', 'user', true, $2, $3)`,
    [userId, req.ip, req.get("user-agent")]
  );

  return ok(res, { message: "2FA enabled successfully" });
}

export async function disable2FA(req, res) {
  const userId = req.user.id;
  const { password, token } = req.body;

  if (!password || !token) {
    return fail(res, 400, "Password and 2FA token are required");
  }

  const { rows } = await query(
    `SELECT password_hash, totp_secret, totp_enabled FROM users WHERE id = $1`,
    [userId]
  );
  const user = rows[0];

  if (!user.totp_enabled) {
    return fail(res, 400, "2FA is not enabled");
  }

  const bcrypt = await import("bcrypt");
  const passwordValid = await bcrypt.compare(password, user.password_hash);
  if (!passwordValid) {
    await query(
      `INSERT INTO access_logs (user_id, action, resource_type, success, ip, user_agent)
       VALUES ($1, '2fa_disable', 'user', false, $2, $3)`,
      [userId, req.ip, req.get("user-agent")]
    );
    return fail(res, 401, "Invalid password");
  }

  const isValid = totp.check(token, user.totp_secret);
  if (!isValid) {
    await query(
      `INSERT INTO access_logs (user_id, action, resource_type, success, ip, user_agent)
       VALUES ($1, '2fa_disable', 'user', false, $2, $3)`,
      [userId, req.ip, req.get("user-agent")]
    );
    return fail(res, 401, "Invalid 2FA token");
  }

  await query(
    `UPDATE users SET totp_enabled = FALSE, totp_secret = NULL WHERE id = $1`,
    [userId]
  );

  await query(
    `INSERT INTO access_logs (user_id, action, resource_type, success, ip, user_agent)
     VALUES ($1, '2fa_disable', 'user', true, $2, $3)`,
    [userId, req.ip, req.get("user-agent")]
  );

  return ok(res, { message: "2FA disabled successfully" });
}

export async function verify2FALogin(req, res) {
  const { email, token } = req.body;

  if (!email || !token) {
    return fail(res, 400, "Email and 2FA token are required");
  }

  const { rows } = await query(
    `SELECT id, totp_secret, totp_enabled FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );
  const user = rows[0];

  if (!user || !user.totp_enabled || !user.totp_secret) {
    return fail(res, 401, "Invalid 2FA request");
  }

  const isValid = totp.check(token, user.totp_secret);
  if (!isValid) {
    await query(
      `INSERT INTO access_logs (user_id, action, resource_type, success, ip, user_agent)
       VALUES ($1, '2fa_login', 'user', false, $2, $3)`,
      [user.id, req.ip, req.get("user-agent")]
    );
    return fail(res, 401, "Invalid 2FA token");
  }

  return ok(res, { userId: user.id, verified: true });
}