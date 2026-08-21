import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { users, files, stats, securityEvents, updateUserRole, deleteUser, revokeAllShares } from "../controllers/admin.controller.js";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/users", asyncHandler(users));
router.get("/files", asyncHandler(files));
router.get("/stats", asyncHandler(stats));
router.get("/security-events", asyncHandler(securityEvents));

// Admin action routes with audit logging
const roleSchema = z.object({
  body: z.object({ role: z.enum(["user", "admin"]) })
});
router.patch("/users/:userId/role", validate(roleSchema), asyncHandler(updateUserRole));
router.delete("/users/:userId", asyncHandler(deleteUser));
router.post("/users/:userId/revoke-shares", asyncHandler(revokeAllShares));

export default router;
