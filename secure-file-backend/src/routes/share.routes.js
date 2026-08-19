import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createShare, accessShare, downloadShare, revokeShare, deleteShare } from "../controllers/share.controller.js";

const router = Router();

const createSchema = z.object({
  fileId: z.string().uuid(),
  password: z.string().min(4).max(128).optional(),
  expiration: z.string().datetime().optional(),
  maxDownloads: z.number().int().min(1).max(100000).optional()
});

router.post("/", requireAuth, validate(createSchema), asyncHandler(createShare));
router.get("/:token", asyncHandler(accessShare));
router.get("/:token/download", asyncHandler(downloadShare));

router.delete("/:id", requireAuth, validate(z.object({ id: z.string().uuid() }), "params"), asyncHandler(deleteShare));
router.post("/:id/revoke", requireAuth, validate(z.object({ id: z.string().uuid() }), "params"), asyncHandler(revokeShare));

export default router;
