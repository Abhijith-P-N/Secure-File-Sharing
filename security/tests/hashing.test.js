/**
 * Hashing tests: SHA-256 integrity verification.
 * Areas: hash mismatch, integrity.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sha256,
  sha256Raw,
  safeHexEquals,
  verifyIntegrity,
  hashShareToken,
} from '../src/security/index.js';

test('sha256 matches the NIST test vector for "abc"', () => {
  assert.equal(
    sha256('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('verifyIntegrity: MATCH for identical bytes', () => {
  const data = Buffer.from('the quick brown fox');
  const digest = sha256(data);
  const res = verifyIntegrity(data, digest);
  assert.equal(res.valid, true);
  assert.equal(res.actual, digest);
});

test('verifyIntegrity: MISMATCH is detected (hash mismatch)', () => {
  const data = Buffer.from('the quick brown fox');
  const tampered = Buffer.from('the quick brown fix'); // one byte different
  const res = verifyIntegrity(tampered, sha256(data));
  assert.equal(res.valid, false);
});

test('integrity comparison is constant-time (safeHexEquals)', () => {
  assert.equal(safeHexEquals('abcd', 'abcd'), true);
  assert.equal(safeHexEquals('abcd', 'abce'), false);
  assert.equal(safeHexEquals('abcd', 'abc'), false);
  assert.equal(safeHexEquals('abcd', 1234), false);
  assert.equal(safeHexEquals(null, null), false);
});

test('sha256Raw returns a 32-byte buffer', () => {
  const raw = sha256Raw('x');
  assert.equal(raw.length, 32);
});

test('share-token fingerprints are sha256 (64 hex chars, one-way)', () => {
  const fp = hashShareToken('some-token');
  assert.match(fp, /^[0-9a-f]{64}$/);
  assert.equal(fp, sha256('some-token'));
});
