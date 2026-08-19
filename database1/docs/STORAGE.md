# Storage - Secure File Sharing Platform

Owner: Abhijith (Database, Storage & DevOps)

## Layout

```
storage/
├── encrypted/    AES-256-GCM encrypted blobs, server-generated names only
├── temporary/    in-flight uploads/drafts, wiped after upload
└── backups/      database dumps + encrypted-storage archives (see BACKUP.md)
```

`scripts/init_storage.sh` creates the layout with restrictive permissions
(`750`, owner rwx / group r-x / other none). Run it before first use:
`STORAGE_PATH=./storage ./scripts/init_storage.sh`

## Key rules

1. **Original filenames are metadata only.** Never used as physical storage
   names. The backend stores the user-supplied name in `files.original_name`
   and generates the on-disk name (`files.stored_name`).
2. **Generated internal names.** Example mapping used by the platform:

   ```
   Original:  secret-report.pdf
   Stored as: <sha256-of-content>.enc        (allows dedup + no collisions)
   DB row :   stored_name = "a7f82c...f2e4.enc", original_name = "secret-report.pdf"
   ```

3. **Files stored in `encrypted/` are post-encryption blobs** (AES-256-GCM
   produced by Adhil's module). Raw plaintext never lands in `encrypted/`.
4. **`temporary/` is a scratch area only** - never read back from there after
   an upload completes; it is cleaned up immediately.
5. **Storage is never served by the web server.** Only the backend API may
   touch these paths, and it returns decrypted streams only to authorized
   users. No nginx `location` block points at `storage/`.

## Security protections

| Threat                      | Mitigation |
|-----------------------------|------------|
| Path traversal (`../../`)   | Server-generated names; DB CHECK rejects `/` `\`; resolve+prefix-validate all paths in storage code |
| Direct public access        | storage/ mounted as a private bound volume, never exposed by nginx |
| Filename injection          | original_name is stored as data and only sent back as `Content-Disposition` filename after sanitization |
| Unauthorized filesystem acc | non-root app user; `750` dirs; backend container gets only the storage mount |
| Accidental exposure         | `.gitignore` excludes all real content (`storage/encrypted/**`, `temporary`, `backups`); `encrypted/` only holds `.enc` blobs |

Reference for backend storage code (Azin/Adhil): always build the final path
with `path.join(STORAGE_PATH, 'encrypted', stored_name)` against a stored,
validated `stored_name`, and refuse any name that resolves outside
`encrypted/`.

## Encryption metadata (coordination point with Adhil)

`files.encryption_metadata` holds the per-file nonce/IV, auth tag,
algorithm name and `key_id`. The actual `ENCRYPTION_KEY` lives only in the
environment (`.env`, secret manager in prod) - never on disk beside the
blob and never in the DB. See Adhil's crypto design.