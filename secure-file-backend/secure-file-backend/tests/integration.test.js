import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { newDb } from "pg-mem";
import { decryptBuffer } from "../src/services/security.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = path.join(__dirname, "../src/config/schema.sql");

const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
);
const MINIMAL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

const sess = Symbol.for("sfs.test.pool");

async function setup() {
  const db = newDb({ autoCreateForeignKeyIndices: true });
  const schema = fs.readFileSync(SCHEMA, "utf8");
  db.public.none(schema);

  const { Pool } = db.adapters.createPg();
  const injectedPool = new Pool();

  globalThis[sess] = injectedPool;

  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfs-test-"));
  process.env.UPLOAD_DIR = uploadDir;
  process.env.JWT_SECRET = "integration-test-secret";
  process.env.FILE_ENCRYPTION_KEY = "integration-test-encryption-key-32char";
  process.env.NODE_ENV = "test";
  process.env.DISABLE_RATE_LIMIT = "1";

  const { default: app } = await import("../src/app.js");
  const { default: request } = await import("supertest");

  return {
    app,
    request: request(app),
    injectedPool,
    uploadDir,
    login(email, password) {
      return request(app).post("/api/auth/login").send({ email, password });
    }
  };
}

async function registerUser(request, name, email, password) {
  const res = await request.post("/api/auth/register").send({ name, email, password });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.user;
}

