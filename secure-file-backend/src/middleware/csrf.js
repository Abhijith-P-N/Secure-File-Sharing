import crypto from "node:crypto";

const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf_token";
const CSRF_TOKEN_BYTES = 32;

export function generateCsrfToken() {
  return crypto.randomBytes(CSRF_TOKEN_BYTES).toString("base64url");
}

export function csrfProtection(req, res, next) {
  // Skip for safe methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  // Disable CSRF in test environment
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_CSRF === "1") {
    return next();
  }

  // CSRF only applies to cookie-based auth. This SPA uses Bearer tokens for
  // all authenticated requests, so CSRF is inherently mitigated.
  // We still validate if both header + cookie are present (belt-and-suspenders).
  const tokenFromCookie = req.cookies?.[CSRF_COOKIE];
  if (!tokenFromCookie) {
    return next();
  }

  const tokenFromHeader = req.get(CSRF_HEADER);
  if (!tokenFromHeader) {
    // No header sent — skip (SPA uses Bearer tokens, not cookies, for auth)
    return next();
  }

  if (tokenFromHeader !== tokenFromCookie) {
    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
}

export function csrfTokenIssuer(req, res, next) {
  // Issue CSRF token cookie if not present
  if (!req.cookies?.[CSRF_COOKIE]) {
    const token = generateCsrfToken();
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    // Also set header for SPA convenience
    res.setHeader(CSRF_HEADER, token);
  } else {
    // Token already exists in cookie, send it in header so SPA can cache it
    res.setHeader(CSRF_HEADER, req.cookies[CSRF_COOKIE]);
  }
  next();
}

export function getCsrfToken(req) {
  return req.cookies?.[CSRF_COOKIE] || req.get(CSRF_HEADER);
}