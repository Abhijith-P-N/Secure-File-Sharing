/**
 * Password tests: scrypt hashing.
 * Areas: weak passwords, brute force (stored hashes).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  validateSharePassword,
  MIN_SHARE_PASSWORD_LENGTH,
} from '../src/security/index.js';

test('hashPassword/verifyPassword roundtrip succeeds', () => {
  const stored = hashPassword('CorrectHorseBatteryStaple');
  assert.match(stored, /^scrypt\$16384\$8\$1\$/);
  assert.equal(verifyPassword('CorrectHorseBatteryStaple', stored), true);
});

test('plaintext password never appears in the stored hash', () => {
  const pw = 'Sup3rS3cret!Password';
  const stored = hashPassword(pw);
  assert.ok(!stored.includes(pw), 'stored hash contains the plaintext password');
  assert.ok(!stored.includes(pw.toLowerCase()));
});

test('wrong password is rejected (server-side verification)', () => {
  const stored = hashPassword('right-password');
  assert.equal(verifyPassword('wrong-password', stored), false);
  assert.equal(verifyPassword('Right-Password', stored), false); // case-sensitive
});

test('same password yields different hashes (unique salt per hash)', () => {
  const a = hashPassword('same-password');
  const b = hashPassword('same-password');
  assert.notEqual(a, b);
  assert.equal(verifyPassword('same-password', a), true);
  assert.equal(verifyPassword('same-password', b), true);
});

test('weak passwords are rejected by policy (weak passwords)', () => {
  assert.throws(() => validateSharePassword('short'), /at least/);
  assert.throws(() => validateSharePassword(''), /at least/);
  assert.throws(() => validateSharePassword(null), /string/);
  assert.equal(validateSharePassword('x'.repeat(MIN_SHARE_PASSWORD_LENGTH)), true);
});

test('verifyPassword is safe against malformed/garbage stored values', () => {
  assert.equal(verifyPassword('pw', ''), false);
  assert.equal(verifyPassword('pw', 'garbage'), false);
  assert.equal(verifyPassword('pw', 'scrypt$not$a$valid$value'), false);
  assert.equal(verifyPassword('pw', 'scrypt$a$b$c$d$e$f$g'), false);
  assert.equal(verifyPassword('pw', null), false);
  assert.equal(verifyPassword(null, 'scrypt$1$1$1$AA==$AA=='), false);
});
