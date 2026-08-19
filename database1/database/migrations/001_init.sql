-- ============================================================================
-- Secure File Sharing Platform
-- Database Schema (PostgreSQL 16+)
-- Owner: Abhijith (Database, Storage & DevOps)
--
-- Tables : users, files, shares, access_logs
-- Notes  :
--   - Passwords are stored ONLY as hashes (bcrypt/argon2 outputs).
--   - Encryption keys are NEVER stored in the database. encryption_metadata
--     only stores the key *reference* (key_id) + nonce/IV + auth tag.
--   - stored_name is a server-generated internal name; the original filename
--     is metadata only.
-- ============================================================================

BEGIN;

-- gen_random_uuid() for UUID defaults
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- Trigger helper: keep updated_at in sync on every row change
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- users
-- ============================================================================
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100)        NOT NULL
                  CONSTRAINT ck_users_name_length
                  CHECK (char_length(name) BETWEEN 1 AND 100),
    email         VARCHAR(320)        NOT NULL
                  CONSTRAINT ck_users_email_format
                  CHECK (email ~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$'),
    password_hash TEXT                NOT NULL
                  CONSTRAINT ck_users_password_hash_length
                  CHECK (char_length(password_hash) BETWEEN 40 AND 255),
    role          VARCHAR(20)         NOT NULL DEFAULT 'user'
                  CONSTRAINT ck_users_role
                  CHECK (role IN ('user', 'admin')),
    created_at    TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ         NOT NULL DEFAULT now()
);

-- Unique email (case-insensitive) for login lookups
CREATE UNIQUE INDEX uq_users_email ON users (lower(email));
-- Index for role-based admin queries
CREATE INDEX idx_users_role ON users (role);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- files
-- ============================================================================
CREATE TABLE files (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id             UUID              NOT NULL
                         REFERENCES users(id) ON DELETE CASCADE,
    original_name        VARCHAR(255)      NOT NULL
                         CONSTRAINT ck_files_original_name_length
                         CHECK (char_length(original_name) BETWEEN 1 AND 255),
    stored_name          VARCHAR(64)       NOT NULL
                         CONSTRAINT ck_files_no_slashes
                         CHECK (stored_name !~ '[/\\]')          -- path-traversal guard
                         CONSTRAINT ck_files_stored_name_length
                         CHECK (char_length(stored_name) BETWEEN 1 AND 64),
    file_size            BIGINT            NOT NULL DEFAULT 0
                         CONSTRAINT ck_files_size_non_negative
                         CHECK (file_size >= 0),
    mime_type            VARCHAR(255)      NOT NULL DEFAULT 'application/octet-stream',
    file_hash            CHAR(64)          NOT NULL
                         CONSTRAINT ck_files_sha256_hex
                         CHECK (file_hash ~ '^[a-f0-9]{64}$'),    -- SHA-256 hex digest
    encryption_metadata  JSONB             NOT NULL DEFAULT '{}'::jsonb
                         CONSTRAINT ck_files_metadata_is_object
                         CHECK (jsonb_typeof(encryption_metadata) = 'object'),
    created_at           TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- Unique stored names prevent collisions / overwrites in storage
CREATE UNIQUE INDEX uq_files_stored_name ON files (stored_name);
-- Owner file listing
CREATE INDEX idx_files_owner_id ON files (owner_id);
-- Files created in a window (audit / dashboard)
CREATE INDEX idx_files_created_at ON files (created_at);

CREATE TRIGGER trg_files_updated_at
    BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- shares
-- ============================================================================
CREATE TABLE shares (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id        UUID          NOT NULL
                   REFERENCES files(id) ON DELETE CASCADE,
    token          VARCHAR(128)  NOT NULL
                   CONSTRAINT ck_shares_token_chars
                   CHECK (token ~ '^[A-Za-z0-9_-]{16,128}$'),
    password_hash  TEXT          NULL
                   CONSTRAINT ck_shares_password_hash_length
                   CHECK (password_hash IS NULL OR char_length(password_hash) BETWEEN 40 AND 255),
    expires_at     TIMESTAMPTZ   NULL,                          -- NULL = never expires
    max_downloads  INTEGER       NULL
                   CONSTRAINT ck_shares_max_downloads_positive
                   CHECK (max_downloads IS NULL OR max_downloads > 0),  -- NULL = unlimited
    download_count INTEGER       NOT NULL DEFAULT 0
                   CONSTRAINT ck_shares_download_count_non_negative
                   CHECK (download_count >= 0),
    revoked        BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Token is the public share key: unique + indexed for fast lookup
CREATE UNIQUE INDEX uq_shares_token ON shares (token);
-- Shares owned by a file (owner dashboard / revoke list)
CREATE INDEX idx_shares_file_id ON shares (file_id);
-- Expiration sweep + "active shares" queries
CREATE INDEX idx_shares_expires_at ON shares (expires_at);
-- Index for filtering active/non-revoked shares in dashboards
CREATE INDEX idx_shares_revoked ON shares (revoked) WHERE revoked = FALSE;

CREATE TRIGGER trg_shares_updated_at
    BEFORE UPDATE ON shares
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- access_logs
-- ============================================================================
CREATE TABLE access_logs (
    id         BIGSERIAL PRIMARY KEY,
    user_id    UUID         NULL
               REFERENCES users(id) ON DELETE SET NULL,
    file_id    UUID         NULL
               REFERENCES files(id) ON DELETE SET NULL,
    action     VARCHAR(40)  NOT NULL
               CONSTRAINT ck_access_logs_action
               CHECK (action IN (
                   'REGISTER', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT',
                   'UPLOAD', 'DOWNLOAD', 'FILE_DELETE',
                   'SHARE_CREATE', 'SHARE_REVOKE', 'SHARE_ACCESS',
                   'SHARE_ACCESS_FAILED', 'UNAUTHORIZED_ACCESS',
                   'EXPIRED_LINK', 'REVOKED_LINK', 'RATE_LIMITED'
               )),
    result     VARCHAR(10)  NOT NULL
               CONSTRAINT ck_access_logs_result
               CHECK (result IN ('SUCCESS', 'FAILURE', 'DENIED')),
    timestamp  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ip_address INET         NULL,
    user_agent TEXT         NULL
);

-- Dashboard / admin filtering by user
CREATE INDEX idx_access_logs_user_id ON access_logs (user_id);
-- Audit trail: which file was accessed
CREATE INDEX idx_access_logs_file_id ON access_logs (file_id);
-- Time-window queries, "recent security events" feed
CREATE INDEX idx_access_logs_timestamp ON access_logs (timestamp DESC);
-- Attack-detection: failed actions over time
CREATE INDEX idx_access_logs_action_result
    ON access_logs (action, result, timestamp DESC);

COMMIT;