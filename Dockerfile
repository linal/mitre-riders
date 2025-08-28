# ---------- Stage 1: Build React App ----------
FROM node:20-bookworm AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
# Avoid downloading Chromium during build if using puppeteer (not puppeteer-core)
# We install Google Chrome ourselves in the runtime stage.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci

COPY . .
RUN npx vite build

# ---------- Stage 2: Runtime: Node + Google Chrome ----------
FROM node:20-bookworm
WORKDIR /app

# App env
ENV NODE_ENV=production
ENV PORT=3000

# 1) Install Google Chrome + minimal deps + fonts (for PDF/text rendering)
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

# 2) Ensure Puppeteer finds Chrome and doesn’t try to download its own
ENV CHROME_PATH=/usr/bin/google-chrome
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
ENV PUPPETEER_SKIP_DOWNLOAD=true

# 3) Install only production deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# 4) Copy built assets and server code
COPY --from=builder /app/dist ./client
COPY server.js .
COPY services ./services

EXPOSE 3000
CMD ["node", "server.js"]
