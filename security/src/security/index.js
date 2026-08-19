/**
 * Secure File Sharing Platform — security module (public API).
 *
 * Zero runtime dependencies. Everything builds on Node.js `crypto`, which is a
 * binding to OpenSSL (a vetted, established cryptographic library). No
 * cryptographic algorithm is implemented manually.
 *
 * Usage:
 *   import * as security from './src/security/index.js';
 *
 *   const key = security.loadMasterKey(process.env);
 *   const blob = security.encryptFile(key, fileBuffer);
 *   const clear = security.decryptFile(key, blob);          // GCM-authenticated
 *   const digest = security.sha256(clear);                  // integrity
 *   const token = security.generateShareToken();            // CSPRNG, opaque
 *   const state = security.computeShareState(shareRow, Date.now());
 *   const decision = security.authorizeShareDownload({ share, suppliedPassword });
 */

export * from './errors.js';
export * from './keyManagement.js';
export * from './crypto.js';
export * from './hashing.js';
export * from './passwords.js';
export * from './tokens.js';
export * from './accessControl.js';
