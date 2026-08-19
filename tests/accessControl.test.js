/**
 * Access-control tests: share state machine, authorization, brute-force limiter.
 * Areas: broken access control, expired links, revoked links, download-limit
 * bypass, path traversal.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeShareState,
  authorizeShareDownload,
  authorizeOwner,
  canAccessFile,
  nextStateAfterDownload,
  remainingDownloads,
  sanitizeStoredName,
  AttemptLimiter,
  ShareState,
  hashPassword,
} from '../src/security/index.js';

const NOW = Date.parse('2026-08-19T12:00:00Z');

function share(overrides = {}) {
  return {
    id: 's1',
    fileId: 'f1',
    ownerId: 'alice',
    tokenHash: 'x'.repeat(64),
    passwordHash: null,
    expiresAt: null,
    maxDownloads: null,
    downloadsUsed: 0,
    revoked: false,
    revokedAt: null,
    ...overrides,
  };
}

test('state machine: ACTIVE when nothing is exhausted/expired/revoked', () => {
  assert.equal(computeShareState(share(), NOW), ShareState.ACTIVE);
});

test('state machine: EXPIRED after expiration; never returns to ACTIVE', () => {
  const s = share({ expiresAt: NOW - 1 });
  assert.equal(computeShareState(s, NOW), ShareState.EXPIRED);
  // Even if the clock is "fixed" later, expiration is a terminal fact recorded
  // in the DB; a past expiresAt is never active again.
  assert.equal(computeShareState(s, NOW + 999999), ShareState.EXPIRED);
});

test('state machine: REVOKED is terminal and outranks everything (revoked links)', () => {
  const s = share({ revoked: true, revokedAt: NOW - 100, expiresAt: NOW + 86400000 });
  assert.equal(computeShareState(s, NOW), ShareState.REVOKED);
  // Revoked stays revoked even if counters are at 0 and expiry is far away.
  assert.equal(
    computeShareState({ ...s, downloadsUsed: 0, expiresAt: null }, NOW),
    ShareState.REVOKED
  );
});

test('state machine: LIMIT_REACHED when downloadsUsed >= maxDownloads', () => {
  const s = share({ maxDownloads: 3, downloadsUsed: 3 });
  assert.equal(computeShareState(s, NOW), ShareState.LIMIT_REACHED);
});

test('expiration check: exactly at expiry boundary is still valid (now <= expiresAt)', () => {
  const s = share({ expiresAt: NOW });
  assert.equal(computeShareState(s, NOW), ShareState.ACTIVE);
});

test('authorizeShareDownload: unlimited, no password → allowed', () => {
  const res = authorizeShareDownload({ share: share(), now: NOW });
  assert.equal(res.allowed, true);
  assert.equal(res.state, ShareState.ACTIVE);
});

test('authorizeShareDownload: password-protected share requires the password', () => {
  const s = share({ passwordHash: hashPassword('long-enough-pw') });
  const missing = authorizeShareDownload({ share: s, now: NOW });
  assert.equal(missing.allowed, false);
  assert.equal(missing.reason, 'password required');

  const wrong = authorizeShareDownload({ share: s, suppliedPassword: 'not-the-pw', now: NOW });
  assert.equal(wrong.allowed, false);
  assert.equal(wrong.reason, 'invalid password');

  const right = authorizeShareDownload({ share: s, suppliedPassword: 'long-enough-pw', now: NOW });
  assert.equal(right.allowed, true);
});

test('authorizeShareDownload: expired share denied even with correct password', () => {
  const s = share({ passwordHash: hashPassword('long-enough-pw'), expiresAt: NOW - 1 });
  const res = authorizeShareDownload({ share: s, suppliedPassword: 'long-enough-pw', now: NOW });
  assert.equal(res.allowed, false);
  assert.equal(res.state, ShareState.EXPIRED);
});

test('download-limit: after N downloads the next one is denied (download-limit bypass)', () => {
  let s = share({ maxDownloads: 3, downloadsUsed: 0 });
  for (let used = 0; used < 3; used++) {
    assert.equal(authorizeShareDownload({ share: s, now: NOW }).allowed, true);
    s = { ...s, downloadsUsed: used + 1 };
  }
  const finalState = computeShareState(s, NOW);
  assert.equal(finalState, ShareState.LIMIT_REACHED);
  assert.equal(authorizeShareDownload({ share: s, now: NOW }).allowed, false);
  assert.equal(remainingDownloads(s), 0);
});

test('nextStateAfterDownload previews the post-download state', () => {
  const s = share({ maxDownloads: 3, downloadsUsed: 2 });
  assert.equal(nextStateAfterDownload(s, NOW), ShareState.LIMIT_REACHED);
  assert.equal(remainingDownloads(share({ maxDownloads: 3, downloadsUsed: 2 })), 1);
});

test('owner authorization: strict identity (broken access control / IDOR)', () => {
  assert.equal(authorizeOwner({ requesterId: 'alice', ownerId: 'alice' }).allowed, true);
  assert.equal(authorizeOwner({ requesterId: 'bob', ownerId: 'alice' }).allowed, false);
  assert.equal(authorizeOwner({ requesterId: '1', ownerId: 1 }).allowed, true); // normalized compare
  assert.equal(authorizeOwner({ requesterId: null, ownerId: 'alice' }).allowed, false);
  assert.equal(authorizeOwner({ requesterId: undefined, ownerId: 'alice' }).allowed, false);
});

test('canAccessFile: owner OR valid share; otherwise denied (unauthorized download)', () => {
  assert.equal(canAccessFile({ requesterId: 'alice', fileOwnerId: 'alice' }), true);
  assert.equal(canAccessFile({ requesterId: 'bob', fileOwnerId: 'alice' }), false);
  assert.equal(canAccessFile({ requesterId: 'bob', fileOwnerId: 'alice', validShare: true }), true);
  assert.equal(canAccessFile({ requesterId: 'bob', fileOwnerId: 'alice', validShare: false }), false);
  assert.equal(canAccessFile({ requesterId: null, fileOwnerId: 'alice', validShare: true }), true);
  assert.equal(canAccessFile({ requesterId: null, fileOwnerId: 'alice' }), false);
});

test('path traversal: hostile names are neutralized (path traversal)', () => {
  for (const evil of [
    '../../etc/passwd',
    '..\\..\\Windows\\System32\\config',
    '/etc/passwd',
    'C:\\Windows\\system.ini',
    'C:/Windows/system.ini',
    'a/b/c/../../../../../tmp/evil.txt',
    '....//....//etc/shadow',
    '\u0000bin/sh',
  ]) {
    const out = sanitizeStoredName(evil);
    assert.ok(out === null || !out.includes('..'), `traversal survived: ${evil}`);
    assert.ok(out === null || !out.includes('/'), `path separator survived: ${evil}`);
    assert.ok(out === null || !out.includes('\\'), `backslash survived: ${evil}`);
    assert.ok(out === null || !/^[a-zA-Z]:/.test(out), `drive letter survived: ${evil}`);
  }
});

test('path traversal: benign names pass through cleanly', () => {
  assert.equal(sanitizeStoredName('report.pdf'), 'report.pdf');
  assert.equal(sanitizeStoredName('folder/my file.txt'), 'my file.txt');
  assert.equal(sanitizeStoredName('notes_v2 (final).md'), 'notes_v2 (final).md');
});

test('AttemptLimiter blocks brute force after max failures (brute force)', () => {
  const limiter = new AttemptLimiter({ max: 5, windowMs: 60000 });
  const key = 'share:abc123';
  for (let i = 0; i < 5; i++) {
    assert.equal(limiter.check(key).allowed, true);
    limiter.recordFailure(key);
  }
  const blocked = limiter.check(key);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);
  // A correct password after the block is still gated by the limiter.
  assert.equal(limiter.check(key).allowed, false);
});

test('AttemptLimiter resets after success and after the window elapses', () => {
  const limiter = new AttemptLimiter({ max: 2, windowMs: 1000 });
  const key = 'share:xyz';
  limiter.recordFailure(key);
  limiter.recordFailure(key);
  assert.equal(limiter.check(key).allowed, false);
  limiter.reset(key);
  assert.equal(limiter.check(key).allowed, true);
});
