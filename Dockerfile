# ---------- Stage 1: Build React App ----------
FROM node:18 AS builder

WORKDIR /app
    
COPY package.json package-lock.json* ./
# Install all dependencies including devDependencies
RUN npm install
    
COPY . .
# Use npx to ensure vite is found in the path
RUN npx vite build
    
# ---------- Stage 2: Serve with Express ----------
FROM node:18
    
WORKDIR /app
    
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Install Chrome dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libxss1 \
    libgconf-2-4 \
    && rm -rf /var/lib/apt/lists/*
    
# Copy built React app
COPY --from=builder /app/dist ./client
COPY server.js .
COPY services ./services
    
EXPOSE 3000
    
# Use environment variable for API URL, defaulting to the container's own address
ENV VITE_API_BASE_URL=
# Set production environment for 24-hour caching
ENV NODE_ENV=production
    
CMD ["node", "server.js"]