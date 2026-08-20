import multer from "multer";
import path from "node:path";
import { safeFilename } from "../utils/crypto.js";
import { config } from "../config/env.js";

const allowed = new Set([
  "application/pdf",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/zip",
  "application/json"
]);

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
    fields: 10
  },
  fileFilter: (_req, file, cb) => {
    if (!allowed.has(file.mimetype)) {
      return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE"));
    }
    file.originalname = safeFilename(path.basename(file.originalname));
    cb(null, true);
  }
}).single("file");
