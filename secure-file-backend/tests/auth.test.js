import test from "node:test";
import assert from "node:assert/strict";
import { decryptBuffer, encryptBuffer, hashSha256, verifyIntegrity } from "../src/services/security.service.js";
import { hashToken, secureToken } from "../src/utils/crypto.js";

test("share tokens are random and hashable", () => {
  const first = secureToken();
  const second = secureToken();

  assert.notEqual(first, second);
  assert.notEqual(hashToken(first), first);
});

test("encrypted files round-trip and preserve integrity", async () => {
  const original = Buffer.from("private file contents");
  const encrypted = await encryptBuffer(original);
  const decrypted = await decryptBuffer(encrypted);
  const digest = await hashSha256(original);

  assert.notDeepEqual(encrypted, original);
  assert.deepEqual(decrypted, original);
  assert.equal(await verifyIntegrity(decrypted, digest), true);
  assert.equal(await verifyIntegrity(Buffer.from("tampered"), digest), false);
});
