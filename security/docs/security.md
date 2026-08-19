# Security Documentation — Secure File Sharing Platform

**Owner:** Adhil (Security & Encryption)
**Reviewed with:** Haroon (Frontend), Azin (Backend/API), Abhi (Database/Storage/DevOps)
**Status:** Implemented and tested (59 automated tests + 36 live HTTP checks, all passing)

---

## 1. Scope and Objectives

This document covers the security layer of the Secure File Sharing Platform:

1. Confidentiality — files are encrypted at rest and in transit.
2. Integrity — files cannot be altered undetectably.
3. Secure sharing — share links are opaque, unpredictable, revocable, expirable, and rate-limited.
4. Access control — only the owner or an authorized share can reach a file.
5. Secure token generation — CSPRNG-based, reveals nothing about IDs or keys.
6. Security testing — automated + live testing of the attack surface.

**Implementation principle:** use established cryptographic libraries (OpenSSL via
Node.js `crypto`). **No cryptographic algorithm is implemented manually.**

---

## 2. Threat Model

### 2.1 Assets

| Asset                 | Confidentiality | Integrity | Availability |
|-----------------------|:---:|:---:|:---:|
| User credentials      | ✓ |   |   |
| Files (user content)  | ✓ | ✓ | ✓ |
| Encryption keys       | ✓ |   |   |
| Share tokens          | ✓ |   |   |
| Personal information (names, IPs) | ✓ |   |   |
| Access logs           | ✓ | ✓ |   |

### 2.2 Attacker profiles

| Actor                          | Capabilities                                                                   | Primary target |
|--------------------------------|--------------------------------------------------------------------------------|----------------|
| Unauthenticated user           | Guess/enumerate tokens, file IDs, passwords; scan endpoints.                   | Share tokens, password-protected shares |
| Malicious authenticated user   | Uploads files, reads own files, probes for others' files (IDOR).               | Other users' files |
| Share-link holder              | Has one valid token; tries to brute force or strip restrictions.               | Download limit, expiry, password |
| API manipulation               | Crafts requests, mutates IDs/tokens, path traversal names, oversized payloads. | Files, storage backend |
| File modifier (storage attacker)| Writes/bit-flips encrypted blobs (storage compromise, MITM).                   | File integrity, confidentiality |
| Brute forcer / DoS             | Repeats password guesses, floods share-password endpoint.                      | Password-protected shares |

### 2.3 Security goals

- **Confidentiality** — AES-256-GCM at rest; TLS in transit (deployment concern, see §9).
- **Integrity** — GCM authentication + SHA-256 verification on download.
- **Availability** — payload size limits, request cap, rate limiting on credential attempts.
- **Authentication** — owner bearer tokens; share passwords verified server-side.
- **Authorization** — owner-only file routes; share state machine for every download.
- **Accountability** — access decisions are logged; error responses never leak internals.

### 2.4 Trust boundaries

```
[ Browser / Frontend (Haroon) ]          <- zero trust: never holds keys/tokens permanently
        │ TLS
[ Reverse proxy / TLS ]                  <- deployment (Abhi/DevOps)
        │
[ API (Azin) + Security module ]  <------ all authorization/decryption happens HERE
        │
[ DB metadata (Abhi) ]  ── stores hashes + fingerprints only (no plaintext, no DEKs)
[ Storage (Abhi) ]     ── stores encrypted blobs (no plaintext)
```

File content never appears beyond the API layer in plaintext.

---

## 3. Security Architecture

```
UPLOAD
  File ─┬─ SHA-256 ───────────────────────────► stored hash (DB)
        └─ encrypt AES-256-GCM (envelope) ───► encrypted blob (storage)

DOWNLOAD (owner, authenticated)
  blob ── decrypt (GCM-authenticated) ── plaintext
          └─ SHA-256(plaintext) ── compare with stored hash
               MATCH    → return file
               MISMATCH → reject (500 INTEGRITY_FAILED)

SHARE
  owner ── create share {expiry?, maxDownloads?, password?} ──► token (CSPRNG)
          └─ store only SHA-256(token) + scrypt(password)
  visitor ── GET /api/shares/:token ── state check ── password (rate-limited) ── serve
```

