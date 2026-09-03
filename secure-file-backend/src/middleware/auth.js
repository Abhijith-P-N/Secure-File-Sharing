import jwt from "jsonwebtoken";
import { config } from "../config/env.js";
import { query } from "../config/db.js";
import { fail } from "../utils/http.js";

if (config.isProduction && !config.jwtSecret) {
  throw new Error("JWT_SECRET is required in production");
}

export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return fail(res, 401, "Authentication required");
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ["HS256"],
      issuer: "secure-file-api"
    });
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email
    };
    next();
  } catch {
    return fail(res, 401, "Invalid or expired access token");
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") {
    return fail(res, 403, "Admin access required");
  }
  next();
}

export async function require2FA(req, res, next) {
  const { rows } = await query(
    `SELECT totp_enabled FROM users WHERE id = $1`,
    [req.user.id]
  );
  const user = rows[0];

  if (user?.totp_enabled) {
    return fail(res, 403, "2FA verification required");
  }
  next();
}