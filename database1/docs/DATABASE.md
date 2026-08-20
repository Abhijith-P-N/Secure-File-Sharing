# Database - Secure File Sharing Platform

Owner: Abhijith (Database, Storage & DevOps)

## Engine

PostgreSQL 16. Chosen because the data is highly relational (foreign keys,
join-heavy dashboards, audit queries) and the schema must enforce
referential integrity itself.

## Schema

Canonical file: `database/schema.sql` (bootstrap migration:
`database/migrations/001_init.sql`). The compose `db` service runs it
automatically on first boot. It MUST stay in sync with the backend queries:
`secure-file-backend/src/config/schema.sql` is the backend's copy of the same
contract.

### users
| column        | type          | constraints                     |
|---------------|---------------|---------------------------------|
| id            | UUID          | PK, default gen_random_uuid()   |
| email         | VARCHAR(320)  | NOT NULL, unique (lowercased)   |
| password_hash | TEXT          | NOT NULL, 40..255 chars (bcrypt/argon2) |
| name          | VARCHAR(100)  | NULL (optional display name)    |
| role          | VARCHAR(20)   | NOT NULL, default 'user' in ('user','admin') |
| created_at    | TIMESTAMPTZ   | default now()                   |

### files
| column         | type          | constraints                          |
|----------------|---------------|--------------------------------------|
| id             | UUID          | PK, default gen_random_uuid()        |
| owner_id       | UUID          | FK -> users.id, ON DELETE CASCADE    |
| original_name  | VARCHAR(255)  | NOT NULL, 1..255 chars (metadata only) |
| stored_name    | VARCHAR(64)   | NOT NULL, unique, no `/` or `\` (path-traversal DB guard) |
| mime_type      | VARCHAR(255)  | default 'application/octet-stream'   |
| size_bytes     | BIGINT        | NOT NULL, default 0, >= 0            |
| sha256         | CHAR(64)      | NOT NULL, must match ^[a-f0-9]{64}$ (SHA-256) |
| created_at     | TIMESTAMPTZ   | default now()                        |

The AES-256-GCM IV and auth tag are stored **inside the encrypted blob
header** (12-byte IV + 16-byte tag + ciphertext). The encryption key is held
only in the environment (`FILE_ENCRYPTION_KEY`) - never in the DB.

### shares
| column         | type          | constraints                              |
|----------------|---------------|------------------------------------------|
| id             | UUID          | PK, default gen_random_uuid()            |
| file_id        | UUID          | FK -> files.id, ON DELETE CASCADE        |
| token_hash     | CHAR(64)      | NOT NULL, unique, ^[a-f0-9]{64}$ (SHA-256 fingerprint of the raw token) |
| password_hash  | TEXT          | NULL allowed (optional share password), 40..255 chars when set |
| expires_at     | TIMESTAMPTZ   | NULL = never expires                     |
| max_downloads  | INTEGER       | NULL = unlimited, must be > 0 when set   |
| download_count | INTEGER       | NOT NULL, default 0, >= 0                |
| revoked_at     | TIMESTAMPTZ   | NULL = active                            |
| created_by     | UUID          | FK -> users.id, ON DELETE CASCADE        |
| created_at     | TIMESTAMPTZ   | default now()                            |

The raw share token is generated with a CSPRNG (32 bytes), returned exactly
once at creation, and only its SHA-256 fingerprint is stored.

### access_logs
| column         | type          | constraints                                  |
|----------------|---------------|----------------------------------------------|
| id             | BIGSERIAL     | PK                                           |
| user_id        | UUID          | FK -> users.id, ON DELETE SET NULL (nullable)|
| action         | TEXT          | NOT NULL (e.g. LOGIN_SUCCESS, FILE_UPLOAD, SHARE_DOWNLOAD, UNAUTHORIZED_FILE_ACCESS, FAILED_SHARE_PASSWORD, EXPIRED_SHARE_ACCESS, REVOKED_SHARE_ACCESS) |
| resource_type  | TEXT          | NULL ('file' / 'share' / 'user')             |
| resource_id    | UUID          | NULL (id of the referenced resource)         |
| success        | BOOLEAN       | NOT NULL, default true                       |
| ip             | TEXT          | NULL (requester IP)                          |
| user_agent     | TEXT          | NULL                                         |
| details        | JSONB         | NULL (extra context)                         |
| created_at     | TIMESTAMPTZ   | default now()                                |

### refresh_tokens
| column      | type          | constraints                                 |
|-------------|---------------|---------------------------------------------|
| id          | UUID          | PK, default gen_random_uuid()               |
| user_id     | UUID          | FK -> users.id, ON DELETE CASCADE           |
| token_hash  | CHAR(64)      | NOT NULL, unique, ^[a-f0-9]{64}$ (SHA-256 fingerprint) |
| expires_at  | TIMESTAMPTZ   | NOT NULL                                    |
| revoked_at  | TIMESTAMPTZ   | NULL = active                               |
| ip          | TEXT          | NULL                                        |
| user_agent  | TEXT          | NULL                                        |
| created_at  | TIMESTAMPTZ   | default now()                               |

Refresh tokens enable access-token rotation without re-authentication. Only
the SHA-256 fingerprint is stored; the raw token is returned once at issue.

## Indexes

Implemented in `schema.sql`:

- `uq_users_email` unique on `lower(email)` - fast, case-insensitive login
- `idx_users_role` - admin/user queries
- `uq_files_stored_name` unique - collision prevention + safe file lookup
- `idx_files_owner_id` - "my files" listings
- `idx_files_created_at` - dashboard/audit windows
- `uq_shares_token_hash` unique - O(1) share-token lookup
- `idx_shares_file_id` - share lists per file
- `idx_shares_expires_at` - expiration sweeps and active-share queries
- `idx_shares_created_by` - "my shares" lists
- `idx_access_logs_user_id` - audit filtering per user
- `idx_access_logs_created_at` - recent-events feed
- `idx_access_logs_success` - failed-event detection

## Relationships

```
users 1 ──── N files      (owner_id, ON DELETE CASCADE)
files 1 ──── N shares     (file_id,  ON DELETE CASCADE)
users 1 ──── N shares     (created_by, ON DELETE CASCADE)
users 1 ──── N logs       (user_id,  ON DELETE SET NULL)
users 1 ──── N refresh_tokens (user_id, ON DELETE CASCADE)
```

## Security decisions

- No plaintext passwords - only bcrypt hashes (cost factor 12).
- No encryption keys in the DB - `FILE_ENCRYPTION_KEY` lives in the
  environment only.
- Share tokens and refresh tokens are stored only as one-way SHA-256
  fingerprints.
- `stored_name` DB constraint rejects `/` and `\` (extra layer behind storage code).
- `access_logs.user_id` is `SET NULL` on delete so the audit trail survives.
- `files`/`shares` cascade on owner/file delete to keep the DB consistent.
- All backend queries are **parameterized** (no string interpolation).

## Tests

The full API is covered end-to-end against an in-memory Postgres:

```bash
cd secure-file-backend
npm run test:integration
```