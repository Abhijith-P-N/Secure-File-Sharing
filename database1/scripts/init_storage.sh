#!/usr/bin/env bash
# ============================================================================
# Secure File Sharing Platform - Storage initialiser
# Author: Abhijith (Database, Storage & DevOps)
#
# Creates the encrypted storage layout with locked-down permissions.
# The storage tree must NEVER be served by the web server directly.
#
#   storage/
#   ├── encrypted/   <- AES-256-GCM encrypted blobs, server-generated names
#   ├── temporary/   <- in-flight uploads/drafts (cleaned on upload)
#   └── backups/     <- database dumps + encrypted-storage archives
# ============================================================================
set -euo pipefail

STORAGE_ROOT="${STORAGE_PATH:-$(pwd)/storage}"

mkdir -p \
    "$STORAGE_ROOT/encrypted" \
    "$STORAGE_ROOT/temporary" \
    "$STORAGE_ROOT/backups"

# Restrictive ownership/perms: owner rwx, group r-x, nothing for others.
chown -R "$(id -u):$(id -g)" "$STORAGE_ROOT"
chmod 750 "$STORAGE_ROOT"
chmod 750 "$STORAGE_ROOT/encrypted"
chmod 750 "$STORAGE_ROOT/temporary"
chmod 750 "$STORAGE_ROOT/backups"

printf 'Storage initialised at: %s\n' "$STORAGE_ROOT"
ls -la "$STORAGE_ROOT"