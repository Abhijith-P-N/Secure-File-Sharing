# Deployment & Monitoring - Secure File Sharing Platform

Owner: Abhijith (Database, Storage & DevOps)

## Production topology

```
Browser (HTTPS)
   │
   ▼
nginx reverse proxy (docker/nginx/nginx.conf)  - TLS termination, headers, size caps
   │                    ├── /api/* → backend :8000
   │                    └── /      → frontend :80
   ▼
backend API (Node/Express)            - auth, validation, download streams
   │
   ├── PostgreSQL 16 (db service)     - metadata + audit logs
   └── storage/encrypted (volume)     - AES-256-GCM blobs, never served by nginx
```

## HTTPS (Let's Encrypt)

1. Point `DOMAIN` at your server's public IP.
2. Set `DOMAIN` and optionally `NGINX_SERVER_NAME` in `.env`.
3. Start the stack and obtain a certificate once the A record resolves:

```bash
docker compose --profile prod up -d
# obtain certs (certbot companion or manual certbot run):
docker run --rm -v sfs-certbot:/etc/letsencrypt -v sfs-certbot-www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot -d example.com --email you@example.com
docker compose --profile prod restart nginx
```

The proxy redirects HTTP → HTTPS and renews via ACME on the
`/.well-known/acme-challenge/` route. `HSTS` is already set in
`docker/nginx/nginx.conf`.

## Environment variables

`cp .env.example .env`, then set (never commit `.env`):

- `DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD` - DB access
- `JWT_SECRET` - `openssl rand -hex 64`
- `ENCRYPTION_KEY` - `openssl rand -hex 32` (AES-256 key), `ENCRYPTION_KEY_ID`
- `DOMAIN` / `NGINX_SERVER_NAME` - HTTPS hostname
- `CORS_ORIGIN` / `FRONTEND_URL` - must match the frontend origin exactly
- `STORAGE_PATH`, `MAX_FILE_SIZE`

In production, prefer a secret manager (e.g. Docker secrets / Vault) over a
plain `.env`.

## CORS / DB / storage configuration

- **CORS origin**: set `CORS_ORIGIN=https://example.com` (not `*`). Preflight
  is handled by the backend (Azin).
- **Database connection**: in Docker the backend uses the compose network
  hostname `db` (already set in `docker-compose.yml`). Never expose
  PostgreSQL to the public internet - the `db` port should be internal; the
  compose `ports:` mapping is for local dev only.
- **Storage permissions**: `scripts/init_storage.sh` sets `750`; the backend
  container runs as a non-root user with only the storage volume mounted.

## Production logging

Backend and nginx logs should go to stdout/stderr and be captured by the
host or a log aggregator (journald / Loki / CloudWatch). Never log:

- passwords (or password hashes)
- JWT secrets / tokens
- encryption keys (`ENCRYPTION_KEY`) or key IDs in plaintext context
- file contents or decrypted payloads
- full `.env` values

## Monitoring (see table)

| Event                    | Source                  | Alert |
|--------------------------|-------------------------|-------|
| Server errors (5xx)      | backend log / nginx error log | yes |
| Failed authentication    | access_logs: LOGIN_FAILED, SHARE_ACCESS_FAILED | yes |
| Storage errors           | backend storage logger (I/O, checksum mismatch) | yes |
| Database errors          | db container logs, connection failures | yes |
| Security events          | access_logs: UNAUTHORIZED_ACCESS, EXPIRED_LINK, REVOKED_LINK, RATE_LIMITED | yes |

Map: query `access_logs` for `result = 'FAILURE'/'DENIED'` high-frequency
spikes, tail nginx `error.log` for 5xx, and watch the db container's health
(`pg_isready` healthcheck already configured in compose).

A lightweight option for the team: a cron that greps the last hour of logs
for 5xx / `UNAUTHORIZED` spikes and emails/pings a webhook. Keep it simple -
no credentials in the log pipeline.