# Database - Secure File Sharing Platform

Owner: Abhijith (Database, Storage & DevOps)

## Engine

PostgreSQL 16. Chosen because the data is highly relational (foreign keys,
join-heavy dashboards, audit queries) and the schema must enforce
referential integrity itself.

## Schema

Canonical file: `database/schema.sql` (bootstrap migration:
`database/migrations/001_init.sql`). The compose `db` service runs it
automatically on first boot.

### users
| column        | type          | constraints                     |
|---------------|---------------|---------------------------------|
| id            | UUID          | PK, default gen_random_uuid()   |
| name          | VARCHAR(100)  | NOT NULL, 1..100 chars          |
| email         | VARCHAR(320)  | NOT NULL, format-checked        |
| password_hash | TEXT          | NOT NULL, 40..255 chars (bcrypt/argon2) |
| role          | VARCHAR(20)   | NOT NULL, default 'user' in ('user','admin') |
| created_at    | TIMESTAMPTZ   | default now()                   |
| updated_at    | TIMESTAMPTZ   | auto-updated by trigger         |

### files
| column              | type          | constraints                          |
|---------------------|---------------|--------------------------------------|
| id                  | UUID          | PK, default gen_random_uuid()        |
| owner_id            | UUID          | FK -> users.id, ON DELETE CASCADE    |
| original_name       | VARCHAR(255)  | NOT NULL, 1..255 chars (metadata only) |
| stored_name         | VARCHAR(64)   | NOT NULL, unique, no `/` or `\` (path-traversal DB guard) |
| file_size           | BIGINT        | NOT NULL, >= 0                       |
| mime_type           | VARCHAR(255)  | default 'application/octet-stream'   |
| file_hash           | CHAR(64)      | NOT NULL, must match ^[a-f0-9]{64}$ (SHA-256) |
| encryption_metadata | JSONB         | NOT NULL, must be JSON object        |
| created_at          | TIMESTAMPTZ   | default now()                        |
| updated_at          | TIMESTAMPTZ   | auto-updated                         |

`encryption_metadata` stores: algorithm, nonce/IV, auth-tag, and a
`key_id` reference. **The encryption key itself is never stored in the DB.**

### shares
| column         | type          | constraints                              |
|----------------|---------------|------------------------------------------|
| id             | UUID          | PK, default gen_random_uuid()            |
| file_id        | UUID          | FK -> files.id, ON DELETE CASCADE        |
| token          | VARCHAR(128)  | NOT NULL, unique, ^[A-Za-z0-9_-]{16,128}$ |
| password_hash  | TEXT          | NULL allowed (optional share password), 40..255 chars when set |
| expires_at     | TIMESTAMPTZ   | NULL = never expires                     |
| max_downloads  | INTEGER       | NULL = unlimited, must be > 0 when set   |
| download_count | INTEGER       | NOT NULL, default 0, >= 0                |
| revoked        | BOOLEAN       | NOT NULL, default false                  |
| created_at     | TIMESTAMPTZ   | default now()                            |
| updated_at     | TIMESTAMPTZ   | auto-updated                             |

### access_logs
| column     | type         | constraints                                  |
|------------|--------------|----------------------------------------------|
| id         | BIGSERIAL    | PK                                           |
| user_id    | UUID         | FK -> users.id, ON DELETE SET NULL (nullable)|
| file_id    | UUID         | FK -> files.id, ON DELETE SET NULL (nullable)|
| action     | VARCHAR(40)  | NOT NULL, in whitelist (e.g. LOGIN, DOWNLOAD, UNAUTHORIZED_ACCESS, EXPIRED_LINK, REVOKED_LINK...) |
| result     | VARCHAR(10)  | NOT NULL, in ('SUCCESS','FAILURE','DENIED')  |
| timestamp  | TIMESTAMPTZ  | default now()                                |
| ip_address | INET         | nullable                                     |
| user_agent | TEXT         | nullable (only where appropriate)            |

## Indexes

Implemented in `schema.sql`:

- `uq_users_email` unique on `lower(email)` - fast, case-insensitive login
- `idx_users_role` - admin/user queries
- `uq_files_stored_name` unique - collision prevention + safe file lookup
- `idx_files_owner_id` - "my files" listings
- `idx_files_created_at` - dashboard/audit windows
- `uq_shares_token` unique - O(1) public share-token lookup
- `idx_shares_file_id` - share lists per file
- `idx_shares_expires_at` - expiration sweeps and active-share queries
- `idx_shares_revoked` (partial, `revoked = false`) - active share counts
- `idx_access_logs_user_id`, `idx_access_logs_file_id` - audit filtering
- `idx_access_logs_timestamp` - recent-events feed
- `idx_access_logs_action_result` - attack/failure detection over time

## Relationships

```
users 1 ──── N files      (owner_id, ON DELETE CASCADE)
files 1 ──── N shares     (file_id,  ON DELETE CASCADE)
users 1 ──── N logs       (user_id,  ON DELETE SET NULL)
files 1 ──── N logs       (file_id,  ON DELETE SET NULL)
```

## Security decisions

- No plaintext passwords - only bcrypt/argon2 hashes.
- No encryption keys in the DB - only a key reference (`key_id`).
- `stored_name` DB constraint rejects `/` and `\` (extra layer behind storage code).
- `access_logs` foreign keys are `SET NULL` so deletes don't break the audit trail.
- `files`/`shares` cascade on owner/file delete to keep the DB consistent.
- Action and result fields are whitelisted via CHECK constraints.
- All queries used by the backend should be **parameterized** (no string
  interpolation) - coordinate with Azin.