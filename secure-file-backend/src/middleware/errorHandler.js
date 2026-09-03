import multer from "multer";
import { fail } from "../utils/http.js";
import { logger } from "../utils/logger.js";
import { config } from "../config/env.js";

export function errorHandler(err, req, res, _next) {
  logger.error(err?.message || "Unhandled error", {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    stack: config.isProduction ? undefined : err?.stack
  });

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") return fail(res, 413, "File is too large");
    if (err.code === "LIMIT_FILE_COUNT") return fail(res, 400, "Only one file may be uploaded at a time");
    if (err.code === "LIMIT_UNEXPECTED_FILE") return fail(res, 400, "Unexpected field in upload");
    if (err.code === "LIMIT_FIELD_COUNT") return fail(res, 400, "Too many fields in upload");
    return fail(res, 400, "Invalid file upload");
  }

  if (err?.status && typeof err.status === "number") {
    return fail(res, err.status, err.message);
  }

  if (err?.code === "23505") return fail(res, 409, "Resource already exists");

  if (config.isProduction) {
    return fail(res, 500, "Internal server error");
  }

  return fail(res, 500, "Internal server error", { error: err.message });
}