The security module is a pure, well-tested core. The API layer (Azin) calls it for
every sensitive operation; the storage layer (Abhi) only ever handles ciphertext and
hashes.

---

## 4. Encryption Design (Confidentiality)

**Algorithm:** AES-256-GCM (NIST SP 800-38D), a 256-bit authenticated-encryption
mode. One primitive provides both confidentiality and integrity.

**Scheme — envelope encryption.** The master key never encrypts file content
directly in a reusable way:

```
plaintext
  │  AES-256-GCM(DEK₁, file_iv₁)
  ▼
ciphertext + tag          every file uses its own random 32-byte DEK and its own
                          random 12-byte IV. IVs are never reused with the same key
                          (the one fatal GCM mistake — prevented by construction).
DEK₁ is itself wrapped:   AES-256-GCM(masterKey, wrap_iv₁, DEK₁) → wrappedDEK + tag
```

**Container format** (`src/security/crypto.js`) — self-contained, fixed header:

```
0       8   MAGIC "SFSENC01"
8      12   wrapIv       (12 bytes)
20     16   wrapTag      (16 bytes)
36     32   wrappedDEK   (32 bytes)
68     12   fileIv       (12 bytes)
80     16   fileTag      (16 bytes)
96    ...   ciphertext   (same length as plaintext — GCM is a stream mode)
```

**Why these choices**
- AES-256-GCM: 256-bit key ⇒ 2²⁵⁶ keyspace; includes an authentication tag ⇒
  tampering of any byte is detected *before* decryption completes.
- 96-bit (12-byte) IV: the NIST-recommended nonce size for GCM.
- 128-bit tag: NIST maximum strength.
- Per-file DEK: key separation — leaking one file's DEK does not expose others;
  the master key only ever wraps short keys, reducing exposure.
- Per-encryption unique IV: nonce-reuse (the catastrophic GCM failure mode) is
  structurally impossible.

**What encryption does NOT do:** it does not authenticate *users*. Authorization is
handled by the access-control layer (§7). It also does not protect metadata in the
DB (file names, hashes) — those are protected separately (§5).

---

## 5. Hashing Design (Integrity)

**Algorithm:** SHA-256 (FIPS 180-4), 256-bit cryptographic hash. Collision-resistant
and one-way.

- **Upload:** `sha256(plaintext)` computed server-side; the digest is stored in DB
  metadata next to the file record. The plaintext content is never stored.
- **Download:** decrypt blob → recompute `sha256(plaintext)` → compare with stored
  digest using a **constant-time comparison** (`crypto.timingSafeEqual`).
- **Match → serve; mismatch → reject** with `INTEGRITY_FAILED`; no bytes are returned.

**Two independent integrity layers**

| Layer  | Detects |
|--------|---------|
| GCM tag (decryptFile) | any bit flip/truncation of the ciphertext or header; wrong key |
| SHA-256 comparison     | metadata row pointing at the wrong blob; logical corruption |

SHA-256 is used for files and token fingerprints only. **Password hashing is scrypt
(§6)** — never reuse a fast hash for passwords.

---

## 6. Key Management

**Design for this project's scope:** a single 256-bit *master key* acting as a Key
Encryption Key (KEK), loaded **only from the environment** at process start.

- `FILE_ENCRYPTION_KEY` — base64 of 32 random bytes (`src/security/keyManagement.js`
  validates byte length; invalid values abort startup).
- `.env` is gitignored; a template is committed as `.env.example`.
- The module **rejects** attempt to treat short/garbage values as keys.
- Dev fallback `ALLOW_EPHEMERAL_KEY=1` generates an in-memory key and warns loudly;
  explicitly forbidden in production.

