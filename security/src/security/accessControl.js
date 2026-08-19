/**
 * Access control and share state machine.
 *
 * Share lifecycle states:
 *
 *   ACTIVE  ────────────────────────────────────────────┐
 *     │  (revoked)                                       │
 *     ├──────────► REVOKED   (terminal, permanent)       │
 *     │  (expiresAt passed)                              │
 *     ├──────────► EXPIRED   (terminal)                  │
 *     │  (downloadsUsed >= maxDownloads)                 │
 *     └──────────► LIMIT_REACHED (terminal)              │
 *
 * Terminal states are never revisited: a REVOKED share stays revoked even if
 * its expiry date is in the future and its download counter is below the
 * limit. State is derived from persisted fields (revoked flag/revokedAt,
 * expiresAt, downloadsUsed, maxDownloads), so it can be recomputed on every
 * request and is safe against tampering of client-side state.
 *
 * Authorization model:
 *   - Owner access: the authenticated file owner may access the file without a
 *     share token.
 *   - Shared access: a valid (ACTIVE) share with correct password.
 *   - Everything else is denied with 403/404. There is no public file-by-ID
 *     route; file IDs are opaque 128-bit random values.
 */

import { SecurityError } from './errors.js';
import { verifyPassword } from './passwords.js';

export const ShareState = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  LIMIT_REACHED: 'LIMIT_REACHED',
});

export const AccessDecision = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
});

/**
 * Compute the current state of a share from its persisted fields.
 *
 * @param {object} share persisted share row
 * @param {number} [now=Date.now()] epoch ms (injectable for tests)
 */
export function computeShareState(share, now = Date.now()) {
  // REVOKED wins over everything else and is permanent.
  if (share.revoked === true || share.revokedAt != null) return ShareState.REVOKED;
  if (share.expiresAt != null && now > share.expiresAt) return ShareState.EXPIRED;
  if (
    share.maxDownloads != null &&
    share.downloadsUsed != null &&
    share.downloadsUsed >= share.maxDownloads
  ) {
    return ShareState.LIMIT_REACHED;
  }
  return ShareState.ACTIVE;
}

/**
 * Authorize a share download attempt.
 *
 * @param {object} params
 * @param {object} params.share persisted share row
 * @param {string|undefined} [params.suppliedPassword] password from the caller
 * @param {number} [params.now]
 * @returns {{ allowed: boolean, state: string, reason: string|null }}
 */
export function authorizeShareDownload({ share, suppliedPassword, now = Date.now() }) {
  const state = computeShareState(share, now);

  if (state !== ShareState.ACTIVE) {
    return { allowed: false, state, reason: `share is ${state.toLowerCase()}` };
  }

  if (share.passwordHash) {
    if (typeof suppliedPassword !== 'string' || suppliedPassword.length === 0) {
      return { allowed: false, state, reason: 'password required' };
    }
    if (!verifyPassword(suppliedPassword, share.passwordHash)) {
      return { allowed: false, state, reason: 'invalid password' };
    }
  }

  return { allowed: true, state, reason: null };
}

/**
 * Return the share state as it will become after one more successful download.
 * The backend should persist `downloadsUsed + 1` in a single atomic/conditional
 * update (e.g. `UPDATE shares SET downloads_used = downloads_used + 1 WHERE
 * token_hash = $1 AND downloads_used < max_downloads`) so the counter can never
 * be bypassed by concurrent requests.
 */
export function nextStateAfterDownload(share, now = Date.now()) {
  const next = { ...share, downloadsUsed: (share.downloadsUsed ?? 0) + 1 };
  return computeShareState(next, now);
}

/** Remaining downloads before LIMIT_REACHED (Infinity when unlimited). */
export function remainingDownloads(share) {
  if (share.maxDownloads == null) return Infinity;
  return Math.max(0, share.maxDownloads - (share.downloadsUsed ?? 0));
}

/**
 * Owner authorization. Strict string comparison; returns a decision object so
 * callers can reply consistently.
 */
export function authorizeOwner({ requesterId, ownerId }) {
  const allowed =
    requesterId != null && ownerId != null && String(requesterId) === String(ownerId);
  return {
    allowed,
    decision: allowed ? AccessDecision.ALLOW : AccessDecision.DENY,
    reason: allowed ? null : 'forbidden',
  };
}

/**
 * Can a requester access a given file?
 *  - owner (authenticated as the file owner) → yes
 *  - otherwise only via a share that has already been authorized for that file
 *
 * @param {object} params
 * @param {string|null} params.requesterId
 * @param {string} params.fileOwnerId
 * @param {boolean} [params.validShare] true when the caller presented a share
 *   token that was authorized for this file
 */
export function canAccessFile({ requesterId, fileOwnerId, validShare = false }) {
  if (requesterId != null && String(requesterId) === String(fileOwnerId)) return true;
  return validShare === true;
}

/**
 * In-memory attempt limiter for brute-force protection on share passwords
 * (and, in production, for login endpoints). Sliding window per key.
 */
export class AttemptLimiter {
  /**
   * @param {object} [opts]
   * @param {number} [opts.max=5] max failures within the window
   * @param {number} [opts.windowMs=900000] window length in ms (15 min)
   */
  constructor({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
    this.max = max;
    this.windowMs = windowMs;
    this.records = new Map(); // key → { failures, windowStart }
  }

  /** @returns {{ allowed: boolean, failures: number, retryAfterMs: number }} */
  check(key) {
    this._prune();
    const rec = this.records.get(key);
    if (!rec) return { allowed: true, failures: 0, retryAfterMs: 0 };
    const elapsed = Date.now() - rec.windowStart;
    if (rec.failures >= this.max) {
      return { allowed: false, failures: rec.failures, retryAfterMs: Math.max(0, this.windowMs - elapsed) };
    }
    return { allowed: true, failures: rec.failures, retryAfterMs: 0 };
  }

  recordFailure(key) {
    const now = Date.now();
    const rec = this.records.get(key);
    if (!rec || now - rec.windowStart >= this.windowMs) {
      this.records.set(key, { failures: 1, windowStart: now });
    } else {
      rec.failures += 1;
    }
  }

  reset(key) {
    this.records.delete(key);
  }

  _prune() {
    const now = Date.now();
    for (const [k, rec] of this.records) {
      if (now - rec.windowStart >= this.windowMs) this.records.delete(k);
    }
  }
}

/**
 * Path-traversal guard for client-supplied file names. Returns a safe basename
 * or null when the name is unusable. Storage should always write to a fixed
 * directory using the file's random ID, never the client-supplied name — this
 * guard is defense in depth for metadata/display.
 */
export function sanitizeStoredName(name) {
  if (typeof name !== 'string') return null;
  let n = name;
  if (n.includes('\u0000')) return null;
  // Normalize separators, strip drive letters and leading dots.
  n = n.replace(/\\/g, '/');
  const parts = n.split('/').filter((p) => p.length > 0 && p !== '.' && p !== '..');
  if (parts.length === 0) return null;
  const base = parts[parts.length - 1];
  if (/^[a-zA-Z]:/.test(base)) return null; // drive letter (Windows)
  if (base.length > 255) return null;
  return base;
}

/** Uniform helper to throw a non-informative access-denied error. */
export function denyAccess(reason = 'forbidden', code = 'FORBIDDEN') {
  throw new SecurityError(reason, code);
}
