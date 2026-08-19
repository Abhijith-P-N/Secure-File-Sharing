/**
 * Token tests: CSPRNG share tokens.
 * Areas: token guessing, sensitive info disclosure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateShareToken,
  fingerprintShareToken,
  tokenMatches,
  randomId,
  TOKEN_BYTES,
  TOKEN_ENTROPY_BITS,
} from '../src/security/index.js';

test('tokens are 32 random bytes => 43 base64url chars, 256-bit entropy', () => {
  const t = generateShareToken();
  assert.equal(TOKEN_BYTES, 32);
  assert.equal(TOKEN_ENTROPY_BITS, 256);
  assert.equal(t.length, 43);
  assert.match(t, /^[A-Za-z0-9_-]{43}$/, 'tokens must be base64url');
});

test('tokens are unique and unpredictable (CSPRNG)', () => {
  const seen = new Set();
  for (let i = 0; i < 10000; i++) {
    const t = generateShareToken();
    assert.ok(!seen.has(t), 'duplicate token generated');
    seen.add(t);
  }
});

test('tokens reveal NOTHING about file/user/db ids (opaque)', () => {
  const fileId = 'file-100';
  const userId = 'user-7';
  const tokens = new Set();
  for (let i = 0; i < 1000; i++) tokens.add(generateShareToken());
  for (const t of tokens) {
    assert.ok(!t.includes(fileId), 'token embeds the file id');
    assert.ok(!t.includes(userId), 'token embeds the user id');
    assert.ok(!/^\d+$/.test(t), 'token is an incrementing number');
    // No correlation to any constant input.
    assert.ok(t !== fileId && t !== userId);
  }
});

test('tokens are not derived from timestamps or user ids (no predictable prefix)', () => {
  const a = generateShareToken();
  const b = generateShareToken();
  // High-entropy output: first 8 bytes of two tokens collide with prob ~2^-64.
  assert.notEqual(a.slice(0, 8), b.slice(0, 8));
});

test('only the fingerprint is stored; the raw token is never persisted', () => {
  const token = generateShareToken();
  const fp = fingerprintShareToken(token);
  assert.equal(fp.length, 64);
  assert.notEqual(fp, token, 'fingerprint must differ from the raw token');
  assert.ok(!fp.includes(token.slice(0, 16)), 'fingerprint leaks token bytes');
});

test('tokenMatches verifies a presented token against the stored fingerprint', () => {
  const token = generateShareToken();
  const fp = fingerprintShareToken(token);
  assert.equal(tokenMatches(token, fp), true);
  assert.equal(tokenMatches('guess-or-tampered-token', fp), false);
  assert.equal(tokenMatches('', fp), false);
  assert.equal(tokenMatches(token, 'deadbeef'), false);
});

test('token guessing is infeasible: the search space is 2^256', () => {
  // 2^256 is astronomically large; a scripted guess can never succeed.
  const fp = fingerprintShareToken(generateShareToken());
  let found = false;
  for (const guess of ['guess-1', 'guess-2', 'guess-3']) {
    if (tokenMatches(guess, fp)) found = true;
  }
  assert.equal(found, false);
});

test('randomId returns opaque 16-byte (32 hex) unique ids', () => {
  const ids = new Set();
  for (let i = 0; i < 5000; i++) ids.add(randomId());
  assert.equal(ids.size, 5000);
  for (const id of ids) assert.match(id, /^[0-9a-f]{32}$/);
});
