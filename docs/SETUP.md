# Setup Instructions - Secure File Sharing Platform

Owner: Abhijith (Database, Storage & DevOps)

Quick start for all four team members - one command gets the database up:

```bash
docker compose up -d
```

This starts **only the database** (works today). Once Azin's `backend/` and
Haroon's `frontend/` code are merged, run the full stack:

```bash
docker compose --profile full up -d --build
```

## 1. Install dependencies

- Docker + Docker Compose v2 (https://docs.docker.com/get-docker/)
  - Linux: install docker engine + compose plugin
  - macOS/Windows: Docker Desktop
- Node.js 20 LTS (needed only for local backend/frontend dev, not for the
  Docker route)
- PostgreSQL client tools (optional; for direct DB access outside Docker)

## 2. Configure environment variables

```bash
cp .env.example .env
# then edit .env - dev defaults are safe for local; production needs real secrets
```

Key values to set even locally: `JWT_SECRET`, `ENCRYPTION_KEY` (see
`.env.example` comments for `openssl` one-liners).

## 3. Start the database

```bash
docker compose up -d          # starts sfs-db
docker compose ps             # verify healthy
```

The schema (`database/schema.sql`) applies automatically on first boot.

Verify:

```bash
docker compose exec db psql -U app_user -d secure_files -c '\dt'
```

## 4. Start the backend

```bash
# via Docker (after backend/ exists)
docker compose --profile full up -d --build backend

# OR locally (dev mode)
cd backend
npm install
cp ../.env .env   # ensure DATABASE_URL uses localhost for local runs
npm run dev
```

## 5. Start the frontend

```bash
# via Docker
docker compose --profile full up -d --build frontend

# OR locally
cd frontend
npm install
npm run dev        # Vite dev server, usually http://localhost:5173
```

## 6. Run migrations

Migrations live in `database/migrations/`. In this setup `001_init.sql`
(== `schema.sql`) runs automatically when the `db` container is first
created. To re-run manually:

```bash
# against Docker db
docker compose exec -T db psql -U app_user -d secure_files < database/migrations/001_init.sql
# or direct
psql "postgresql://app_user:app_password@localhost:5432/secure_files" -f database/migrations/001_init.sql
```

For future schema changes: add `002_*.sql` in `database/migrations/` and
apply it manually (no ORM migration tool is assumed - coordinate with Azin).

## 7. Run tests

There is no shared test runner yet; per-member suites will live beside each
module. Suggested commands once they exist:

```bash
cd backend  && npm test
cd frontend && npm test
```

Infra validation available now:

```bash
bash -n scripts/*.sh                    # shell syntax check
./scripts/init_storage.sh                # create storage layout
./scripts/backup.sh                      # smoke-test a backup
```

## Full stack (all services)

```bash
docker compose --profile full up -d --build
# db        :5432   backend :8000   frontend :5173
```

## Common issues

- Port `5432` already in use locally → change `POSTGRES_PORT` in `.env`.
- Backend can't reach DB when running locally → `DATABASE_URL` must use
  `localhost` (not `db`).
- Forgot the schema → `docker compose down -v` wipes db volume, recreate.
  (Only do this in dev - `-v` destroys data!)