**Rules enforced / documented**
- ❌ No hard-coded keys. ❌ Keys in Git. ❌ Keys in frontend code. ❌ Keys in URLs.
  ❌ Keys in logs (error messages are sanitized and never echo key material).
- ✅ Environment variable → secrets manager (AWS Secrets Manager / Azure Key Vault /
  HashiCorp Vault) → KMS in production (AWS KMS / Google Cloud KMS) with the same
  public API.

**Because of envelope encryption, model compromise is contained:**
- DB + storage leak ⇒ attacker obtains encrypted blobs + SHA-256 digests + token
  fingerprints. Without the master key the blobs are unreadable and tokens are
  unusable.
- Master key held in Vault/KMS ⇒ granular access logging, rotation by re-wrapping
  DEKs without re-encrypting files (documented production upgrade path).

---

## 7. Access-Control Model

### 7.1 Share state machine

```
            create
               │
               ▼
           ACTIVE ─────────────► REVOKED        (owner revoked; terminal, permanent)
               │
               ├── expiresAt passed ───► EXPIRED              (terminal)
               └── downloadsUsed ≥ maxDownloads ──► LIMIT_REACHED (terminal)
```

`computeShareState()` derives state from persisted fields on every request, so
state can never be forged client-side. **Priority: REVOKED > EXPIRED > LIMIT_REACHED > ACTIVE.**
A revoked share with a future expiry and a zero counter stays revoked — knowing the
token can never resurrect it.

### 7.2 Authorization rules

| Request                                      | Decision |
|----------------------------------------------|----------|
| Owner GET `/api/files/:id` (authenticated)   | 200 — owner check passes |
| Other user / anonymous GET file by ID        | 403 / 401 — **no public file-by-ID route** |
| Share download with valid ACTIVE token       | 200 — password verified (if any), counter consumed |
| Share download after expiry / revocation     | 403 — state not ACTIVE |
| Share download beyond maxDownloads           | 403 — LIMIT_REACHED |
| Wrong/absent share password                  | 403 + rate-limited (429 after 5 failures/15 min) |
| Unknown / guessed token                      | 403 — response indistinguishable from dead share |

### 7.3 Why file IDs are safe

File IDs are 16 random bytes (32 hex chars, from `crypto.randomBytes`). No
sequential IDs exist, so simple IDOR (`file 100` → `file 101`) is impossible —
guessing a 128-bit ID is infeasible. Ownership is enforced with strict
string-comparison on every file route.

### 7.4 Download-limit integrity

The counter is stored server-side and mutated with a **single atomic conditional
UPDATE** (documented in code): `... WHERE token_hash = $1 AND downloads_used <
max_downloads`. Parallel requests cannot race past the limit. Wrong-password
attempts never decrement the counter.

### 7.5 Expiration presets

The API accepts any positive duration up to 30 days via `expiresInMinutes` or
`expiresInSeconds`, so the required presets and custom values are all covered
(verified live against the reference server):

| Preset | Value accepted | Verified |
|--------|---------------|---------|
| 1 hour | `expiresInMinutes: 60` | 201 ✓ |
| 6 hours | `expiresInMinutes: 360` | 201 ✓ |
| 24 hours | `expiresInMinutes: 1440` | 201 ✓ |
| 7 days | `expiresInMinutes: 10080` | 201 ✓ |
| custom | any other value ≤ 43200 | 201 ✓ |

---

## 8. Share-Token Design

- 32 random bytes (`crypto.randomBytes` = CSPRNG) → base64url, 43 characters.
- **Opaque:** pure randomness — reveals nothing about user, file, DB row, or key.
- **Unpredictable:** 256 bits of entropy ⇒ ~2²⁵⁶ possibilities; guessing is
  computationally infeasible.
- **Never stored raw:** the DB keeps only `SHA-256(token)`. Lookup hashes the
  presented token and compares. A DB leak yields fingerprints, not usable tokens.
