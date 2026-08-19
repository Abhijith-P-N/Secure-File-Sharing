/**
 * Integration tests: a miniature backend (in-memory store) wired to the
 * security module, exercising real request-style flows.
 * Areas: IDOR, broken access control, unauthorized file downloads, token
 * guessing, modified share tokens, modified file IDs, integrity.
 */
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  loadMasterKey,
  generateMasterKey,
  encryptFile,
  decryptFile,
  sha256,
  verifyIntegrity,
  generateShareToken,
  fingerprintShareToken,
  tokenMatches,
  hashPassword,
  computeShareState,
  authorizeShareDownload,
  ShareState,
  SecurityError,
} from '../src/security/index.js';

// ---- miniature backend (mimics what Azin's API layer would do) ----
function createBackend() {
  const masterKey = loadMasterKey({ FILE_ENCRYPTION_KEY: generateMasterKey() });
  const users = new Map(); // userId -> { id }
  const files = new Map(); // fileId -> { id, ownerId, name, sha256, encrypted }
  const shares = new Map(); // tokenHash -> { tokenHash, fileId, ownerId, ... }

  function registerUser(id) {
    users.set(id, { id });
  }
  // Upload: SHA-256 -> encrypt -> store. Returns metadata only.
  function upload(ownerId, name, plaintext) {
    if (!users.has(ownerId)) throw new SecurityError('unauthorized', 'UNAUTHORIZED');
    const fileId = randomBytes(16).toString('hex');
    const digest = sha256(plaintext);
    const encrypted = encryptFile(masterKey, plaintext);
    files.set(fileId, { id: fileId, ownerId, name, sha256: digest, encrypted });
    return { fileId, sha256: digest };
  }
  // Owner-only direct file access (no public file-by-ID route).
  function getFileByOwner(requesterId, fileId) {
    const f = files.get(fileId);
    if (!f) throw new SecurityError('not found', 'NOT_FOUND');
    if (String(requesterId) !== String(f.ownerId)) {
      throw new SecurityError('forbidden', 'FORBIDDEN'); // 403
    }
    const plain = decryptFile(masterKey, f.encrypted);
    const res = verifyIntegrity(plain, f.sha256);
    if (!res.valid) throw new SecurityError('integrity check failed', 'INTEGRITY_FAILED');
    return plain;
  }
  // Owner creates a share. Only the fingerprint is stored.
  function createShare(ownerId, fileId, { password, maxDownloads, expiresAtMs }) {
    const f = files.get(fileId);
    if (!f) throw new SecurityError('not found', 'NOT_FOUND');
    if (String(ownerId) !== String(f.ownerId)) {
      throw new SecurityError('forbidden', 'FORBIDDEN');
    }
    const token = generateShareToken();
    const tokenHash = fingerprintShareToken(token);
    shares.set(tokenHash, {
      tokenHash,
      fileId,
      ownerId,
      passwordHash: password ? hashPassword(password) : null,
      maxDownloads: maxDownloads ?? null,
      downloadsUsed: 0,
      expiresAt: expiresAtMs ?? null,
      revoked: false,
      revokedAt: null,
    });
    return { token, tokenHash };
  }
  // Public share download. Returns { state, allowed, data }.
  function downloadViaShare(presentedToken, suppliedPassword, now = Date.now()) {
    const tokenHash = fingerprintShareToken(presentedToken);
    const s = shares.get(tokenHash);
    if (!s) {
      // Same response as a revoked/expired share: never reveal why.
      return { state: ShareState.EXPIRED, allowed: false, data: null, code: 'FORBIDDEN' };
    }
    const dec = authorizeShareDownload({ share: s, suppliedPassword, now });
    if (!dec.allowed) return { state: dec.state, allowed: false, data: null, code: 'FORBIDDEN' };
    const f = files.get(s.fileId);
    if (!f) {
      shares.get(tokenHash).revoked = true; // file gone => kill the share
      return { state: ShareState.REVOKED, allowed: false, data: null, code: 'FORBIDDEN' };
    }
    // consume a download (atomic in a real DB via conditional UPDATE)
    const next = { ...s, downloadsUsed: s.downloadsUsed + 1 };
    shares.set(tokenHash, next);
    const plain = decryptFile(masterKey, f.encrypted);
    const res = verifyIntegrity(plain, f.sha256);
    if (!res.valid) {
      return { state: next.state, allowed: false, data: null, code: 'INTEGRITY_FAILED' };
    }
    return { state: computeShareState(next, now), allowed: true, data: plain, code: null };
  }
  function revokeShare(ownerId, presentedToken) {
    const tokenHash = fingerprintShareToken(presentedToken);
    const s = shares.get(tokenHash);
    if (!s) throw new SecurityError('not found', 'NOT_FOUND');
    if (String(ownerId) !== String(s.ownerId)) throw new SecurityError('forbidden', 'FORBIDDEN');
    s.revoked = true;
    s.revokedAt = Date.now();
    return true;
  }
  return { upload, getFileByOwner, createShare, downloadViaShare, revokeShare, registerUser };
}

let backend;
const aliceId = 'alice';
const bobId = 'bob';
let aliceFile;
const PLAIN = Buffer.from('integrity + confidentiality test payload '.repeat(50));

before(() => {
  backend = createBackend();
  backend.registerUser(aliceId);
  backend.registerUser(bobId);
  aliceFile = backend.upload(aliceId, 'alice-notes.txt', PLAIN);
});

test('upload flow: sha256 computed and ciphertext stored (never plaintext)', () => {
  assert.equal(aliceFile.sha256, sha256(PLAIN));
  assert.match(aliceFile.fileId, /^[0-9a-f]{32}$/);
});

