-- Migration: 004_fulltext_search.sql
-- Description: Add full-text search capability on files

-- Add tsvector column for full-text search
ALTER TABLE files ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_files_search ON files USING GIN(search_vector);

-- Populate search_vector from existing data
UPDATE files SET search_vector = 
  setweight(to_tsvector('english', coalesce(original_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(mime_type, '')), 'B');

-- Create trigger to keep search_vector in sync on INSERT
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