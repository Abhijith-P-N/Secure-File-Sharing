import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { query } from "../config/db.js";
import { securityLog } from "../services/log.service.js";
import { fail, ok } from "../utils/http.js";

const jwtSecret = process.env.JWT_SECRET || "development-only-secret";

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "15m", issuer: "secure-file-api" }
  );
}

export async function register(req, res) {
  const { email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();

  try {
    const { rows } = await query(
      `INSERT INTO users(id,email,password_hash)
       VALUES($1,$2,$3)
       RETURNING id,email,role,created_at`,
      [id, email.toLowerCase(), passwordHash]
    );
    return ok(res, { user: rows[0] }, 201);
  } catch (e) {
    if (e.code === "23505") return fail(res, 409, "Email is already registered");
    throw e;
  }
}

export async function login(req, res) {
  const { email, password } = req.body;
  const { rows } = await query(
    `SELECT id,email,password_hash,role FROM users WHERE email=$1`,
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

  return ok(res, { accessToken: issueToken(user), expiresIn: process.env.JWT_EXPIRES_IN || "15m" });
}

export async function logout(req, res) {
  // JWT access tokens are stateless. The client must discard the token.
  // For high-security deployments, add refresh-token rotation/blacklisting.
  return ok(res, { message: "Logged out successfully; discard the access token" });
}

export async function me(req, res) {
  const { rows } = await query(
    `SELECT id,email,role,created_at FROM users WHERE id=$1`,
    [req.user.id]
  );
  if (!rows[0]) return fail(res, 404, "User not found");
  return ok(res, { user: rows[0] });
}
