/**
 * Hashing / integrity verification (SHA-256).
 *
 * The SHA-256 of the original (plaintext) file is computed at upload time and
 * stored in the metadata layer (database). At download time, after the file is
 * decrypted and GCM-authenticated, we recompute SHA-256 and compare it to the
 * stored value with a constant-time comparison.
 *
 * Two independent integrity layers:
 *   1. GCM authentication tag — detects any tampering of ciphertext in transit
 *      or at rest (bit flips, truncation, key mismatch).
 *   2. SHA-256 comparison — detects logical corruption such as the metadata
 *      row pointing at the wrong file object, or a swapped blob in storage.
 *
 * SHA-256 is collision-resistant and one-way; it is NOT used as a password
 * hash (see passwords.js for scrypt).
 */

import { createHash, timingSafeEqual } from 'node:crypto';

/** SHA-256 hex digest of arbitrary bytes. */
export function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

/** SHA-256 raw digest (Buffer) of arbitrary bytes. */
export function sha256Raw(data) {
  return createHash('sha256').update(data).digest();
}

/**
 * Constant-time comparison of two hex digests. Returns true when equal.
 * Timing-safe so a response time does not leak how many leading bytes match.
 */
export function safeHexEquals(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

/**
 * Verify that `data` matches `expectedSha256`.
 *
 * @returns {{ valid: boolean, actual: string, expected: string }}
 *   valid === true  → MATCH, integrity verified
 *   valid === false → MISMATCH, reject/warn
 */
export function verifyIntegrity(data, expectedSha256) {
  const actual = sha256(data);
  return { valid: safeHexEquals(actual, expectedSha256), actual, expected: expectedSha256 };
}

/** Compute the hash used to look up a share token (token fingerprint). */
export function hashShareToken(token) {
  return sha256(token);
}
