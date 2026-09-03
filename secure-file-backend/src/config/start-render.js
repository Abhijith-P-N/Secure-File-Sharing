import "dotenv/config";
import { runAllPending } from "./migrate.js";

async function main() {
  try {
    console.log("Applying pending database migrations...");
    await runAllPending();
    console.log("Migrations complete.");
  } catch (err) {
    console.error("Migration step failed:", err?.message);
    process.exit(1);
  }

  // Load and start the main server only after migrations succeed.
  await import("../../server.js");
}

main();