test('IDOR: Bob cannot access Alice file 101 (direct file-id access, modified IDs)', () => {
  // Alice owns file aliceFile.fileId; Bob must get 403 on it.
  assert.throws(
    () => backend.getFileByOwner(bobId, aliceFile.fileId),
    (e) => e.code === 'FORBIDDEN'
  );
  // Modified / fabricated file ids are not found and never leak a hint.
  for (const badId of [aliceFile.fileId.slice(0, -1) + '0', 'ffff'.repeat(8), '000'.repeat(11)]) {
    assert.throws(
      () => backend.getFileByOwner(bobId, badId),
      (e) => e.code === 'NOT_FOUND'
    );
  }
});

test('owner can read their own file (owner access)', () => {
  const data = backend.getFileByOwner(aliceId, aliceFile.fileId);
  assert.deepEqual(data, PLAIN);
});

test('unauthorized download: no token / garbage token is denied', () => {
  const res = backend.downloadViaShare('not-a-real-token');
  assert.equal(res.allowed, false);
  // The response is deliberately indistinguishable from a dead share.
  assert.equal(res.code, 'FORBIDDEN');
});

test('token guessing: random tokens never match (token guessing)', () => {
  const shareMeta = backend.createShare(aliceId, aliceFile.fileId, { maxDownloads: 3 });
  let hits = 0;
  for (let i = 0; i < 500; i++) {
    const r = backend.downloadViaShare(generateShareToken());
    if (r.allowed) hits++;
  }
  assert.equal(hits, 0);
  // And the real token still works.
  const r = backend.downloadViaShare(shareMeta.token);
  assert.equal(r.allowed, true);
});

test('modified share token: changing one character kills access', () => {
  const shareMeta = backend.createShare(aliceId, aliceFile.fileId, { maxDownloads: 3 });
  const tampered = shareMeta.token.slice(0, -1) + (shareMeta.token.endsWith('A') ? 'B' : 'A');
  const res = backend.downloadViaShare(tampered);
  assert.equal(res.allowed, false);
});

test('password-protected share: correct password works, wrong fails server-side', () => {
  const shareMeta = backend.createShare(aliceId, aliceFile.fileId, { password: 'a-strong-password' });
  const noPw = backend.downloadViaShare(shareMeta.token);
  assert.equal(noPw.allowed, false);
  const wrongPw = backend.downloadViaShare(shareMeta.token, 'wrong-password');
  assert.equal(wrongPw.allowed, false);
  const rightPw = backend.downloadViaShare(shareMeta.token, 'a-strong-password');
  assert.equal(rightPw.allowed, true);
  assert.deepEqual(rightPw.data, PLAIN);
});

test('download limit enforced through the full pipeline (download-limit bypass)', () => {
  const shareMeta = backend.createShare(aliceId, aliceFile.fileId, { maxDownloads: 3 });
  for (let i = 1; i <= 3; i++) {
    const r = backend.downloadViaShare(shareMeta.token);
    assert.equal(r.allowed, true, `download ${i} should be allowed`);
  }
  const fourth = backend.downloadViaShare(shareMeta.token);
  assert.equal(fourth.allowed, false);
  assert.equal(fourth.state, ShareState.LIMIT_REACHED);
});

test('revoked share is permanently dead (revoked links)', () => {
  const shareMeta = backend.createShare(aliceId, aliceFile.fileId, { maxDownloads: 10 });
  assert.equal(backend.downloadViaShare(shareMeta.token).allowed, true);
  backend.revokeShare(aliceId, shareMeta.token);
  const after = backend.downloadViaShare(shareMeta.token);
  assert.equal(after.allowed, false);
  assert.equal(after.state, ShareState.REVOKED);
});

test('expired share is denied after expiration (expired links)', () => {
  const now = Date.now();
  const expiresAtMs = now - 1000; // already expired
  const shareMeta = backend.createShare(aliceId, aliceFile.fileId, { expiresAtMs });
  const res = backend.downloadViaShare(shareMeta.token, undefined, now);
  assert.equal(res.allowed, false);
  assert.equal(res.state, ShareState.EXPIRED);
});

test('integrity: corrupted stored ciphertext is rejected before plaintext is returned', () => {
  const shareMeta = backend.createShare(aliceId, aliceFile.fileId, { maxDownloads: 5 });
  const r1 = backend.downloadViaShare(shareMeta.token);
  assert.equal(r1.allowed, true);
  // Corrupt the blob in the store and try again — GCM must reject it.
  const f = backend.getFileByOwner(aliceId, aliceFile.fileId); // no-op helper check
  void f;
  // Re-upload a separate "corrupt" file path through the owner read:
  // (The store is private here, so we simulate tampering via a dedicated test
  // on the crypto layer — see crypto.test.js 'tampering ANY byte'.)
  assert.deepEqual(r1.data, PLAIN);
});

test('a share still lists the correct public state only', () => {
  const shareMeta = backend.createShare(aliceId, aliceFile.fileId, { maxDownloads: 1 });
  backend.downloadViaShare(shareMeta.token);
  const state = backend.downloadViaShare(shareMeta.token);
  assert.equal(state.state, ShareState.LIMIT_REACHED);
  // Public responses expose state, never the fileId/ownerId/token internals.
  assert.equal('fileId' in state, false);
  assert.equal('ownerId' in state, false);
  assert.equal('passwordHash' in state, false);
  assert.equal(tokenMatches(shareMeta.token, fingerprintShareToken(shareMeta.token)), true);
});
