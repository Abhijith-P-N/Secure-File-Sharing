import crypto from "node:crypto";
import { createLogger } from "../utils/logger.js";

export function requestId(req, res, next) {
  const incoming = req.get("x-request-id");
  const id = incoming && incoming.length <= 100 ? incoming : crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  
  // Create a child logger bound to this request's correlation ID
  req.log = createLogger({ requestId: id });
  
  next();
}

export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const context = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      ip: req.ip
    };
    if (res.statusCode >= 500) {
      req.log.error("request error", context);
    } else {
      req.log.info("request", context);
    }
  });
  next();
}