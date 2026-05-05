# ---------- Stage 1: Build (frontend + TypeScript backend) ----------
FROM node:20-bookworm AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
# Avoid downloading Chromium during build; we install Google Chrome ourselves
# in the runtime stage.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

COPY . .

# Vite inlines VITE_* values at build time, so they must be present here -
# setting them as Fly runtime env/secrets is too late. Pass via
# `fly deploy --build-arg VITE_FIREBASE_API_KEY=...` or via [build.args] in
# fly.toml. Firebase web config values are public identifiers, not secrets.
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_STORAGE_BUCKET
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_STORAGE_BUCKET=$VITE_FIREBASE_STORAGE_BUCKET \
    VITE_FIREBASE_MESSAGING_SENDER_ID=$VITE_FIREBASE_MESSAGING_SENDER_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID

RUN npx vite build && npx tsc -p tsconfig.server.json

# ---------- Stage 2: Runtime: Node + Google Chrome ----------
FROM node:20-bookworm
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install Google Chrome + minimal deps + fonts.
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget gnupg ca-certificates fonts-liberation fonts-noto-color-emoji \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 \
    libc6 libcairo2 libcups2 libdbus-1-3 libdrm2 libexpat1 \
    libgbm1 libgcc1 libglib2.0-0 libgtk-3-0 libnss3 libnspr4 \
    libpango-1.0-0 libpangocairo-1.0-0 libpng16-16 libx11-6 \
    libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxshmfence1 \
    libxss1 libxtst6 xdg-utils \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-linux.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Both env vars are read by Puppeteer / our resolveChromeExecutable helper.
ENV CHROME_PATH=/usr/bin/google-chrome
ENV CHROME_EXECUTABLE=/usr/bin/google-chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Production deps only.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Built assets and compiled server code. We ship the JS scraper alongside
# because the TypeScript backend `require`s it directly.
COPY --from=builder /app/dist ./client
COPY --from=builder /app/dist-server ./dist-server
COPY services ./services

EXPOSE 3000
CMD ["node", "dist-server/index.js"]
