import "dotenv/config";
import app from "./src/app.js";
import { config, validateConfig } from "./src/config/env.js";
import { getPool } from "./src/config/db.js";
import { logger } from "./src/utils/logger.js";

const problems = validateConfig();
if (problems.length) {
  console.error("Refusing to start: invalid configuration");
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

const server = app.listen(config.port, () => {
  logger.info(`Secure file backend listening on http://localhost:${config.port}`, {
    env: config.env
  });
});

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}; shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async () => {
    try {
      await getPool().end();
      logger.info("HTTP server and database pool closed");
      process.exit(0);
    } catch (err) {
      logger.error("Error during shutdown", { error: err.message });
      process.exit(1);
    }
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", { error: String(reason) });
  process.exit(1);
});