function respond(res, data, status = 200) {
  res.status(status);
  return res.json({ success: true, ...data });
}

export const healthController = {
  health(_req, res) {
    return respond(res, { message: "API is healthy" });
  },
  live(_req, res) {
    return respond(res, { status: "up" });
  },
  ready(getPool, query) {
    return async (_req, res, next) => {
      try {
        await query("SELECT 1");
        return respond(res, { status: "ready" });
      } catch (err) {
        // 503 signals load balancers / orchestrators that the app is not ready.
        res.status(503);
        return res.json({ success: false, message: "Not ready" });
      }
    };
  }
};