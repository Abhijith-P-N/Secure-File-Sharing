import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getLogs } from "../controllers/log.controller.js";

const router = Router();
router.get("/", requireAuth, asyncHandler(getLogs));
export default router;
