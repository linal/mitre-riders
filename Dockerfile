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

# Install Chrome for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
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