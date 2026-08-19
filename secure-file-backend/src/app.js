import express from "express";
import cors from "cors";
import helmet from "helmet";
import { apiLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.routes.js";
import fileRoutes from "./routes/file.routes.js";
import shareRoutes from "./routes/share.routes.js";
import logRoutes from "./routes/log.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(apiLimiter);

app.get("/health", (_req, res) => res.json({ success: true, message: "API is healthy" }));

app.use("/api/auth", authRoutes);
app.use("/api/files", fileRoutes);
app.use("/api/shares", shareRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/admin", adminRoutes);

app.use(errorHandler);

export default app;
