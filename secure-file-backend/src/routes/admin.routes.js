import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { users, files, stats, securityEvents } from "../controllers/admin.controller.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/users", asyncHandler(users));
router.get("/files", asyncHandler(files));
router.get("/stats", asyncHandler(stats));
router.get("/security-events", asyncHandler(securityEvents));

export default router;
