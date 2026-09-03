-- Migration: 005_email_verified_shares.sql
-- Description: Add email-gated share access with one-time codes

-- Add allowed_email to shares
ALTER TABLE shares ADD COLUMN IF NOT EXISTS allowed_email TEXT;

-- One-time access codes for email-verified shares
CREATE TABLE IF NOT EXISTS share_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID NOT NULL REFERENCES shares(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_codes_share ON share_access_codes(share_id);
CREATE INDEX IF NOT EXISTS idx_access_codes_email ON share_access_codes(email);
