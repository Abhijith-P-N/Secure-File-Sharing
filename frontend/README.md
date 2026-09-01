# VaultGuard Frontend

React 19 single-page application built with Vite 8 and Tailwind CSS 4.

## Tech Stack

- React 19 + React Router 7
- Vite 8 (build tool + dev server)
- Tailwind CSS 4
- Axios (HTTP client with CSRF + token refresh)
- lucide-react (icons)
- Vitest + Testing Library (tests)
- oxlint (linting)

## Development

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173`. The dev server proxies `/api` requests to the backend at `http://localhost:8000`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Run oxlint |
| `npm test` | Run tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

## Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

`VITE_API_BASE_URL` — leave empty to use the Vite dev proxy (`/api` → `:8000`). Set to a full URL for production builds.

## Docker

```bash
docker build -t vaultguard-frontend .
docker run -p 3000:80 vaultguard-frontend
```

The Dockerfile uses a multi-stage build: Node.js for building, Nginx for serving.
