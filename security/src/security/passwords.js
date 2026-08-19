/**
 * Password hashing for password-protected shares.
 *
 * Uses scrypt (RFC 7914) — a memory-hard key-derivation function designed to
 * resist GPU/ASIC brute force. Never store or transmit a plaintext password;
 * only the scrypt-derived hash is stored.
 *
 * Stored format (self-describing, portable):
 *   scrypt$N$r$p$salt_b64$hash_b64
 *     N=16384, r=8, p=1, keylen=64, salt=16 random bytes (unique per password)
 *
 * Verification uses crypto.timingSafeEqual to avoid timing side channels.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { SecurityError } from './errors.js';

export const SCRYPT = {
  N: 16384, // CPU/memory cost (2^14). For high security consider 2^15+.
  r: 8,
  p: 1,
  keylen: 64,
  saltBytes: 16,
};

export const MIN_SHARE_PASSWORD_LENGTH = 8;

/** Validate a user-supplied share password against policy. */
export function validateSharePassword(password) {
  if (typeof password !== 'string') {
    throw new SecurityError('password must be a string', 'INVALID_PASSWORD');
  }
  if (password.length < MIN_SHARE_PASSWORD_LENGTH) {
    throw new SecurityError(
      `password must be at least ${MIN_SHARE_PASSWORD_LENGTH} characters`,
      'WEAK_PASSWORD'
    );
  }
  return true;
}

/**
 * Hash a password with scrypt.
 * @returns {string} format: scrypt$N$r$p$salt$hash
 */
export function hashPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new SecurityError('password required', 'INVALID_PASSWORD');
  }
  const salt = randomBytes(SCRYPT.saltBytes);
  const derived = scryptSync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

/**
 * Verify a supplied password against a stored scrypt hash.
 * Returns boolean; never throws on a wrong password.
 */
export function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') return false;
  const parts = storedHash.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const N = Number(n);
  const rr = Number(r);
  const pp = Number(p);
  if (!Number.isInteger(N) || !Number.isInteger(rr) || !Number.isInteger(pp)) return false;
  let derived;
  let expected;
  try {
    derived = scryptSync(password, Buffer.from(saltB64, 'base64'), SCRYPT.keylen, {
      N,
      r: rr,
      p: pp,
    });
    expected = Buffer.from(hashB64, 'base64');
  } catch {
    return false;
  }
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
