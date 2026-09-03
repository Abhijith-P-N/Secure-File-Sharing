import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createUploadSession, uploadChunk, completeUpload, getUploadSession, deleteUploadSession } from "../controllers/upload.controller.js";

const router = Router();
router.use(requireAuth);

const createSessionSchema = z.object({
  body: z.object({
    originalName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(255),
    totalSize: z.number().int().positive(),
    chunkSize: z.number().int().positive().optional()
  })
});

const uploadChunkSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    chunkIndex: z.number().int().min(0),
    chunkData: z.string()
  })
});

const completeSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid(),
    expectedSha256: z.string().length(64).optional()
  })
});

router.post("/session", validate(createSessionSchema), asyncHandler(createUploadSession));
router.post("/chunk", validate(uploadChunkSchema), asyncHandler(uploadChunk));
router.post("/complete", validate(completeSchema), asyncHandler(completeUpload));
router.get("/session/:sessionId", asyncHandler(getUploadSession));
router.delete("/session/:sessionId", asyncHandler(deleteUploadSession));

export default router;