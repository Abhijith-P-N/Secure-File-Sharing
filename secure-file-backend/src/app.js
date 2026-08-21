import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import { config } from "./config/env.js";
import { getPool, query } from "./config/db.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { requestId, requestLogger } from "./middleware/requestLog.js";
import { csrfProtection, csrfTokenIssuer } from "./middleware/csrf.js";
import authRoutes from "./routes/auth.routes.js";
import fileRoutes from "./routes/file.routes.js";
import shareRoutes from "./routes/share.routes.js";
import logRoutes from "./routes/log.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import twofaRoutes from "./routes/twofa.routes.js";
import uploadRoutes from "./routes/upload.routes.js";
import { healthController } from "./controllers/health.controller.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { enablePoolMonitoring, getPoolHealth } from "./services/poolMonitor.js";
import { metricsMiddleware, collectMetrics } from "./services/metrics.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(requestId);
app.use(metricsMiddleware);
app.use(helmet({
  // Allow the API's own documentation and Swagger-free JSON responses.
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  noSniff: true,
  xssFilter: true,
  frameguard: { action: "deny" }
}));
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));
app.use(cookieParser());
app.use(compression());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(requestLogger);
app.use(apiLimiter);
app.use(csrfTokenIssuer);
app.use(csrfProtection);

app.get("/health", healthController.health);
app.get("/health/live", healthController.live);
app.get("/health/ready", healthController.ready(getPool, query));
app.get("/health/pool", (req, res) => {
  res.json(getPoolHealth());
});
app.get("/metrics", (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.send(collectMetrics(getPool()));
});

// Enable pool monitoring
enablePoolMonitoring();

// API v1 routes
const apiV1 = express.Router();
apiV1.use("/auth", authRoutes);
apiV1.use("/2fa", twofaRoutes);
apiV1.use("/files", fileRoutes);
apiV1.use("/shares", shareRoutes);
apiV1.use("/logs", logRoutes);
apiV1.use("/admin", adminRoutes);
apiV1.use("/upload", uploadRoutes);

app.use("/api/v1", apiV1);

// Backward compatibility - redirect old paths to v1 (optional)
app.use("/api/auth", authRoutes);
app.use("/api/2fa", twofaRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/shares", shareRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upload", uploadRoutes);

app.use(errorHandler);

export default app;