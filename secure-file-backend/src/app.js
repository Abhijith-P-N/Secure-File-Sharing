import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/env.js";
import { getPool, query } from "./config/db.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requestId, requestLogger } from "./middleware/requestLog.js";
import authRoutes from "./routes/auth.routes.js";
import fileRoutes from "./routes/file.routes.js";
import shareRoutes from "./routes/share.routes.js";
import logRoutes from "./routes/log.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { healthController } from "./controllers/health.controller.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(requestId);
app.use(helmet({
  // Allow the API's own documentation and Swagger-free JSON responses.
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(requestLogger);
app.use(apiLimiter);

app.get("/health", healthController.health);
app.get("/health/live", healthController.live);
app.get("/health/ready", healthController.ready(getPool, query));

app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/shares", shareRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

export default app;