# British Cycling Club Viewer

A web application for tracking and displaying British Cycling race points for riders across multiple clubs. Browse club rosters, view rider race history and points across disciplines (Road & Track, Cyclocross), compare riders side‑by‑side, and manage clubs/riders behind an authenticated admin area.

**Live Demo:** [https://mitre-riders.fly.dev/](https://mitre-riders.fly.dev/)

## Features

- Browse a list of clubs and drill into per‑club rider rosters
- Per‑club summary view with aggregated stats
- Per‑rider race points across multiple disciplines and seasons
- Filter riders by name, club, race type, and category
- Sort riders by name, race count, or points
- Compare riders side‑by‑side
- Authenticated admin area (Firebase Auth) for:
  - Managing clubs (`Manage Clubs`)
  - Managing riders (`Manage Riders`)
  - Inspecting and refreshing the cache (`Cache Manager`)
- Light / dark mode that follows system preference
- Responsive design for desktop and mobile
- Two‑level (in‑memory + disk) caching to reduce calls to the British Cycling website
- Separate scheduled job container for periodic cache warming

## Technology Stack

- **Frontend:** React 18, React Router, TailwindCSS, Vite
- **Backend:** Node.js, Express
- **Auth & Data:** Firebase Auth (client) + Firebase Admin SDK (server), Firestore
- **Scraping / data fetching:** Axios, `node-fetch`, Puppeteer
- **Deployment:** Docker, Fly.io

## Project Structure

```
.
├── src/                  # React frontend
│   ├── components/       # UI components (ClubsList, ClubRiders, ClubSummary,
│   │                     # CompareRiders, CacheManager, ManageRiders,
│   │                     # ClubsManager, Login, RegisterUser, etc.)
│   ├── firebase.js       # Firebase client configuration
│   └── main.jsx          # App entry + routes
├── services/             # Server-side data services
│   ├── racerDataService.js
│   └── axiosRacerService.js
├── server.js             # Express API + static file server
├── scripts/              # Cache-building / maintenance scripts
├── cache/                # Local disk cache (gitignored)
├── public/               # Static assets
├── Dockerfile            # Main app image
├── Dockerfile.job        # Cache-building job image
├── fly.toml              # Fly.io config – main app
└── fly.job.toml          # Fly.io config – cache job
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm
- A Firebase project (for auth and Firestore) if you want to run the admin features locally

### Installation

1. Clone the repository
   ```
   git clone https://github.com/linal/mitre-riders.git
   cd bc-points-app
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file in the project root (see [Environment Variables](#environment-variables)).

4. Start the backend server
   ```
   npm run start-server
   ```

5. In a separate terminal, start the Vite dev server
   ```
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5173`. The frontend will proxy API calls to the backend on port 3001.

## Building for Production

1. Build the frontend (output goes to `client/`)
   ```
   npm run build
   ```

2. Start the production server (serves the built frontend on port 4173 and the API via `nodemon server.js`)
   ```
   npm start
   ```

## Docker Deployment

### Main Application

```
docker build -t british-cycling-club-viewer .
docker run -p 3000:3000 british-cycling-club-viewer
```

### Cache Building Job

A separate job container builds/refreshes the cache:

```
docker build -t bc-cache-job -f Dockerfile.job .
docker run bc-cache-job
```

## Deployment to Fly.io

### Main Application

The app is configured for deployment to Fly.io via `fly.toml`:

```
fly deploy
```

In production the cache is persisted to a Fly volume mounted at `/data`.

### Cache Building Job

A separate Fly app handles periodic cache building:

1. Deploy the job:
   ```
   ./run-job.sh
   ```

2. Run the job manually:
   ```
   fly apps restart mitre-riders-job
   ```

3. Schedule the job (example: daily at 02:00 UTC):
   ```
   fly m run . --schedule "0 2 * * *" --app mitre-riders-job
   ```

## Configuration Files

- `Dockerfile` – Main application container
- `Dockerfile.job` – Cache building job container
- `fly.toml` – Main application Fly.io config
- `fly.job.toml` – Cache job Fly.io config
- `nodemon.json` – Backend auto-reload config
- `vite.config.js` – Frontend build/dev config
- `tailwind.config.js` / `postcss.config.js` – Styling toolchain

## Environment Variables

Configuration lives in `.env` (gitignored). Copy the template to get started:

```
cp .env.example .env
```

Then fill in the values. The variables are:

**Server**
- `PORT` – Backend server port (default: `3001`)
- `NODE_ENV` – `development` or `production`

**Firebase Web SDK (frontend)** – from Firebase console → *Project settings → Your apps*:
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`

**Firebase Admin SDK (backend)** – from a service account JSON file (Firebase console → *Project settings → Service accounts → Generate new private key*):
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` – keep newlines escaped as `\n` and wrap the value in double quotes.

Alternatively you can point Firebase Admin at a credentials file on disk via `GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`. On Fly.io these are provided via `fly secrets set`.

> Never commit real values. `.env` is listed in `.gitignore`; only `.env.example` should be checked in.

## Authentication

- Public routes: clubs list, club riders, club summary, compare, about.
- Protected routes (require Firebase login): `/cache`, `/manage-riders`, `/manage-clubs`.
- The server verifies Firebase ID tokens (passed as `Authorization: Bearer <token>`) for write/admin endpoints.

## Caching

The application implements a two-level caching system:

- **In-memory cache** for hot reads
- **Disk-based cache** for persistence
  - Local dev: `./cache`
  - Production (Fly.io): `/data`

Cache duration:
- Development: 10 minutes
- Production: 24 hours
- Previous years' data: never expires (treated as immutable)

The `Cache Manager` admin page lets authenticated users inspect and invalidate cached entries.
