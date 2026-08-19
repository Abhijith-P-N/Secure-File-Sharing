import multer from "multer";
import { fail } from "../utils/http.js";

export function errorHandler(err, req, res, _next) {
  console.error(err?.message || err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") return fail(res, 413, "File is too large");
    return fail(res, 400, "Invalid file upload");
  }

  if (err?.code === "23505") return fail(res, 409, "Resource already exists");

  if (process.env.NODE_ENV === "production") {
    return fail(res, 500, "Internal server error");
  }

  return fail(res, 500, "Internal server error", { error: err.message });
}
