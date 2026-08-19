/**
 * File encryption using AES-256-GCM with envelope encryption.
 *
 * Scheme (each file):
 *
 *   plaintext
 *     │
 *     ├── random Data Encryption Key (DEK, 32 bytes, one per file)
 *     ├── random file IV (12 bytes, unique per file)
 *     └── AES-256-GCM(DEK, fileIV, plaintext)  ──► ciphertext + fileTag
 *
 *   DEK is itself protected (envelope encryption):
 *     ├── random wrap IV (12 bytes, unique per wrap)
 *     └── AES-256-GCM(masterKey, wrapIV, DEK)  ──► wrappedDEK + wrapTag
 *
 *   Container layout (self-contained, fixed header):
 *     [ 0: 8] MAGIC   "SFSENC01"
 *     [ 8:20] wrapIv   (12)
 *     [20:36] wrapTag  (16)
 *     [36:68] wrappedDEK (32)
 *     [68:80] fileIv  (12)
 *     [80:96] fileTag (16)
 *     [96:  ] ciphertext
 *
 * Why this design:
 *   - AES-256-GCM gives both confidentiality and authenticated integrity in
 *     one primitive (GCM = Galois/Counter Mode, a NIST standard AEAD).
 *   - Every file gets a unique DEK and a unique IV; the master key is used
 *     only to wrap DEKs, each time with a fresh random IV. No IV is ever
 *     reused with the same key, which is the fatal GCM mistake.
 *   - A corrupted/tampered ciphertext, header, or wrong key is rejected by
 *     GCM authentication before any plaintext is returned.
 *
 * Uses Node.js `crypto`, which is a thin binding to OpenSSL (a vetted,
 * established cryptographic library). No cryptographic algorithm is
 * implemented by hand.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { SecurityError } from './errors.js';

export const MAGIC = Buffer.from('SFSENC01', 'ascii');
export const MAGIC_LEN = MAGIC.length; // 8
export const IV_LEN = 12; // NIST recommendation for GCM
export const TAG_LEN = 16; // GCM tag in bytes
export const DEK_LEN = 32; // 256-bit Data Encryption Key
export const WRAPPED_DEK_LEN = DEK_LEN; // GCM ciphertext == plaintext length
export const HEADER_LEN = MAGIC_LEN + IV_LEN + TAG_LEN + WRAPPED_DEK_LEN + IV_LEN + TAG_LEN; // 96

/** Validate the master key (must be a 32-byte Buffer). */
function assertMasterKey(masterKey) {
  if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) {
    throw new SecurityError('invalid master key', 'INVALID_KEY');
  }
}

/**
 * Encrypt a file buffer.
 *
 * @param {Buffer} masterKey 32-byte KEK loaded from environment
 * @param {Buffer|string|Uint8Array} plaintext original file bytes
 * @returns {Buffer} self-contained encrypted container
 */
export function encryptFile(masterKey, plaintext) {
  assertMasterKey(masterKey);
  const data = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext);

  // Per-file, per-wrap random values. randomBytes uses a CSPRNG.
  const dek = randomBytes(DEK_LEN);
  const wrapIv = randomBytes(IV_LEN);
  const fileIv = randomBytes(IV_LEN);

  // 1) Wrap the DEK under the master key.
  const wrapCipher = createCipheriv('aes-256-gcm', masterKey, wrapIv);
  const wrappedDEK = Buffer.concat([wrapCipher.update(dek), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();

  // 2) Encrypt the file under the (unique) DEK.
  const fileCipher = createCipheriv('aes-256-gcm', dek, fileIv);
  const ciphertext = Buffer.concat([fileCipher.update(data), fileCipher.final()]);
  const fileTag = fileCipher.getAuthTag();

  return Buffer.concat([MAGIC, wrapIv, wrapTag, wrappedDEK, fileIv, fileTag, ciphertext]);
}

/**
 * Decrypt a container produced by encryptFile().
 *
 * @param {Buffer} masterKey 32-byte KEK
 * @param {Buffer} container encrypted container
 * @returns {Buffer} plaintext bytes
 * @throws {SecurityError} on invalid format, wrong key, or tampered data
 */
export function decryptFile(masterKey, container) {
  assertMasterKey(masterKey);
  const buf = Buffer.isBuffer(container) ? container : Buffer.from(container);

  if (buf.length < HEADER_LEN) {
    throw new SecurityError('invalid encrypted file container', 'INVALID_CONTAINER');
  }
  if (!buf.subarray(0, MAGIC_LEN).equals(MAGIC)) {
    throw new SecurityError('invalid encrypted file container', 'INVALID_CONTAINER');
  }

  let off = MAGIC_LEN;
  const wrapIv = buf.subarray(off, (off += IV_LEN));
  const wrapTag = buf.subarray(off, (off += TAG_LEN));
  const wrappedDEK = buf.subarray(off, (off += WRAPPED_DEK_LEN));
  const fileIv = buf.subarray(off, (off += IV_LEN));
  const fileTag = buf.subarray(off, (off += TAG_LEN));
  const ciphertext = buf.subarray(off);

  // Unwrap the DEK. Failure here means wrong master key or tampered header.
  let dek;
  try {
    const wrapDecipher = createDecipheriv('aes-256-gcm', masterKey, wrapIv);
    wrapDecipher.setAuthTag(wrapTag);
    dek = Buffer.concat([wrapDecipher.update(wrappedDEK), wrapDecipher.final()]);
  } catch {
    throw new SecurityError(
      'failed to decrypt file: authentication failed',
      'FILE_DECRYPT_FAILED'
    );
  }

  // Decrypt + authenticate the file. Any bit flip in ciphertext/header fails here.
  try {
    const fileDecipher = createDecipheriv('aes-256-gcm', dek, fileIv);
    fileDecipher.setAuthTag(fileTag);
    return Buffer.concat([fileDecipher.update(ciphertext), fileDecipher.final()]);
  } catch {
    throw new SecurityError(
      'failed to decrypt file: authentication failed (tampered data)',
      'FILE_DECRYPT_FAILED'
    );
  }
}
