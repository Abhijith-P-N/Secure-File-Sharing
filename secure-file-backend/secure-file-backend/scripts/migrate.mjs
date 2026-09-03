import "dotenv/config";
import {
  runAllPending,
  migrateStatus,
  runMigration,
  ensureMigrationsTable,
} from "../src/config/migrate.js";

const command = process.argv[2];

async function main() {
  try {
    if (command === "status") {
      await ensureMigrationsTable();
      const status = await migrateStatus();
      console.log("\nMigration Status:");
      console.log("================");
      console.log(`Applied (${status.applied.length}):`);
      status.applied.forEach((m) => console.log(`  ✓ ${m}`));
      console.log(`\nPending (${status.pending.length}):`);
      status.pending.forEach((m) => console.log(`  ○ ${m}`));
      if (status.pending.length === 0) {
        console.log("  (none)");
      }
      process.exit(0);
    } else if (command) {
      await runMigration(command);
      process.exit(0);
    } else {
      const count = await runAllPending();
      process.exit(count > 0 ? 0 : 0);
    }
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exit(1);
  } finally {
    const { getPool } = await import("../src/config/db.js");
    await getPool().end();
  }
}

main();