# ---------- Stage 1: Build React App ----------
FROM node:18 AS builder

WORKDIR /app

# Copy dependencies and install
COPY package.json package-lock.json* ./
RUN npm install

# Copy app source
COPY . .

# Build the React app
RUN npm run build


# ---------- Stage 2: Serve React + Proxy ----------
FROM node:18

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json* ./
RUN npm install --only=production

# Copy build from previous stage
COPY --from=builder /app/dist ./client
COPY server.js .

# Use serve for frontend and run proxy server
RUN npm install serve

# Expose ports: 4173 for frontend, 3001 for proxy
EXPOSE 4173
EXPOSE 3001

# Start both servers using concurrently
RUN npm install concurrently
CMD concurrently \
    "serve -s client -l 4173" \
    "node server.js"
