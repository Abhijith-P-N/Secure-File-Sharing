/**
 * Key management.
 *
 * Scope of this project: a single 256-bit master key loaded from the
 * environment at process start. The key is used as a Key Encryption Key (KEK)
 * in an envelope-encryption scheme (see crypto.js): every file gets its own
 * random Data Encryption Key (DEK), and only the DEK is wrapped with this
 * master key. Files therefore never share keys, and the master key never
 * touches file data directly in a way that is reusable across files.
 *
 * Production path (documented in docs/security.md): replace this module with a
 * real KMS/secrets manager while keeping the same public API, so nothing else
 * in the codebase changes.
 */

import { randomBytes } from 'node:crypto';
import { SecurityError } from './errors.js';

export const MASTER_KEY_BYTES = 32; // 256-bit

/**
 * Generate a new base64-encoded 256-bit master key.
 * Use this to create a value for FILE_ENCRYPTION_KEY. Never commit the output.
 */
export function generateMasterKey() {
  return randomBytes(MASTER_KEY_BYTES).toString('base64');
}

/**
 * Load and validate the master key.
 *
 * Accepts the key either as a base64 encoding of 32 bytes (recommended) or as
 * 64 hex characters (32 bytes).
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @param {object} [opts]
 * @param {boolean} [opts.allowEphemeral=false] dev-only: generate an in-memory
 *   key when none is configured. NEVER enable in production.
 * @returns {Buffer} the 32-byte master key
 */
export function loadMasterKey(env = process.env, opts = {}) {
  const raw = env.FILE_ENCRYPTION_KEY ?? env.FILE_ENC_KEY ?? null;

  if (raw) {
    let key;
    if (/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
      key = Buffer.from(raw.trim(), 'hex');
    } else {
      try {
        key = Buffer.from(raw.trim(), 'base64');
      } catch {
        key = null;
      }
    }
    if (!key || key.length !== MASTER_KEY_BYTES) {
      throw new SecurityError(
        'FILE_ENCRYPTION_KEY must be a base64-encoded 32-byte (256-bit) key',
        'INVALID_KEY'
      );
    }
    return key;
  }

  if (opts.allowEphemeral) {
    // Development only: key disappears on restart. The warning must never
    // print the key itself.
    if (typeof opts.warn === 'function') {
      opts.warn(
        '[security] WARNING: no FILE_ENCRYPTION_KEY set; using an ephemeral ' +
          'in-memory key. Files will be undecryptable after restart. ' +
          'NEVER do this in production.'
      );
    }
    return randomBytes(MASTER_KEY_BYTES);
  }

  throw new SecurityError(
    'FILE_ENCRYPTION_KEY is not set. See .env.example.',
    'MISSING_KEY'
  );
}

/** Never allow the key to appear in output. */
export function describeKey(key) {
  const b = Buffer.isBuffer(key) ? key : Buffer.from(key);
  return { algorithm: 'AES-256-GCM', keyBytes: b.length, source: 'environment' };
}
