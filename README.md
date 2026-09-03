# VaultGuard — Secure File Sharing Platform

A full-stack, security-focused file-sharing web application with end-to-end encryption, zero-trust access controls, and comprehensive audit logging.

Upload files, encrypt them with AES-256-GCM, share via secure links with optional password protection, expiration, and download limits — all with ownership-based authorization and full audit trails.

## Features

- **AES-256-GCM encryption** — every file encrypted at rest with envelope encryption
- **SHA-256 integrity verification** — files verified on every download
- **Secure share links** — CSPRNG-generated tokens with optional:
  - Password protection (scrypt-hashed)
  - Expiration (1h, 6h, 24h, 7d or custom)
  - Download limits with atomic counters
- **Zero-trust authorization** — ownership checked on every request, no IDOR vulnerabilities
- **Two-factor authentication (TOTP)** — with QR code setup
- **Admin dashboard** — user/file management, security events, role management
- **Comprehensive audit logging** — every login, upload, download, and failure tracked
- **Chunked/resumable uploads** — for large files with SHA-256 verification
- **Full-text search** — over file metadata using PostgreSQL tsvector
- **Dark mode** — built-in theme switching

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7 |
| Backend | Node.js 20+, Express 5, PostgreSQL 16 |
| Security | Node.js crypto (AES-256-GCM, scrypt, SHA-256) — zero dependencies |
| DevOps | Docker, Nginx, GitHub Actions CI/CD, Render Blueprint |

## Project Structure

```
├── frontend/                    # React SPA (Vite + Tailwind)
├── secure-file-backend/         # Express REST API
├── security/                    # Standalone crypto module (zero deps)
├── database1/                   # Schema, migrations, infra docs
├── docker-compose.yml           # Full stack (postgres + backend + frontend)
└── render.yaml                  # Render Blueprint deploy config
```

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use Docker)
- npm

### Windows (one-command setup)

On Windows, run the all-in-one setup script — it installs dependencies, generates
secure keys, creates `.env` files, and starts the whole stack for you:

```
1. Install Node.js 20+ (LTS):  https://nodejs.org/  (npm is included)
2. Double-click  setup-windows.bat   (or run it from a terminal)
```

What the script does:
- Checks that Node.js / npm are installed
- `npm install` in `secure-file-backend`, `frontend`, and `security`
- Creates `.env` files (if missing) and auto-generates `JWT_SECRET` + `FILE_ENCRYPTION_KEY`
- Starts **embedded PostgreSQL** (auto-downloads binaries on first run — no Docker needed)
- Starts the backend API and the frontend
- Seeds the admin account and opens your browser

> Requires an Internet connection on the *first* run (to download npm packages and
> the embedded PostgreSQL binaries). Each service runs in its own window.

### 1. Clone

```bash
git clone https://github.com/Abhijith-P-N/Secure-File-Sharing-.git
cd Secure-File-Sharing-
```

### 2. Environment

```bash
cp .env.example .env
```

Edit `.env` and generate secure keys:

```bash
# Generate JWT secret
openssl rand -hex 64

# Generate file encryption key
openssl rand -hex 32
```

### 3. Run with Docker (recommended)

```bash
docker compose up --build
```

This starts:
- **PostgreSQL** on port `5432`
- **Backend API** on port `8000`
- **Frontend** on port `3000`

### 4. Run locally (development)

**Backend:**

```bash
cd secure-file-backend
npm install
cp .env.example .env    # configure your keys
npm run dev
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173` and proxies `/api` to the backend.

### 5. Seed admin account

```bash
cd secure-file-backend
npm run seed:admin
```

Default: `admin@secure-share.local` / `ChangeMe_Admin_2026`

## API Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Create account |
| POST | `/api/auth/login` | No | Login, get JWT |
| POST | `/api/auth/refresh` | No | Rotate refresh token |
| POST | `/api/auth/logout` | Yes | Revoke refresh token |
| GET | `/api/auth/me` | Yes | Current user |
| POST | `/api/files/upload` | Yes | Upload encrypted file |
| GET | `/api/files` | Yes | List your files |
| GET | `/api/files/:id` | Yes | File metadata |
| GET | `/api/files/:id/download` | Yes | Download file |
| DELETE | `/api/files/:id` | Yes | Delete file |
| POST | `/api/shares` | Yes | Create share link |
| GET | `/api/shares` | Yes | List your shares |
| GET | `/api/shares/:token` | No | Share metadata |
| POST | `/api/shares/:token/download` | No | Download shared file |
| POST | `/api/shares/:id/revoke` | Yes | Revoke share |
| GET | `/api/logs` | Yes | Your audit logs |
| GET | `/api/admin/users` | Admin | All users |
| GET | `/api/admin/files` | Admin | All files |
| GET | `/api/admin/stats` | Admin | Platform stats |

Full API documentation: [`secure-file-backend/README.md`](secure-file-backend/README.md)

## Security

- **Encryption at rest**: AES-256-GCM with envelope encryption (per-file key wrapped by master key)
- **Integrity**: SHA-256 recomputed and verified on every download
- **Authentication**: JWT (HS256) with refresh token rotation
- **Password hashing**: bcrypt (12 rounds) / scrypt for share passwords
- **Rate limiting**: Global, auth-specific, and share-download limits
- **Security headers**: Helmet.js
- **Input validation**: Zod schemas
- **Magic-byte validation**: file-type library verifies uploaded content matches declared MIME type
- **SQL injection protection**: Parameterized queries throughout
- **Audit logging**: Every security-relevant event recorded

For the full threat model and crypto design, see [`security/docs/security.md`](security/docs/security.md).

## Testing

**Backend:**

```bash
cd secure-file-backend
npm test                    # unit + integration tests
npm run test:integration    # integration tests only
```

**Frontend:**

```bash
cd frontend
npm test                    # run all tests
npm run test:coverage       # with coverage report
```

**Security module:**

```bash
cd security
npm test                    # 59 automated crypto/security tests
npm run security:test       # 36 live curl-based security checks
```

## Deployment

### Docker Compose

```bash
docker compose up -d --build
```

### Render

The project includes a Render Blueprint (`render.yaml`) for one-click deployment:

1. Push to GitHub
2. Connect repo to Render
3. Render Blueprint provisions: database, backend (with persistent disk), and frontend

See [`database1/docs/DEPLOYMENT.md`](database1/docs/DEPLOYMENT.md) for production hardening details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- All tests pass (`npm test` in backend and frontend)
- Code follows existing conventions
- New features include tests where applicable

## Team

| Name | Role |
|---|---|
| Abhijith | Database, Storage & DevOps |
| Adhil | Security & Encryption |
| Azin | Backend & API |
| Haroon | Frontend & UI |

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
