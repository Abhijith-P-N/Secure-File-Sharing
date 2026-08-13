# Backup & Recovery - Secure File Sharing Platform

Owner: Abhijith (Database, Storage & DevOps)

## What is backed up

1. **PostgreSQL database** - logical dump via `pg_dump` (consistent snapshot
   of all tables: users, files, shares, access_logs).
2. **Encrypted storage** - `tar.gz` archive of `storage/encrypted`. Because
   the blobs are already encrypted, the archive is safe to move off-host.

Both are produced together so metadata and blobs stay in lockstep.

## Scripts

- `scripts/backup.sh`  - dump DB + archive storage into
  `storage/backups/<timestamp>/`, with a `latest/` symlink and retention.
- `scripts/restore.sh <backup_dir>` - drop/recreate the DB from the dump and
  extract the storage archive back into `storage/encrypted`.

### Backup (examples)

```bash
# Local dev against the Docker db service
./scripts/backup.sh

# Direct connection (or via cron)
DATABASE_URL=postgresql://app_user:app_password@localhost:5432/secure_files ./scripts/backup.sh

# Keep more backups (default retention: 7 days)
RETENTION_DAYS=30 ./scripts/backup.sh
```

### Restore (WARNING: overwrites current DB + storage)

```bash
./scripts/restore.sh storage/backups/20260813_143000
```

## Schedule (recommended)

| What            | Frequency | When                          |
|-----------------|-----------|-------------------------------|
| Database dump   | Daily     | 02:00 local time (low traffic)|
| Storage archive | Daily     | same run as the dump          |
| Off-site copy   | Daily     | rsync storage/backups to object storage |

Cron example (production host):

```
0 2 * * * cd /srv/secure-file-sharing && DATABASE_URL=$DATABASE_URL ./scripts/backup.sh >> /var/log/sfs-backup.log 2>&1
```

## Recovery process

1. Stop app writes (or accept a short window) - `docker compose --profile full stop`.
2. Pick the backup: `storage/backups/<timestamp>/` (check `MANIFEST.txt`).
3. Restore DB: `./scripts/restore.sh storage/backups/<timestamp>`.
4. Verify integrity: start the stack, spot-check `SELECT count(*) FROM files;`
   and that stored-name → blob counts match the backup manifest.
5. Confirm a known share link still downloads and the hash verifies.

## Backup hardening

- Backup files inherit restrictive permissions (`750` dirs).
- The DB dump contains **hashed passwords only** - no plaintext, no keys.
- `ENCRYPTION_KEY`/`JWT_SECRET` are NOT backed up - they must be kept
  separately (secret manager / vault) or recovery cannot decrypt blobs.
- Test restore at least once before the demo (Day 21 requirement).