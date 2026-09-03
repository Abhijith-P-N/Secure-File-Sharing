-- ============================================================================
-- Secure File Sharing Platform
-- Database Schema (PostgreSQL 16+)
-- Owner: Abhijith (Database, Storage & DevOps)
--
-- Tables : users, files, shares, access_logs, refresh_tokens, upload_sessions,
--          share_access_codes, password_reset_otps
--
-- This is the CANONICAL schema. It matches the backend (`secure-file-backend`)
-- queries exactly. Keep it in sync with the backend migrations under:
--   secure-file-backend/src/config/migrations/
--
-- Notes  :
--   - Passwords are stored ONLY as hashes (bcrypt/argon2 outputs).
--   - Encryption keys are NEVER stored in the database.
--   - stored_name is a server-generated internal name; the original filename
--     is metadata only.
--   - Share tokens are stored ONLY as a SHA-256 fingerprint (token_hash);
--     the raw token is returned once at creation and never persisted.
-- ============================================================================

BEGIN;

-- gen_random_uuid() for UUID defaults
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- users
-- ============================================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(320)     NOT NULL,
    password_hash TEXT             NOT NULL
                  CONSTRAINT ck_users_password_hash_length
                  CHECK (char_length(password_hash) BETWEEN 40 AND 255),
    name          VARCHAR(100),
    role          VARCHAR(20)      NOT NULL DEFAULT 'user'
                  CONSTRAINT ck_users_role
                  CHECK (role IN ('user', 'admin')),
    totp_secret   TEXT             NULL
                  CONSTRAINT ck_users_totp_secret_length
                  CHECK (totp_secret IS NULL OR char_length(totp_secret) BETWEEN 16 AND 64),
    totp_enabled  BOOLEAN          NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

-- Unique email (case-insensitive) for login lookups
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));
-- Index for role-based admin queries
CREATE INDEX idx_users_role ON users (role);
-- Soft delete queries
CREATE INDEX idx_users_deleted ON users (deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- files
-- ============================================================================
CREATE TABLE files (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id      UUID          NOT NULL
                  REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255)  NOT NULL
                  CONSTRAINT ck_files_original_name_length
                  CHECK (char_length(original_name) BETWEEN 1 AND 255),
    stored_name   VARCHAR(64)   NOT NULL
                  CONSTRAINT ck_files_no_slashes
                  CHECK (stored_name !~ '[/\\]')        -- path-traversal guard
                  CONSTRAINT ck_files_stored_name_length
                  CHECK (char_length(stored_name) BETWEEN 1 AND 64),
    mime_type     VARCHAR(255)  NOT NULL
                  DEFAULT 'application/octet-stream',
    size_bytes    BIGINT        NOT NULL DEFAULT 0
                  CONSTRAINT ck_files_size_non_negative
                  CHECK (size_bytes >= 0),
    sha256        CHAR(64)      NOT NULL
                  CONSTRAINT ck_files_sha256_hex
                  CHECK (sha256 ~ '^[a-f0-9]{64}$'),     -- SHA-256 hex digest
    search_vector tsvector      NULL,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ
);

-- Unique stored names prevent collisions / overwrites in storage
CREATE UNIQUE INDEX uq_files_stored_name ON files (stored_name);
-- Owner file listing
CREATE INDEX idx_files_owner_id ON files (owner_id);
-- Files created in a window (audit / dashboard)
CREATE INDEX idx_files_created_at ON files (created_at);
-- Soft delete queries
CREATE INDEX idx_files_deleted ON files (deleted_at) WHERE deleted_at IS NOT NULL;
-- Full-text search over filename / mime type
CREATE INDEX idx_files_search ON files USING GIN (search_vector);

-- Keep files.search_vector in sync on insert/update (full-text search)
CREATE OR REPLACE FUNCTION files_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.original_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.mime_type, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER files_search_vector_trigger
  BEFORE INSERT OR UPDATE ON files
  FOR EACH ROW
  EXECUTE FUNCTION files_search_vector_update();

