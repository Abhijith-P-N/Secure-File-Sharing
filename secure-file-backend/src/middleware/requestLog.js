import crypto from "node:crypto";

export function requestId(req, res, next) {
  const incoming = req.get("x-request-id");
  const id = incoming && incoming.length <= 100 ? incoming : crypto.randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}

export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const line = {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      ip: req.ip
    };
    if (res.statusCode >= 500) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: "request error", ...line }));
    } else {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", msg: "request", ...line }));
    }
  });
  next();
}