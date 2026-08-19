#!/usr/bin/env bash
# ============================================================================
# Secure File Sharing Platform - Database + Storage backup
# Author: Abhijith (Database, Storage & DevOps)
#
# Backs up:
#   1. PostgreSQL database (pg_dump - consistent logical dump)
#   2. Encrypted file storage (tar.gz of storage/encrypted)
#
# Output: storage/backups/<timestamp>/ with a rotating latest/ pointer.
#
# Usage:
#   ./scripts/backup.sh                    # Docker db service
#   DATABASE_URL=... ./scripts/backup.sh   # direct DB connection
#
# Recommended: run nightly via cron. See docs/BACKUP.md.
# ============================================================================
set -euo pipefail

BACKUP_ROOT="${STORAGE_PATH:-$(pwd)/storage}/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
DEST_DIR="$BACKUP_ROOT/$TIMESTAMP"
STAGING="$(mktemp -d)"
DB_CONTAINER="${DB_CONTAINER:-sfs-db}"
DB_SERVICE="${DB_SERVICE:-db}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

trap 'rm -rf "$STAGING"' EXIT

mkdir -p "$DEST_DIR"

echo "[backup] starting at $TIMESTAMP"

# ----------------------------------------------------------------------------
# 1. Database dump
# ----------------------------------------------------------------------------
DB_DUMP="$STAGING/database_$TIMESTAMP.sql.gz"

if [[ -n "${DATABASE_URL:-}" ]]; then
    echo "[backup] dumping database via DATABASE_URL"
    pg_dump "$DATABASE_URL" | gzip -9 > "$DB_DUMP"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
    echo "[backup] dumping database from compose service $DB_SERVICE"
    docker compose exec -T "$DB_SERVICE" pg_dump \
        -U "${POSTGRES_USER:-app_user}" -d "${POSTGRES_DB:-secure_files}" \
        | gzip -9 > "$DB_DUMP"
else
    echo "[backup] ERROR: no DATABASE_URL and no $DB_CONTAINER container found" >&2
    exit 1
fi

# ----------------------------------------------------------------------------
# 2. Encrypted storage
# ----------------------------------------------------------------------------
ENCRYPTED_DIR="${STORAGE_PATH:-$(pwd)/storage}/encrypted"
if [[ -d "$ENCRYPTED_DIR" ]] && [[ -n "$(ls -A "$ENCRYPTED_DIR" 2>/dev/null)" ]]; then
    echo "[backup] archiving encrypted storage"
    tar -czf "$STAGING/storage_encrypted_$TIMESTAMP.tar.gz" -C "$ENCRYPTED_DIR" .
else
    echo "[backup] encrypted storage empty - skipping archive"
fi

# ----------------------------------------------------------------------------
# 3. Manifest (what was backed up + when)
# ----------------------------------------------------------------------------
{
    echo "backup_timestamp=$TIMESTAMP"
    echo "database_dump=$(basename "$DB_DUMP")"
    echo "storage_archive=$(basename "${STAGING}"/*.tar.gz 2>/dev/null || echo 'none')"
    echo "files_in_storage=$(ls -1 "$ENCRYPTED_DIR" 2>/dev/null | wc -l)"
} > "$STAGING/MANIFEST.txt"

# ----------------------------------------------------------------------------
# 4. Move staged files into place + rotate
# ----------------------------------------------------------------------------
cp "$STAGING"/* "$DEST_DIR/"
rm -rf "$BACKUP_ROOT/latest"
ln -s "$TIMESTAMP" "$BACKUP_ROOT/latest"

# Keep only the last RETENTION_DAYS of backups
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -name '20*' \
    -mtime "+${RETENTION_DAYS}" -exec rm -rf {} + 2>/dev/null || true

echo "[backup] complete: $DEST_DIR"
ls -lah "$DEST_DIR"