async function loginUser(request, email, password) {
  const res = await request.post("/api/auth/login").send({ email, password });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

test("full secure file-sharing flow", async (t) => {
  const { app, request, uploadDir, injectedPool } = await setup();
  const REAL_PNG = Uint8Array.from(
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")
  );

  const alice = await registerUser(request, "Alice", "alice@example.com", "password123");
  const bob = await registerUser(request, "Bob", "bob@example.com", "password123");

  const aliceSession = await loginUser(request, "alice@example.com", "password123");
  assert.ok(aliceSession.accessToken, "login returns an access token");
  assert.equal(aliceSession.user.email, "alice@example.com", "login returns the user");
  const bobSession = await loginUser(request, "bob@example.com", "password123");
  const aliceAuth = auth(aliceSession.accessToken);
  const bobAuth = auth(bobSession.accessToken);

  // IDOR: bob must not see alice's profile data shape upfront (self only)
  const me = await request.get("/api/auth/me").set(aliceAuth);
  assert.equal(me.status, 200);

  // ---- Upload (encrypted at rest) ----
  const up = await request
    .post("/api/files/upload")
    .set(aliceAuth)
    .attach("file", MINIMAL_PDF, "secret.pdf");
  assert.equal(up.status, 201, JSON.stringify(up.body));
  const file = up.body.file;
  assert.ok(file.id);
  assert.equal(file.name, "secret.pdf");
  assert.equal(file.size, MINIMAL_PDF.length);
  assert.equal(file.integrityStatus, "Verified");

  const stored = fs.readdirSync(uploadDir);
  assert.equal(stored.length, 1, "one file stored");
  const cipherBytes = fs.readFileSync(path.join(uploadDir, stored[0]));
  assert.notDeepEqual(cipherBytes, MINIMAL_PDF, "ciphertext differs from plaintext");
  assert.deepEqual(await decryptBuffer(cipherBytes), MINIMAL_PDF, "file decrypts to original");

  // ---- List + details ----
  const list = await request.get("/api/files").set(aliceAuth);
  assert.equal(list.status, 200);
  assert.equal(list.body.files.length, 1);
  assert.equal(list.body.files[0].name, "secret.pdf");
  assert.equal(list.body.files[0].sha256.length, 64);

  const details = await request.get(`/api/files/${file.id}`).set(aliceAuth);
  assert.equal(details.status, 200);

  // ---- IDOR: bob cannot view or download alice's private file ----
  assert.equal((await request.get(`/api/files/${file.id}`).set(bobAuth)).body.success, false);
  assert.equal((await request.get(`/api/files/${file.id}`).set(bobAuth)).status, 403);
  assert.equal((await request.get(`/api/files/${file.id}/download`).set(bobAuth)).status, 403);

  // ---- Share with password + expiry + download limit ----
  const shareRes = await request
    .post("/api/shares")
    .set(aliceAuth)
    .send({ fileId: file.id, password: "sharepass", expiration: "1h", maxDownloads: 2 });
  assert.equal(shareRes.status, 201, JSON.stringify(shareRes.body));
  const share = shareRes.body.share;
  assert.ok(share.token, "raw token returned once");
  assert.equal(share.passwordProtected, true);
  assert.equal(share.maxDownloads, 2);

  // Metadata is visible without the password; it flags that a password is required
  let res = await request.get(`/api/shares/${share.token}`);
  assert.equal(res.status, 200, "metadata does not require the password");
  assert.equal(res.body.share.passwordProtected, true);

  res = await request.get(`/api/shares/${share.token}?password=wrong`);
  assert.equal(res.status, 401, "wrong password denied");

  res = await request.get(`/api/shares/${share.token}?password=sharepass`);
  assert.equal(res.status, 200, "correct password allowed");
  assert.deepEqual(res.body.share.passwordProtected, true);
  assert.equal(res.body.share.fileName, "secret.pdf");

  // ---- Download via POST (password in body) ----
  const dl1 = await request
    .post(`/api/shares/${share.token}/download`)
    .send({ password: "sharepass" });
  assert.equal(dl1.status, 200);
  assert.deepEqual(Buffer.from(dl1.body), MINIMAL_PDF, "download returns original bytes");

  const dl2 = await request
    .post(`/api/shares/${share.token}/download`)
    .send({ password: "sharepass" });
  assert.equal(dl2.status, 200);

  const dl3 = await request
    .post(`/api/shares/${share.token}/download`)
    .send({ password: "sharepass" });
  assert.equal(dl3.status, 403, "download limit enforced");

  // ---- Revoke ----
  const revoke = await request
    .post(`/api/shares/${share.id}/revoke`)
    .set(aliceAuth);
  assert.equal(revoke.status, 200);

  const afterRevoke = await request.get(`/api/shares/${share.token}?password=sharepass`);
  assert.equal(afterRevoke.status, 403, "revoked link denied");

  // ---- Second share without password, unlimited, then list shares ----
  const share2res = await request
    .post("/api/shares")
    .set(aliceAuth)
    .send({ fileId: file.id, maxDownloads: "unlimited" });
  assert.equal(share2res.status, 201, JSON.stringify(share2res.body));
  const share2 = share2res.body.share;
  assert.equal(share2.maxDownloads, null, "unlimited => null");

  const listShares = await request.get("/api/shares").set(aliceAuth);
  assert.equal(listShares.status, 200);
  assert.equal(listShares.body.shares.length, 2);

  const dlOpen = await request.get(`/api/shares/${share2.token}/download`);
  assert.equal(dlOpen.status, 200, "open share downloadable");
  assert.deepEqual(Buffer.from(dlOpen.body), MINIMAL_PDF);

  // ---- Access logs ----
  const logs = await request.get("/api/logs").set(aliceAuth);
  assert.equal(logs.status, 200);
  const actions = logs.body.logs.map((l) => l.action);
  for (const action of ["LOGIN_SUCCESS", "FILE_UPLOAD", "SHARE_CREATED", "SHARE_REVOKED"]) {
    assert.ok(actions.includes(action), `log contains ${action}`);
  }

  // Failed/unauthorized attempts are attributed and logged
  const bobLogs = await request.get("/api/logs").set(bobAuth);
  assert.equal(bobLogs.status, 200);
  assert.ok(
    bobLogs.body.logs.some((l) => l.action === "UNAUTHORIZED_FILE_ACCESS" && l.result === "Failed"),
    "bob's unauthorized access attempt is logged"
  );

  // ---- Integrity verification rejects corruption ----
  const encryptedFile = fs.readFileSync(path.join(uploadDir, stored[0]));
  encryptedFile[20] ^= 0xff; // flip a byte in the ciphertext footer
  fs.writeFileSync(path.join(uploadDir, stored[0]), encryptedFile);
  const corrupt = await request
    .get(`/api/files/${file.id}/download`)
    .set(aliceAuth);
  assert.equal(corrupt.status, 500, "integrity mismatch blocks download");

  // ---- Admin stats (promote alice to admin, then re-login for a fresh token) ----
  await injectedPool.query(`UPDATE users SET role='admin' WHERE email='alice@example.com'`);
  const adminApi = auth((await loginUser(request, "alice@example.com", "password123")).accessToken);
  const adminStats = await request.get("/api/admin/stats").set(adminApi);
  assert.equal(adminStats.status, 200, JSON.stringify(adminStats.body));
  assert.equal(adminStats.body.stats.users, 2);
  assert.equal(adminStats.body.stats.files, 1);
  assert.equal(adminStats.body.stats.activeShares, 1);
  assert.ok(adminStats.body.stats.failedSecurityEvents >= 1);

  // Non-admin cannot read admin endpoints
  const bobStats = await request.get("/api/admin/stats").set(bobAuth);
  assert.equal(bobStats.status, 403, "non-admin denied admin API");

  await injectedPool.end?.();
  await app?.close?.();
});

test("expiration is enforced", async (t) => {
  const { app, request, injectedPool } = await setup();
  const alice = await registerUser(request, "Alice", "alice2@example.com", "password123");
  const session = await loginUser(request, "alice2@example.com", "password123");
  const up = await request
    .post("/api/files/upload")
    .set(auth(session.accessToken))
    .attach("file", Buffer.from("expire me"), "note.txt");
  assert.equal(up.status, 201);

  const shareRes = await request
    .post("/api/shares")
    .set(auth(session.accessToken))
    .send({
      fileId: up.body.file.id,
      expiration: new Date(Date.now() - 1000).toISOString()
    });
  assert.equal(shareRes.status, 400, "past expiration rejected at creation");

  const ok = await request
    .post("/api/shares")
    .set(auth(session.accessToken))
    .send({ fileId: up.body.file.id, expiration: "1h" });
  assert.equal(ok.status, 201);

  // force-expire it directly
  await injectedPool.query(
    `UPDATE shares SET expires_at = NOW() - interval '1 hour' WHERE id = $1`,
    [ok.body.share.id]
  );
  const expired = await request.get(`/api/shares/${ok.body.share.token}`);
  assert.equal(expired.status, 403, "expired link denied");
  await injectedPool.end?.();
  await app?.close?.();
});

test("refresh-token rotation, magic-byte validation, readiness", async (t) => {
  const { app, request, injectedPool } = await setup();

  const ready = await request.get("/health/ready");
  assert.equal(ready.status, 200, "ready endpoint pings the DB");

  await registerUser(request, "Alice", "alice3@example.com", "password123");
  const session = await loginUser(request, "alice3@example.com", "password123");
  assert.ok(session.refreshToken, "login returns a refresh token");

  // Valid PNG is accepted (magic bytes match the declared type)
  const pngUp = await request
    .post("/api/files/upload")
    .set(auth(session.accessToken))
    .attach("file", MINIMAL_PNG, "logo.png");
  assert.equal(pngUp.status, 201, JSON.stringify(pngUp.body));

  // Plain text spoofing a PDF is rejected
  const spoof = await request
    .post("/api/files/upload")
    .set(auth(session.accessToken))
    .attach("file", Buffer.from("MZ this is not a pdf"), "evil.pdf");
  assert.equal(spoof.status, 400, "spoofed MIME rejected");

  // Empty files are rejected
  const empty = await request
    .post("/api/files/upload")
    .set(auth(session.accessToken))
    .attach("file", Buffer.from(""), "empty.txt");
  assert.equal(empty.status, 400, "empty file rejected");

  // ---- Refresh-token rotation ----
  const fresh = await request
    .post("/api/auth/refresh")
    .send({ refreshToken: session.refreshToken });
  assert.equal(fresh.status, 200, JSON.stringify(fresh.body));
  assert.ok(fresh.body.accessToken, "new access token issued");
  assert.ok(fresh.body.refreshToken, "new refresh token issued");
  assert.notEqual(fresh.body.refreshToken, session.refreshToken, "refresh token rotated");

  // Replaying the old (rotated) refresh token must fail
  const replay = await request
    .post("/api/auth/refresh")
    .send({ refreshToken: session.refreshToken });
  assert.equal(replay.status, 401, "old refresh token cannot be replayed");

  // New access token works
  const me = await request.get("/api/auth/me").set(auth(fresh.body.accessToken));
  assert.equal(me.status, 200);

  // Logout revokes the active refresh token
  const logoutRes = await request
    .post("/api/auth/logout")
    .set(auth(fresh.body.accessToken))
    .send({ refreshToken: fresh.body.refreshToken });
  assert.equal(logoutRes.status, 200);
  const afterLogout = await request
    .post("/api/auth/refresh")
    .send({ refreshToken: fresh.body.refreshToken });
  assert.equal(afterLogout.status, 401, "logged-out refresh token rejected");

  await injectedPool.end?.();
  await app?.close?.();
});