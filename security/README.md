# Secure File Sharing Platform — Security Layer

Security & encryption module for the Secure File Sharing Platform.
Repo owners: **Haroon** (frontend), **Azin** (backend/API), **Adhil** (security), **Abhi** (DB/storage/DevOps).

**Maintainer of this layer: Adhil (Security & Encryption).**

## What this is

A **reusable, zero-dependency security module** (`src/security/`) wiring documented
crypto, key management, share tokens, and access control into a single API, plus
complete security documentation (`docs/security.md`).

- **Encryption:** AES-256-GCM, envelope scheme (per-file key wrapped by a master key)
- **Integrity:** SHA-256 verified on download (two independent layers: GCM + SHA-256)
- **Tokens:** 256-bit CSPRNG share tokens; only a SHA-256 fingerprint is stored
- **Share passwords:** scrypt (memory-hard) hashing, server-side verification
- **Access control:** share state machine `ACTIVE / EXPIRED / REVOKED / LIMIT_REACHED`

It builds only on Node's built-in `crypto` (OpenSSL). **No cryptographic algorithm
is implemented by hand.** No third-party runtime dependencies.

## Layout

```
src/security/            reusable security module (world-readable, self-contained)
  index.js               public API
  crypto.js              AES-256-GCM envelope encryption/decryption
  hashing.js             SHA-256 hashing + constant-time integrity comparison
  tokens.js              CSPRNG share tokens + fingerprinting
  passwords.js           scrypt share-password hashing/verification
  accessControl.js       share state machine, owner/share authorization, rate limiter
  keyManagement.js       master-key loading/validation from environment
  errors.js              sanitized error types (no internal details leak)
examples/
  securityServer.mjs     reference HTTP server (zero-dep) for manual testing
  fullDemo.mjs           console walk-through of the whole pipeline
tests/
  *.test.js              59 automated security tests (node --test)
scripts/
  security-test.sh       36 live curl checks against the reference server
docs/
  security.md            threat model, architecture, crypto design, test results
```

## Quick start

```bash
# Security module tests (59 automated checks covering all 13 test areas)
npm test

# Console pipeline demo
npm run demo

# Live server + curl security tests (36 checks: IDOR, revocation, expiration, limits, tamper...)
npm run security:test

# Start the reference server for Burp Suite / OWASP ZAP / Postman
FILE_ENCRYPTION_KEY="$(openssl rand -base64 32)" npm run server
# dev-only fallback (key lost on restart):
ALLOW_EPHEMERAL_KEY=1 npm run server
```

### Generating a real master key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
# put the output in .env  ->  FILE_ENCRYPTION_KEY=<value>
# .env is gitignored. Never commit it, never log it.
```

## How the pieces protect the app (short version)

| Concern             | Mechanism                                                                                    |
|---------------------|----------------------------------------------------------------------------------------------|
| Confidentiality     | AES-256-GCM. Every file gets a unique random key + IV (never reused).                         |
| Integrity           | GCM auth tag + SHA-256 re-verification on download; compare stored vs recomputed hash.        |
| Share tokens        | 256-bit CSPRNG, opaque; only their SHA-256 fingerprint is persisted.                          |
| Share passwords     | scrypt hashed; verified server-side; brute force rate-limited (429).                          |
| Expiry / limits     | State machine; `EXPIRED`/`LIMIT_REACHED`/`REVOKED` are terminal, never reactivated.            |
| Access control      | Owners only; shares only via valid token; no public file-by-ID route.                         |
| Key management      | Envelope encryption; master key from environment/KMS; per-file DEKs.                          |

## Team integration

- **Azin (Backend/API):** consume `src/security/index.js`. Store only
  `fingerprintShareToken(token)` in `shares`; decrement the download counter with
  one atomic conditional UPDATE; call `authorizeShareDownload()` per request.
- **Abhi (DB/Storage/DevOps):** store encrypted containers (`.enc`) in object
  storage keyed by opaque file ID; keep only SHA-256 + token fingerprints in the
  DB; provision FILE_ENCRYPTION_KEY via secrets manager/KMS.
- **Haroon (Frontend):** render share state from `GET /api/shares/:token/status`
  (`ACTIVE/EXPIRED/REVOKED/LIMIT_REACHED`); never place tokens or keys in client code.

See `docs/security.md` for the full design, threat model, and testing results.

## Security testing tools

Wrap `npm run security:test` traffic through **Burp Suite** or **OWASP ZAP**
interceptor to capture evidence, then run **Postman** collections / `curl` against
the reference server (examples/securityServer.mjs, port 8080 by default).

## License

UNLICENSED — internal project deliverable.