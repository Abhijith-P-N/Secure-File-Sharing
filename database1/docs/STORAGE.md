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

> Note: the **concrete** backend implementation stores encrypted blobs in
> `UPLOAD_DIR` (default `secure-file-backend/uploads`) as `<uuid>.bin` files.
> The `storage/encrypted` tree below is the same idea - a private, encrypted,
> never-served volume - wired into the Docker deployment via `UPLOAD_DIR`. The
> security rules here apply to that directory too.

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

## Encrypted blob layout (coordination point with Adhil)

Each stored blob is produced by `secure-file-backend/src/services/security.service.js`
and has this header:

```
[12-byte IV][16-byte GCM auth tag][AES-256-GCM ciphertext]
```

- Nonce/IV + auth tag travel with the blob; there is no
  `files.encryption_metadata` column anymore.
- The key (`FILE_ENCRYPTION_KEY`, a 32-byte value) lives only in the
  environment (`.env`, secret manager in prod) - never on disk beside the
  blob and never in the DB.
- `files.sha256` stores the SHA-256 of the **plaintext**; it is recomputed
  after decryption on every download and compared before bytes are sent
  (integrity verification).