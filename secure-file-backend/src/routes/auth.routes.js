import { Router } from "express";
import { z } from "zod";
import { register, login, refresh, logout, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  twofaToken: z.string().length(6).optional()
});
const registerSchema = credentials.extend({
  name: z.string().trim().min(1).max(100).optional()
});
const refreshSchema = z.object({
  refreshToken: z.string().min(32).max(512)
});

router.post("/register", authLimiter, validate(registerSchema), asyncHandler(register));
router.post("/login", authLimiter, validate(credentials), asyncHandler(login));
router.post("/refresh", authLimiter, validate(refreshSchema), asyncHandler(refresh));
router.post("/logout", requireAuth, asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));

export default router;