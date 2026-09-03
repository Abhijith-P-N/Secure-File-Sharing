import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";
import * as twofaController from "../controllers/twofa.controller.js";

const router = Router();

router.post("/setup", requireAuth, twofaController.setup2FA);
router.post("/verify", requireAuth, validate(z.object({ body: z.object({ token: z.string().length(6) }) })), twofaController.verify2FA);
router.post("/disable", requireAuth, validate(z.object({ body: z.object({ password: z.string(), token: z.string().length(6) }) })), twofaController.disable2FA);
router.post("/verify-login", validate(z.object({ body: z.object({ email: z.string().email(), token: z.string().length(6) }) })), twofaController.verify2FALogin);

export default router;