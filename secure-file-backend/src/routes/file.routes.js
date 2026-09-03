import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadFile, listFiles, searchFiles, getFile, downloadOwnedFile, deleteFile } from "../controllers/file.controller.js";

const router = Router();
const idSchema = z.object({ id: z.string().uuid() });
const searchSchema = z.object({ q: z.string().min(1).max(200) });

router.use(requireAuth);
router.post("/upload", upload, asyncHandler(uploadFile));
router.get("/search", validate(searchSchema, "query"), asyncHandler(searchFiles));
router.get("/", asyncHandler(listFiles));
router.get("/:id", validate(idSchema, "params"), asyncHandler(getFile));
router.get("/:id/download", validate(idSchema, "params"), asyncHandler(downloadOwnedFile));
router.delete("/:id", validate(idSchema, "params"), asyncHandler(deleteFile));

export default router;
