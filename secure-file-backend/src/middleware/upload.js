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
  "application/json",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/x-log",
  "text/log",
  "application/octet-stream"
]);

const allowedExtensions = new Set(["pptx", "log", "ovpn", "txt", "json", "pdf", "jpg", "jpeg", "png", "gif", "zip"]);

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
    fields: 10
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (allowed.has(file.mimetype) || allowedExtensions.has(ext)) {
      file.originalname = safeFilename(path.basename(file.originalname));
      return cb(null, true);
    }
    const err = new Error(`Unsupported file type: ${file.mimetype}. Allowed: ${[...allowed].join(", ")} or extensions .${[...allowedExtensions].join(", .")}`);
    err.status = 400;
    return cb(err);
  }
}).single("file");
