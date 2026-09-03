import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { shareLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createShare, listShares, accessShare, downloadShare, revokeShare, deleteShare,
  requestAccess, verifyAccess
} from "../controllers/share.controller.js";

const router = Router();

const createSchema = z.object({
  fileId: z.string().uuid(),
  password: z.string().min(4).max(128).optional(),
  expiration: z.union([
    z.string().datetime(),
    z.enum(["1h", "6h", "24h", "7d"])
  ]).optional(),
  maxDownloads: z.union([
    z.number().int().min(1).max(100000),
    z.literal("unlimited")
  ]).optional(),
  allowedEmail: z.string().max(2048).optional()
});

const idParam = z.object({ id: z.string().uuid() });
const shareParam = z.object({ token: z.string().min(10).max(256) });

router.get("/", requireAuth, asyncHandler(listShares));
router.post("/", requireAuth, validate(createSchema), asyncHandler(createShare));

router.get("/:token", validate(shareParam, "params"), shareLimiter, asyncHandler(accessShare));
router.get("/:token/download", validate(shareParam, "params"), shareLimiter, asyncHandler(downloadShare));
router.post("/:token/download", validate(shareParam, "params"), shareLimiter, asyncHandler(downloadShare));

router.post("/:token/request-access", validate(shareParam, "params"), shareLimiter, asyncHandler(requestAccess));
router.post("/:token/verify-access", validate(shareParam, "params"), shareLimiter, asyncHandler(verifyAccess));

router.delete("/:id", requireAuth, validate(idParam, "params"), asyncHandler(deleteShare));
router.post("/:id/revoke", requireAuth, validate(idParam, "params"), asyncHandler(revokeShare));

export default router;