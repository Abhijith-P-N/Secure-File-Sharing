import { Router } from "express";
import { z } from "zod";
import { register, login, logout, me } from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const credentials = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128)
});

router.post("/register", authLimiter, validate(credentials), asyncHandler(register));
router.post("/login", authLimiter, validate(credentials), asyncHandler(login));
router.post("/logout", requireAuth, asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
