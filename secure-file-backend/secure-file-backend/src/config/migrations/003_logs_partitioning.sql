-- Migration: 003_logs_partitioning.sql
-- Description: Convert access_logs to partitioned table by month for performance

-- Create the new partitioned table
CREATE TABLE access_logs_partitioned (
  id BIGSERIAL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  ip TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next 12 months
CREATE TABLE access_logs_y2026m01 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE access_logs_y2026m02 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE access_logs_y2026m03 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE access_logs_y2026m04 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE access_logs_y2026m05 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE access_logs_y2026m06 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE access_logs_y2026m07 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE access_logs_y2026m08 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE access_logs_y2026m09 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE access_logs_y2026m10 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE access_logs_y2026m11 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE access_logs_y2026m12 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE access_logs_y2027m01 PARTITION OF access_logs_partitioned
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

-- Default partition for any dates outside defined ranges
CREATE TABLE access_logs_default PARTITION OF access_logs_partitioned DEFAULT;

-- Create indexes on the partitioned table
CREATE INDEX idx_logs_partitioned_user ON access_logs_partitioned(user_id);
CREATE INDEX idx_logs_partitioned_created ON access_logs_partitioned(created_at DESC);
CREATE INDEX idx_logs_partitioned_action ON access_logs_partitioned(action);

-- Migrate existing data (if old table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'access_logs' AND schemaname = 'public') THEN
    INSERT INTO access_logs_partitioned (id, user_id, action, resource_type, resource_id, success, ip, user_agent, details, created_at)
    SELECT id, user_id, action, resource_type, resource_id, success, ip, user_agent, details, created_at
    FROM access_logs;

    DROP TABLE access_logs;
    ALTER TABLE access_logs_partitioned RENAME TO access_logs;
    ALTER INDEX idx_logs_partitioned_user RENAME TO idx_logs_user;
    ALTER INDEX idx_logs_partitioned_created RENAME TO idx_logs_created;
    ALTER INDEX idx_logs_partitioned_action RENAME TO idx_logs_action;
  ELSE
    ALTER TABLE access_logs_partitioned RENAME TO access_logs;
    ALTER INDEX idx_logs_partitioned_user RENAME TO idx_logs_user;
    ALTER INDEX idx_logs_partitioned_created RENAME TO idx_logs_created;
    ALTER INDEX idx_logs_partitioned_action RENAME TO idx_logs_action;
  END IF;
END $$;