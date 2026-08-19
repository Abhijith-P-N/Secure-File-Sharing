#!/usr/bin/env bash
# ============================================================================
# Secure File Sharing Platform - Database + Storage restore
# Author: Abhijith (Database, Storage & DevOps)
#
# Usage:
#   ./scripts/restore.sh <backup_dir>
#
# Example:
#   ./scripts/restore.sh storage/backups/20260813_143000
#
# Restores from a backup produced by scripts/backup.sh:
#   1. PostgreSQL dump  -> restores into a (re)created database
#   2. encrypted storage archive -> extracted back into storage/encrypted
#
# WARNING: This OVERWRITES the current database and encrypted storage.
# Run it only after confirming the target backup is correct.
# ============================================================================
set -euo pipefail

BACKUP_DIR="${1:?usage: restore.sh <backup_dir>}"
[[ -d "$BACKUP_DIR" ]] || { echo "ERROR: $BACKUP_DIR not found" >&2; exit 1; }

DB_CONTAINER="${DB_CONTAINER:-sfs-db}"
DB_SERVICE="${DB_SERVICE:-db}"
DB_NAME="${POSTGRES_DB:-secure_files}"
DB_USER="${POSTGRES_USER:-app_user}"

echo "[restore] reading backup from $BACKUP_DIR"
cat "$BACKUP_DIR"/MANIFEST.txt 2>/dev/null || echo "[restore] no manifest found"

# ----------------------------------------------------------------------------
# 1. Restore database
# ----------------------------------------------------------------------------
DB_DUMP="$(find "$BACKUP_DIR" -name 'database_*.sql.gz' | head -1)"
if [[ -z "$DB_DUMP" ]]; then
    echo "[restore] ERROR: no database dump found" >&2
    exit 1
fi

if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "[restore] restoring database via DATABASE_URL"
    dropdb --if-exists "$DATABASE_URL" 2>/dev/null || true
    createdb "$DATABASE_URL"
    gunzip -c "$DB_DUMP" | psql "$DATABASE_URL"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
    echo "[restore] restoring database in compose service $DB_SERVICE"
    docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d postgres \
        -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);"
    docker compose exec -T "$DB_SERVICE" psql -U "$DB_USER" -d postgres \
        -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
    gunzip -c "$DB_DUMP" | docker compose exec -T "$DB_SERVICE" \
        psql -U "$DB_USER" -d "$DB_NAME"
else
    echo "[restore] ERROR: no DATABASE_URL and no $DB_CONTAINER container found" >&2
    exit 1
fi

# ----------------------------------------------------------------------------
# 2. Restore encrypted storage
# ----------------------------------------------------------------------------
STORAGE_ARCHIVE="$(find "$BACKUP_DIR" -name 'storage_encrypted_*.tar.gz' | head -1)"
ENCRYPTED_DIR="${STORAGE_PATH:-$(pwd)/storage}/encrypted"
mkdir -p "$ENCRYPTED_DIR"

if [[ -n "$STORAGE_ARCHIVE" ]]; then
    echo "[restore] extracting encrypted storage archive"
    # Remove existing blobs before restoring to avoid stale files
    find "$ENCRYPTED_DIR" -mindepth 1 -maxdepth 1 -type f -exec rm -f {} +
    tar -xzf "$STORAGE_ARCHIVE" -C "$ENCRYPTED_DIR"
else
    echo "[restore] no storage archive found - skipping"
fi

echo "[restore] complete"
