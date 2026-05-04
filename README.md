# British Cycling Club Viewer

A web application for tracking and displaying British Cycling race points for riders across multiple clubs. Browse club rosters, view rider race history and points across disciplines (Road & Track, Cyclocross), compare riders side-by-side, and manage clubs/riders behind an authenticated admin area.

**Live Demo:** [https://mitre-riders.fly.dev/](https://mitre-riders.fly.dev/)

## Features

- Browse clubs and drill into per-club rider rosters
- Per-club summary view with year-over-year comparisons
- Per-rider race points across multiple disciplines and seasons
- Filter and sort riders (name, races, points, category)
- Compare riders side-by-side via shareable URLs
- Authenticated admin area (Firebase Auth):
  - Manage clubs (`/manage-clubs`)
  - Manage riders (`/manage-riders`)
  - Inspect / refresh cache (`/cache`)
- Tailwind dark mode that follows system preference
- Two-level (in-memory + disk) caching to reduce calls to the British Cycling site
- Separate scheduled job container for periodic cache warming

## Technology Stack

- **Frontend:** React 18 + TypeScript, Vite, React Router, TailwindCSS, TanStack Query
- **Backend:** Node.js 20 + TypeScript, Express, Zod, Pino, Helmet, express-rate-limit
- **Auth:** Firebase Auth (client) + Firebase Admin SDK (server)
- **Scraping:** Puppeteer (with Cloudflare-aware retry instrumentation)
- **Tests:** Vitest, @testing-library/react, Supertest, Playwright (smoke)
- **Deployment:** Docker, Fly.io

## Project Structure

```
.
├── src/                       # React frontend (TypeScript)
│   ├── app/                   # Entry, providers, routes, navigation
│   ├── shared/
│   │   ├── api/               # Single fetch client + typed endpoints
│   │   ├── hooks/             # React Query hooks, useAuth
│   │   ├── theme/             # ThemeProvider (Tailwind dark: variant)
│   │   └── ui/                # PageContainer, PageOverlay, banners
│   ├── features/
│   │   ├── about/
│   │   ├── admin/             # CacheManager, ManageRiders, ClubsManager
│   │   ├── auth/              # Login, RegisterUser, ProtectedRoute, AuthStatus
│   │   ├── clubs/             # ClubsList, ClubRiders, ClubSummary, RiderCard, FilterControls
│   │   └── compare/           # CompareRiders
│   ├── firebase.ts
│   └── main.tsx
├── src-server/                # Express API (TypeScript)
│   ├── index.ts               # Bootstrap + graceful shutdown
│   ├── app.ts                 # Express app + middleware wiring
│   ├── config/                # env (zod), logger (pino), firebase admin
│   ├── middleware/            # auth, validation, error handling
│   ├── routes/                # raceData, racers, clubs, cache
│   ├── schemas/               # Zod request schemas
│   └── services/              # cacheStore, racersStore, clubsStore, racerScraper
├── services/                  # Long-lived JS Puppeteer scraper + JSON logger
├── tests/                     # Vitest unit + integration tests
│   ├── client/                # React component + api client tests
│   ├── server/                # Supertest route tests
│   └── e2e/                   # Playwright smoke tests
├── cache/                     # Local disk cache (gitignored)
├── public/                    # Static assets
├── Dockerfile                 # Main app image
├── Dockerfile.job             # Cache-building cron container
├── fly.toml                   # Fly.io config – main app
└── fly.job.toml               # Fly.io config – cache job
```

## Getting Started

### Prerequisites

- Node.js v20 or higher
- npm
- A Firebase project (for auth) if you want to run the admin features locally

### Installation

```sh
git clone https://github.com/linal/mitre-riders.git
cd bc-points-app
npm install
cp .env.example .env   # then fill in values - see Environment Variables below
```

### Run locally

In two terminals:

```sh
npm run start-server   # Express + tsx watcher on http://localhost:3001
npm run dev            # Vite dev server on http://localhost:3000 (proxies /api to 3001)
```

Open http://localhost:3000.

### Common scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server (frontend) |
| `npm run start-server` | Backend with `tsx watch` (TypeScript without a build step) |
| `npm run build` | Build frontend to `client/` |
| `npm run build:server` | Compile backend to `dist-server/` |
| `npm start` | Serve built frontend + run compiled backend |
| `npm run lint` / `npm run lint:fix` | ESLint (flat config) |
| `npm run format` / `npm run format:check` | Prettier |
| `npm run typecheck` | `tsc -b` over both client and server projects |
| `npm test` | Vitest unit/integration tests |
| `npm run test:e2e` | Playwright smoke tests |

## Building for Production

```sh
npm run build && npm run build:server
npm start   # serves client/ on :4173 and runs dist-server/index.js
```

## Docker Deployment

### Main Application

```sh
docker build -t british-cycling-club-viewer .
docker run -p 3000:3000 british-cycling-club-viewer
```

### Cache Building Job

A separate container periodically posts to `/api/build-cache`:

```sh
docker build -t bc-cache-job -f Dockerfile.job .
docker run -e CACHE_BUILD_TOKEN=... bc-cache-job
```

## Deployment to Fly.io

### Main Application

```sh
fly deploy
```

In production the cache is persisted to a Fly volume mounted at `/data`.

### Cache Building Job

The cron job and the main app share a `CACHE_BUILD_TOKEN` so the job can hit the protected `/api/build-cache` endpoint without a per-user Firebase token.

```sh
# 1. Generate a long random secret and set it on BOTH apps:
fly secrets set --app mitre-riders     CACHE_BUILD_TOKEN=<long-random-string>
fly secrets set --app mitre-riders-job CACHE_BUILD_TOKEN=<same-value>

# 2. Deploy + schedule the job (idempotent):
./run-job.sh

# 3. Run on demand:
fly apps restart mitre-riders-job
```

## Environment Variables

Configuration lives in `.env` (gitignored). See `.env.example` for the full template. Highlights:

**Server**
- `PORT` (default `3001`)
- `NODE_ENV` (`development` | `production` | `test`)
- `LOG_LEVEL` (`debug|info|warn|error`)
- `LOG_PRETTY=1` to enable pretty Pino output in dev
- `ALLOWED_ORIGINS` – comma-separated CORS allowlist
- `CACHE_DIR` – override cache location
- `CACHE_BUILD_TOKEN` – shared secret for the cache-warm cron job

**Frontend (Vite)** – read at build time and exposed to the browser, so use the `VITE_` prefix:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_API_BASE_URL` (optional; defaults to current origin)

**Firebase Admin SDK (server)** – from a service account JSON:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (escape newlines as `\n`)

Or point Firebase Admin at a credentials file via `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`. On Fly.io these are provided via `fly secrets set`.

> Never commit real values. `.env` is in `.gitignore`; only `.env.example` is tracked.

## Authentication

- Public routes: clubs list, club riders, club summary, compare, about.
- Protected routes (require Firebase login): `/cache`, `/manage-riders`, `/manage-clubs`.
- The server verifies Firebase ID tokens (passed as `Authorization: Bearer <token>`) for write/admin endpoints, and additionally accepts the `X-Cache-Build-Token` header on `/api/build-cache` for the cron job.

## Caching

Two-level cache:
- **In-memory** for hot reads
- **Disk** (`./cache` in dev, `/data` in prod) for persistence

Cache TTL:
- Development: 10 minutes
- Production: 24 hours
- Previous years: never expire (treated as immutable)

The `Cache Manager` admin page lets authenticated users inspect, rebuild, and invalidate cached entries.
