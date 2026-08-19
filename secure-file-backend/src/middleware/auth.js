import jwt from "jsonwebtoken";
import { fail } from "../utils/http.js";

const secret = process.env.JWT_SECRET;

if (!secret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production");
}

export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return fail(res, 401, "Authentication required");
  }

  try {
    const payload = jwt.verify(token, secret || "development-only-secret");
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
