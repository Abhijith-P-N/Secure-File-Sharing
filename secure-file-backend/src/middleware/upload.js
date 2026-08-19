import multer from "multer";
import path from "node:path";
import { safeFilename } from "../utils/crypto.js";

const maxBytes = Number(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024;

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
    fileSize: maxBytes,
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
