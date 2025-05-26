# British Cycling Club Viewer

A web application for tracking and displaying British Cycling race points for riders. This app allows users to view race points across different disciplines (Road & Track, Cyclocross) and filter/sort riders by various criteria.

**Live Demo:** [https://mitre-riders.fly.dev/](https://mitre-riders.fly.dev/)

## Features

- View race points for multiple riders simultaneously
- Filter riders by name, club, race type, and category
- Sort riders by name, race count, or points
- Toggle between light and dark mode
- Responsive design for desktop and mobile
- Caching system to reduce API calls to British Cycling website
- Summary statistics showing total races and points

## Technology Stack

- **Frontend**: React, TailwindCSS
- **Backend**: Node.js, Express
- **Deployment**: Docker, Fly.io

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository
   ```
   git clone https://github.com/linal/mitre-riders.git
   cd british-cycling-club-viewer
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the development server
   ```
   npm run dev
   ```

4. In a separate terminal, start the backend server
   ```
   npm run start-server
   ```

5. Open your browser and navigate to `http://localhost:5173`

## Building for Production

1. Build the frontend
   ```
   npm run build
   ```

2. Start the production server
   ```
   npm start
   ```

## Docker Deployment

The application includes a Dockerfile for containerized deployment:

```
docker build -t british-cycling-club-viewer .
docker run -p 3000:3000 british-cycling-club-viewer
```

## Deployment to Fly.io

The application is configured for deployment to Fly.io using the included `fly.toml` file:

```
fly deploy
```

## Environment Variables

- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment setting ('production' or 'development')

## Caching

The application implements a two-level caching system:
- In-memory cache for quick access
- Disk-based cache for persistence

Cache duration:
- Development: 10 minutes
- Production: 24 hours
- Previous years' data: Never expires