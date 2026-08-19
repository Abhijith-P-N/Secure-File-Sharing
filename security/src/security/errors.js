/**
 * Security errors.
 *
 * A single, stable error type keeps sensitive details out of error messages.
 * Raw library errors (which can leak library versions, key sizes, or internal
 * state) are intentionally swallowed and replaced with a generic message and
 * an opaque machine-readable code. This is part of the
 * "sensitive information disclosure" mitigation.
 */

export class SecurityError extends Error {
  /**
   * @param {string} message  human-readable, NON-SENSITIVE message (safe to log)
   * @param {string} code     stable machine-readable code returned to clients
   */
  constructor(message, code = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
  }
}

/** Build a SecurityError and log it without echoing sensitive data. */
export function fail(code, message, logger = null) {
  if (logger && typeof logger.warn === 'function') {
    // The message is sanitized by construction (no keys, no tokens, no paths).
    logger.warn(`[security] ${code}: ${message}`);
  }
  return new SecurityError(message, code);
}
