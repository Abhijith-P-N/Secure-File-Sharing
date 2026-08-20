-- ============================================================================
-- Secure File Sharing Platform - Revision 001
-- Initial schema (idempotent for fresh dev databases).
-- Owner: Abhijith (Database, Storage & DevOps)
--
-- NOTE: Keep this file in sync with database/schema.sql and with the backend
-- queries in secure-file-backend/. If you already have an older incompatible
-- schema in a dev database, run `DROP TABLE IF EXISTS access_logs, shares,
-- files, users CASCADE;` first, then apply this file.
-- ============================================================================

BEGIN;

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
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_email ON users (lower(email));
CREATE INDEX idx_users_role ON users (role);

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
                  CHECK (stored_name !~ '[/\\]')
                  CONSTRAINT ck_files_stored_name_length
                  CHECK (char_length(stored_name) BETWEEN 1 AND 64),
    mime_type     VARCHAR(255)  NOT NULL
                  DEFAULT 'application/octet-stream',
    size_bytes    BIGINT        NOT NULL DEFAULT 0
                  CONSTRAINT ck_files_size_non_negative
                  CHECK (size_bytes >= 0),
    sha256        CHAR(64)      NOT NULL
                  CONSTRAINT ck_files_sha256_hex
                  CHECK (sha256 ~ '^[a-f0-9]{64}$'),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_files_stored_name ON files (stored_name);
CREATE INDEX idx_files_owner_id ON files (owner_id);
CREATE INDEX idx_files_created_at ON files (created_at);

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
    expires_at     TIMESTAMPTZ   NULL,
    max_downloads  INTEGER       NULL
                   CONSTRAINT ck_shares_max_downloads_positive
                   CHECK (max_downloads IS NULL OR max_downloads > 0),
    download_count INTEGER       NOT NULL DEFAULT 0
                   CONSTRAINT ck_shares_download_count_non_negative
                   CHECK (download_count >= 0),
    revoked_at     TIMESTAMPTZ   NULL,
    created_by     UUID          NOT NULL
                   REFERENCES users(id) ON DELETE CASCADE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_shares_token_hash ON shares (token_hash);
CREATE INDEX idx_shares_file_id ON shares (file_id);
CREATE INDEX idx_shares_expires_at ON shares (expires_at);
CREATE INDEX idx_shares_created_by ON shares (created_by);

-- ============================================================================
-- access_logs
-- ============================================================================
CREATE TABLE access_logs (
    id            BIGSERIAL PRIMARY KEY,
    user_id       UUID      NULL
                  REFERENCES users(id) ON DELETE SET NULL,
    action        TEXT      NOT NULL,
    resource_type TEXT      NULL,
    resource_id   UUID      NULL,
    success       BOOLEAN   NOT NULL DEFAULT TRUE,
    ip            TEXT      NULL,
    user_agent    TEXT      NULL,
    details       JSONB     NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_access_logs_user_id ON access_logs (user_id);
CREATE INDEX idx_access_logs_created_at ON access_logs (created_at DESC);
CREATE INDEX idx_access_logs_success ON access_logs (success, created_at DESC);

-- ============================================================================
-- refresh_tokens
-- ============================================================================
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL
                REFERENCES users(id) ON DELETE CASCADE,
    token_hash  CHAR(64)     NOT NULL
                CONSTRAINT ck_refresh_tokens_hash_hex
                CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked_at  TIMESTAMPTZ  NULL,
    ip          TEXT         NULL,
    user_agent  TEXT         NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_refresh_tokens_token_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);

COMMIT;