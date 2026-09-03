# Secure File Backend

A security-focused Express REST API for authenticated upload, encrypted storage,
ownership-based authorization, controlled sharing, integrity verification and
security logging.

## 1. Run

Requirements:
- Node.js 20+
- PostgreSQL 14+ (or use the bundled local PostgreSQL via `npm run db:local`)

```bash
npm install

# Option A: use the bundled real PostgreSQL (no Docker/root required)
npm run db:local

# Option B: use your own PostgreSQL
createdb secure_files
psql "$DATABASE_URL" -f src/config/schema.sql

cp .env.example .env
```

Set a strong `JWT_SECRET` and `FILE_ENCRYPTION_KEY` in `.env`.

Then:

```bash
npm run dev
```

Health check:

```bash
curl http://localhost:8000/health
```

Optional admin account:

```bash
npm run seed:admin
```

## 2. API contract

All normal responses are JSON:

```json
{"success":true,"...":"..."}
```

Errors:

```json
{"success":false,"message":"..."}
```

### Authentication

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register | No | Create user |
| POST | /api/auth/login | No | Authenticate, issue JWT + refresh token |
| POST | /api/auth/refresh | No | Rotate a refresh token for a new access token |
| POST | /api/auth/logout | Yes | Revoke the presented refresh token |
| GET | /api/auth/me | Yes | Current user |

Access tokens are short-lived JWTs (default 1h). Refresh tokens (default 7d)
are stored as SHA-256 fingerprints, rotated on every `/refresh`, and revoked
on rotation and logout. Replaying an already-rotated refresh token is
rejected.

### Health

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /health | Liveness (always 200 when the process is up) |
| GET | /health/live | Same as /health |
| GET | /health/ready | Readiness - pings the DB, 503 when not ready |

All responses include an `X-Request-Id` header; requests and errors are
logged as structured JSON lines (request id, method, path, status, duration).

### Files

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /api/files/upload | Yes | Upload one encrypted file |
| GET | /api/files | Yes | List only your files |
| GET | /api/files/:id | Yes | Get file metadata if owner |
| GET | /api/files/:id/download | Yes | Download owned file |
| DELETE | /api/files/:id | Yes | Delete owned file |

### Shares

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | /api/shares | Yes | Create share |
| GET | /api/shares | Yes | List your shares (optional ?fileId=) |
| GET | /api/shares/:token | No | Validate/share metadata |
| GET | /api/shares/:token/download | No | Password/expiry/limit checked download |
| POST | /api/shares/:token/download | No | Download with password in body `{"password":"..."}` |
| DELETE | /api/shares/:id | Yes | Delete own share |
| POST | /api/shares/:id/revoke | Yes | Revoke own share |

The supplied contract says `GET /api/shares/:token`; download is exposed as
`/api/shares/:token/download` so metadata validation and file transfer stay
separate. Password-protected downloads should use the POST variant with the
password in the JSON body (never in the URL).

### Logs

`GET /api/logs` — authenticated user's security logs.

### Admin

| Method | Endpoint | Role |
|---|---|---|
| GET | /api/admin/users | admin |
| GET | /api/admin/files | admin |
| GET | /api/admin/stats | admin |
| GET | /api/admin/security-events | admin |

## 3. Authentication

Passwords are hashed with bcrypt (12 rounds). Password hashes are never sent
to the client.

Login returns a short-lived JWT access token. Send it as:

```http
Authorization: Bearer <access-token>
```

The JWT contains only the user identity needed by the server:
`sub`, `email`, and `role`.

Logout is stateless for the access token: the client deletes it. For a
production system requiring immediate token invalidation, add refresh-token
rotation and server-side revocation.

## 4. Authorization / IDOR protection

The backend never trusts `ownerId` from the client.

For example, file lookup is constrained by:

```sql
WHERE id = $1 AND owner_id = $2
```

Direct metadata access also checks the authenticated user's ID. A different
owner receives `403 Forbidden`.

Admin routes additionally require `role === "admin"` from the verified JWT.

## 5. Upload security

- Multer uses memory storage and a strict size limit.
- Only a small allowlist of MIME types is accepted.
- **Magic-byte signature validation** (`file-type`) verifies the uploaded
  content matches its declared type; spoofed or undetectable files are
  rejected with `400`.
- Empty files are rejected.
- Filename is sanitized and never used as a filesystem path.
- The server generates the storage filename.
- Files are encrypted before being written.
- SHA-256 is calculated from the plaintext and stored as an integrity value.
- Client-provided owner IDs are ignored.

