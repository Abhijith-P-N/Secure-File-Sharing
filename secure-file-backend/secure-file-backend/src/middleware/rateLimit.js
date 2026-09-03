import rateLimit from "express-rate-limit";

const disabled = process.env.DISABLE_RATE_LIMIT === "1";

function limiter(options) {
  if (disabled) return (_req, _res, next) => {
    next();
  };
  return rateLimit(options);
}

export const apiLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many requests" }
});

export const authLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts" }
});

export const shareLimiter = limiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many share requests" }
});