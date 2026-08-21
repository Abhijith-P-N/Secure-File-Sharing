-- Migration: 002_soft_deletes.sql
-- Description: Add soft delete support for audit trail

-- Add deleted_at columns
ALTER TABLE files ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE shares ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

-- Create indexes for soft delete queries
CREATE INDEX IF NOT EXISTS idx_files_deleted ON files(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shares_deleted ON shares(deleted_at) WHERE deleted_at IS NOT NULL;