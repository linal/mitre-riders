# ---------- Stage 1: Build React App ----------
    FROM node:18 AS builder

    WORKDIR /app
    
    COPY package.json package-lock.json* ./
    RUN npm install
    
    COPY . .
    RUN npm run build
    
    # ---------- Stage 2: Serve React + Proxy ----------
    FROM node:18
    
    WORKDIR /app
    
    COPY package.json package-lock.json* ./
    RUN npm install --omit=dev
    
    COPY --from=builder /app/dist ./client
    COPY server.js .
    
    EXPOSE 4173
    EXPOSE 3001
    
    CMD concurrently \
      "serve -s client -l 4173" \
      "node server.js"