import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfig } from "../src/config/env.js";

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("development config passes validation (dev defaults are allowed)", () => {
  assert.deepEqual(validateConfig(), []);
});

test("server refuses to boot with an invalid production configuration", async () => {
  try {
    await run("node", ["server.js"], {
      cwd: path.join(__dirname, ".."),
      env: {
        ...process.env,
        NODE_ENV: "production",
        JWT_SECRET: "short",
        FILE_ENCRYPTION_KEY: "short",
        DATABASE_URL: "",
        CORS_ORIGIN: ""
      },
      timeout: 15_000
    });
    assert.fail("server should not boot with invalid prod config");
  } catch (err) {
    assert.equal(err.code, 1, "process exits with code 1");
    assert.match(err.stderr || "", /Refusing to start|FILE_ENCRYPTION_KEY|JWT_SECRET/i);
  }
});