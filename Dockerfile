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

# Install cron and curl
RUN apt-get update && apt-get install -y cron curl
    
# Copy built React app
COPY --from=builder /app/dist ./client
COPY server.js .
    
# Create cron job file that uses the current year
RUN echo '0 4 * * * root /bin/sh -c '\''YEAR=$(date +\%Y) && curl "https://mitre-riders.fly.dev/api/build-cache" -H "accept: */*" -H "accept-language: en-GB,en;q=0.9,en-US;q=0.8" -H "content-type: application/json" --data-raw "{\"year\":\"$YEAR\"}" > /proc/1/fd/1 2>/proc/1/fd/2'\''' > /etc/cron.d/build-cache-cron \
    && chmod 0644 /etc/cron.d/build-cache-cron \
    && crontab /etc/cron.d/build-cache-cron

# Create startup script
RUN echo '#!/bin/bash\ncron\nexec node server.js' > /app/start.sh \
    && chmod +x /app/start.sh
    
EXPOSE 3000
    
# Use environment variable for API URL, defaulting to the container's own address
ENV VITE_API_BASE_URL=
# Set production environment for 24-hour caching
ENV NODE_ENV=production
    
CMD ["/app/start.sh"]