-- ============================================================================
-- shares
-- ============================================================================
CREATE TABLE shares (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id        UUID          NOT NULL
                   REFERENCES files(id) ON DELETE CASCADE,
    token_hash     CHAR(64)      NOT NULL
                   CONSTRAINT ck_shares_token_hash_hex
                   CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    password_hash  TEXT          NULL
                   CONSTRAINT ck_shares_password_hash_length
                   CHECK (password_hash IS NULL OR char_length(password_hash) BETWEEN 40 AND 255),
    allowed_email  TEXT          NULL,
    expires_at     TIMESTAMPTZ   NULL,                          -- NULL = never expires
    max_downloads  INTEGER       NULL
                   CONSTRAINT ck_shares_max_downloads_positive
                   CHECK (max_downloads IS NULL OR max_downloads > 0),  -- NULL = unlimited
    download_count INTEGER       NOT NULL DEFAULT 0
                   CONSTRAINT ck_shares_download_count_non_negative
                   CHECK (download_count >= 0),
    revoked_at     TIMESTAMPTZ   NULL,
    created_by     UUID          NOT NULL
                   REFERENCES users(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);

-- Lookup by token fingerprint (public share key, hashed)
CREATE UNIQUE INDEX uq_shares_token_hash ON shares (token_hash);
-- Shares owned by a file (owner dashboard / revoke list)
CREATE INDEX idx_shares_file_id ON shares (file_id);
-- Expiration sweep + "active shares" queries
CREATE INDEX idx_shares_expires_at ON shares (expires_at);
-- Shares created by a user (my-shares list)
CREATE INDEX idx_shares_created_by ON shares (created_by);
-- Soft delete queries
CREATE INDEX idx_shares_deleted ON shares (deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- one-time access codes for email-verified shares
-- ============================================================================
CREATE TABLE share_access_codes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    share_id   UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
    email      TEXT NOT NULL,
    code       TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_access_codes_share ON share_access_codes (share_id);
CREATE INDEX idx_access_codes_email ON share_access_codes (email);

-- ============================================================================
-- password reset one-time passwords (forgot-password flow)
-- ============================================================================
CREATE TABLE password_reset_otps (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email      TEXT NOT NULL,
    code_hash  TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at    TIMESTAMPTZ,
    attempts   INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_otps_email ON password_reset_otps (email);

-- ============================================================================
-- access_logs (partitioned by month)
-- ============================================================================
CREATE TABLE access_logs (
    id            BIGSERIAL,
    user_id       UUID      NULL
                  REFERENCES users(id) ON DELETE SET NULL,
    action        TEXT      NOT NULL,
    resource_type TEXT      NULL,
    resource_id   UUID      NULL,
    success       BOOLEAN   NOT NULL DEFAULT TRUE,
    ip            TEXT      NULL,
    user_agent    TEXT      NULL,
    details       JSONB     NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partitions for the current and next 12 months + a default fallback
CREATE TABLE access_logs_y2026m01 PARTITION OF access_logs
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE access_logs_y2026m02 PARTITION OF access_logs
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE access_logs_y2026m03 PARTITION OF access_logs
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE access_logs_y2026m04 PARTITION OF access_logs
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE access_logs_y2026m05 PARTITION OF access_logs
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE access_logs_y2026m06 PARTITION OF access_logs
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE access_logs_y2026m07 PARTITION OF access_logs
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE access_logs_y2026m08 PARTITION OF access_logs
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE access_logs_y2026m09 PARTITION OF access_logs
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE access_logs_y2026m10 PARTITION OF access_logs
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE access_logs_y2026m11 PARTITION OF access_logs
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE access_logs_y2026m12 PARTITION OF access_logs
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE access_logs_y2027m01 PARTITION OF access_logs
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE access_logs_default PARTITION OF access_logs DEFAULT;

-- Dashboard / admin filtering by user
CREATE INDEX idx_access_logs_user_id ON access_logs (user_id);
-- Time-window queries, "recent security events" feed
CREATE INDEX idx_access_logs_created_at ON access_logs (created_at DESC);
-- Attack-detection: failed actions over time
CREATE INDEX idx_access_logs_success ON access_logs (success, created_at DESC);
-- Log category queries
CREATE INDEX idx_access_logs_action ON access_logs (action);

-- ============================================================================
-- refresh_tokens
-- ============================================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL
                 REFERENCES users(id) ON DELETE CASCADE,
    token_hash  CHAR(64)     NOT NULL
                 CONSTRAINT ck_refresh_tokens_hash_hex
                 CHECK (token_hash ~ '^[a-f0-9]{64}$'),   -- SHA-256 of the raw token
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ  NULL,
    ip          TEXT         NULL,
    user_agent  TEXT         NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Lookup + rotation by fingerprint
CREATE UNIQUE INDEX uq_refresh_tokens_token_hash ON refresh_tokens (token_hash);
-- Revoke-all-on-logout / per-user sessions
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
-- Cleanup / garbage collection of expired tokens
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

-- ============================================================================
-- upload_sessions (for chunked/resumable uploads)
-- ============================================================================
CREATE TABLE upload_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID          NOT NULL
                     REFERENCES users(id) ON DELETE CASCADE,
    file_id          UUID          NULL
                     REFERENCES files(id) ON DELETE SET NULL,
    original_name    VARCHAR(255)  NOT NULL,
    mime_type        VARCHAR(255)  NOT NULL,
    total_size       BIGINT        NOT NULL
                     CONSTRAINT ck_upload_sessions_total_size_positive
                     CHECK (total_size > 0),
    chunk_size       INTEGER       NOT NULL DEFAULT 5242880,  -- 5MB default
    total_chunks     INTEGER       NOT NULL
                     CONSTRAINT ck_upload_sessions_total_chunks_positive
                     CHECK (total_chunks > 0),
    uploaded_chunks  INTEGER[]     NOT NULL DEFAULT '{}',
    status           VARCHAR(20)   NOT NULL DEFAULT 'pending'
                     CONSTRAINT ck_upload_sessions_status
                     CHECK (status IN ('pending', 'uploading', 'completed', 'failed', 'expired')),
    sha256           CHAR(64)      NULL
                     CONSTRAINT ck_upload_sessions_sha256_hex
                     CHECK (sha256 IS NULL OR sha256 ~ '^[a-f0-9]{64}$'),
    expires_at       TIMESTAMPTZ   NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_upload_sessions_user_id ON upload_sessions (user_id);
CREATE INDEX idx_upload_sessions_status ON upload_sessions (status);
CREATE INDEX idx_upload_sessions_expires_at ON upload_sessions (expires_at);

COMMIT;