- **Never emitted** in logs, URLs for other resources, or file/list responses.

**Explicitly forbidden (and not used):** incrementing IDs, timestamps, user IDs,
file IDs, database IDs, MD5, `Math.random()`.

---

## 9. Threats and Mitigations

| # | Threat | Mitigation | Where |
|---|--------|-----------|-------|
| 1 | **IDOR** (guess other files' IDs) | 128-bit random file IDs; owner-only routes | tokens.js, accessControl.js |
| 2 | **Broken access control** | Owner check + valid-share check on every route; no public file-by-ID | accessControl.js, server |
| 3 | **Path traversal** uploads | `sanitizeStoredName()` + storage keyed by random ID, never by client name | accessControl.js, server |
| 4 | **Token guessing** | 256-bit CSPRNG tokens; constant-time match; indistinguishable 403s | tokens.js |
| 5 | **Brute force** (share password) | scrypt (slow, memory-hard) + rate limiter → 429 after 5 failures/15 min | passwords.js, accessControl.js |
| 6 | **Weak passwords** | minimum length policy: ≥ 8 chars; server-side rejection | passwords.js |
| 7 | **File manipulation** | GCM auth tag on every decrypt; any bit flip fails before plaintext is produced | crypto.js |
| 8 | **Hash mismatch** | SHA-256 re-verification; wrong blob ⇒ `INTEGRITY_FAILED`, zero bytes served | hashing.js |
| 9 | **Expired links** | `expiresAt` enforced on every request; `EXPIRED` is terminal | accessControl.js |
| 10 | **Revoked links** | `REVOKED` wins over all states; never reactivated | accessControl.js |
| 11 | **Download-limit bypass** | server-side atomic conditional decrement; no client trust | accessControl.js, server |
| 12 | **Unauthorized downloads** | full authorization gate before decrypt; anonymous = 401, non-owner = 403 | accessControl.js, server |
| 13 | **Sensitive information disclosure** | sanitized error codes/messages; no stack traces, keys, tokens, or paths in responses; generic errors for unknown/expired/revoked shares; `nosniff`, `no-store` headers | errors.js, server |
| 14 | Key loss / leak | envelope encryption; env-only master key; no key material in logs/URLs/client | keyManagement.js |
| 15 | Payload abuse | 5 MB body cap on the reference server | server |

Deployment hardening (Abhi/DevOps): TLS 1.2+ everywhere, HSTS, secure cookie flags,
access-log rotation and monitoring, secret rotation via KMS, WAF/rate limiting at
the edge for the public share endpoints.

---

## 10. Security Testing

### 10.1 Tools

Automated: Node `node --test` (59 assertions across 6 test files).
Live HTTP: `curl` via `scripts/security-test.sh` (36 checks).
Manual/evidence: **Burp Suite**, **OWASP ZAP**, **Postman** against
`examples/securityServer.mjs`.

### 10.2 Automated test results

```
$ npm test
tests 59  pass 59  fail 0           duration ~375 ms
```

| Test file | Covers |
|-----------|--------|
| tests/crypto.test.js | AES-256-GCM roundtrip; nonce freshness; byte-level tamper detection (file + tag + IV + wrapped key); wrong key; invalid containers; no plaintext leak in ciphertext |
| tests/hashing.test.js | NIST SHA-256 vector; MATCH/MISMATCH; constant-time comparison |
| tests/tokens.test.js | entropy (256-bit), uniqueness, opacity, fingerprint-only storage, token match, guessing infeasibility |
| tests/passwords.test.js | scrypt roundtrip, no plaintext storage, unique salts, weak-password rejection, malformed-hash safety |
| tests/accessControl.test.js | all 4 states, terminal/revocable transitions, expiry/limit/password gates, IDOR, path traversal, brute-force limiter |
| tests/integration.test.js | miniature backend: IDOR, direct file-ID access, modified IDs, modified/tampered tokens, token guessing, password shares, limit, revocation, expiry, integrity |

### 10.3 Live HTTP results (curl — run via `npm run security:test`)

```
RESULT: 36 passed, 0 failed
```

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| 1 | upload → 201 | 201 | PASS |
| 2 | owner downloads own file | 200 | PASS |
| 3 | Bob downloads Alice file (IDOR) | 403 | PASS |
| 4 | anonymous file access | 401 | PASS |
| 5 | modified file ID | 404 | PASS |
| 6 | served bytes hash == stored SHA-256 | match | PASS |
| 7 | served plaintext == original | identical | PASS |
| 8 | create password+limit share (24h) | 201 | PASS |
| 9 | share status ACTIVE | ACTIVE | PASS |
| 10 | download without password | 403 | PASS |
| 11 | wrong password | 403 | PASS |
| 12–14 | 3 correct-password downloads | 200 each | PASS |
| 15 | 4th download ⇒ limit reached | 403 | PASS |
| 16 | status LIMIT_REACHED | LIMIT_REACHED | PASS |
| 17–21 | 5 wrong passwords (bruteforce) | 403 each | PASS |
| 22 | 6th wrong ⇒ rate limited | 429 | PASS |
| 23 | short password rejected | 400 | PASS |
| 24 | download before revoke | 200 | PASS |
| 25 | owner revoke | 200 | PASS |
| 26 | status after revoke | REVOKED | PASS |
| 27 | download after revoke | 403 | PASS |
| 28 | revoke by non-owner | 403 | PASS |
| 29 | share status before 1s expiry | ACTIVE | PASS |
| 30 | status after expiry | EXPIRED | PASS |
| 31 | download after expiry | 403 | PASS |
| 32 | random 256-bit token guess | 403 | PASS |
| 33 | corrupted stored blob | 500 (GCM/integrity) | PASS |
| 34 | tampered response is JSON, not file bytes | JSON | PASS |
| 35 | path-traversal upload name sanitized | 201 | PASS |
| 36 | stored name is clean basename | passwd | PASS |

### 10.4 Manual tool checks (record evidence in Burp/ZAP)

1. **ZAP active scan** on all `/api/*` paths — confirm no informational leaks in
   responses or headers.
2. **Burp Repeater:** replay a valid share token request, modify one character of
   the token → expect 403 (indistinguishable from expired).
3. **Burp Intruder (token position):** 1,000 random 43-char guesses → all 403.
4. **Burp Intruder (password position):** 1,000 wrong passwords → expect 429 after
   the 5th failure (rate limiter engaged).
5. **Postman:** run the flows in §10.3 as a saved collection for regression runs.

---

## 11. Reproducing the tests

```bash
npm test                 # 59 automated security tests (0 failures)
npm run security:test    # boots the reference server + 36 curl checks (0 failures)
npm run demo             # readable end-to-end pipeline walkthrough
npm run server           # start reference server on :8080 for Burp/ZAP/Postman
```

---

## 12. Team Integration Notes

- **To Azin (Backend/API):** call the security module; persist only
  `fingerprintShareToken(token)`; enforce the download-limit with one atomic
  conditional UPDATE; run `authorizeShareDownload()` on every share request;
  return `{ code, message }` errors without stack traces.
- **To Abhi (DB/Storage/DevOps):** store `.enc` blobs in object storage keyed by
  opaque file ID; keep SHA-256 + token fingerprints in the DB; provision
  `FILE_ENCRYPTION_KEY` through a secrets manager/KMS; enable TLS and log rotation.
- **To Haroon (Frontend):** display share state via `GET /api/shares/:token/status`
  (`ACTIVE/EXPIRED/REVOKED/LIMIT_REACHED`); collect the share password client-side
  but never store it; never embed tokens or keys in client code.

---
*End of security documentation. All results in §10 are reproducible from the
committed code in this repository.*