## 6. Download security

Owned download:

Authentication -> ownership check -> read encrypted file -> decrypt ->
SHA-256 verification -> security log -> response.

Shared download:

Token lookup -> revocation/expiry/limit checks -> password verification ->
atomic download-count increment -> decrypt -> integrity verification ->
security log -> response.

The share token is generated with a cryptographically secure random generator;
only its SHA-256 hash is stored in the database.

## 7. Security middleware

- Helmet: secure HTTP headers.
- CORS: restrict frontend origin.
- express-rate-limit: global, authentication, and share-download limits.
- Zod: request validation.
- Multer: upload limits.
- JWT middleware: authentication (HS256 pinned, issuer checked).
- Admin middleware: role enforcement.
- Magic-byte upload validation (file-type).
- Parameterized PostgreSQL queries: SQL injection protection.
- Safe filesystem path resolution: path traversal protection.
- Generic production errors: reduce information disclosure.
- Structured JSON request/error logging with per-request IDs.
- Fail-fast production config: refuses to boot with weak/absent secrets.

## 8. Integration points

### Abhi — database/storage

Keep the existing `users`, `files`, `shares`, and `access_logs` tables if Abhi
already created them. Do NOT run this schema over an existing database unless
the columns match.

The only DB abstraction used by controllers/services is `src/config/db.js`.
Replace that adapter's pool/query implementation with Abhi's existing
connection module instead of creating a second connection.

If Abhi's column names differ, update the SQL in the services/controllers,
not the API contract.

### Adhil — security

`src/services/security.service.js` is the integration boundary.

Map Adhil's functions to:

- `encryptBuffer(buffer)`
- `decryptBuffer(encrypted)`
- `hashSha256(buffer)`
- `verifyIntegrity(buffer, expectedHash)`
- `generateShareToken()`

No encryption key is returned through any API.

### Haroon — frontend

The frontend can use the documented JSON shapes and HTTP status codes. Store
the short-lived access token securely on the client side and send the Bearer
header for protected calls.

For browser-based deployments, a stronger production architecture is to use
short-lived access tokens plus HttpOnly/Secure/SameSite refresh-token cookies.

## 9. API examples

Register:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"StrongPass123!"}'
```

Login:

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"StrongPass123!"}'
```

Upload:

```bash
curl -X POST http://localhost:8000/api/files/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@report.pdf"
```

Create a share:

```bash
curl -X POST http://localhost:8000/api/shares \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fileId":"UUID","password":"SharePass123!","expiration":"2026-08-20T12:00:00.000Z","maxDownloads":3}'
```

Validate a share without a password:

```bash
curl http://localhost:8000/api/shares/SHARE_TOKEN
```

For password-protected shares, provide the password during validation:

```bash
curl "http://localhost:8000/api/shares/SHARE_TOKEN?password=SharePass123!"
```

Download a protected share:

```bash
curl -L "http://localhost:8000/api/shares/SHARE_TOKEN/download?password=SharePass123!" -o downloaded.bin
```

## 10. Testing

1. Register User A.
2. Login as A and upload a file.
3. Confirm `GET /api/files` lists the file.
4. Register/login User B.
5. Try `GET /api/files/<A_FILE_ID>` as B — expect `403`.
6. Try download as B — expect `403`.
7. Create a share as A.
8. Access share metadata without authentication.
9. Test wrong share password — expect `401`.
10. Test expired share — expect `403`.
11. Test revoked share — expect `403`.
12. Set `maxDownloads=1`, download once, then retry — expect `403`.
13. Inspect `GET /api/logs`.
14. Test malformed UUIDs — expect `400`.
15. Send more than the auth rate limit — expect `429`.
16. Upload a file over the configured size — expect `413`.
17. Test unsupported MIME types — expect `400`.
18. Verify the encrypted file on disk is not the original plaintext.
19. Modify the encrypted file and download it — integrity verification must fail.
20. Test admin endpoints with a normal user — expect `403`.

## Important production hardening

Before deployment:
- Use HTTPS.
- Put secrets in a secret manager.
- Set a strong random `FILE_ENCRYPTION_KEY`.
- Replace the default security adapter with Adhil's implementation.
- Reuse Abhi's DB connection/models.
- Add refresh-token rotation if long-lived sessions are needed.
- Add antivirus/content scanning for uploaded files.
- Prefer magic-byte/file-signature validation.
- Use object storage/private buckets for large files.
- Consider streaming encryption/decryption instead of buffering large files.
