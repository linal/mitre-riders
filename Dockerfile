# ---------- Stage 1: Build React App ----------
    FROM node:18 AS builder

    WORKDIR /app
    
    COPY package.json package-lock.json* ./
    RUN npm install
    
    COPY . .
    RUN npm run build
    
    # ---------- Stage 2: Serve with Express ----------
    FROM node:18
    
    WORKDIR /app
    
    COPY package.json package-lock.json* ./
    RUN npm install --omit=dev
    
    # Copy built React app
    COPY --from=builder /app/dist ./client
    COPY server.js .
    
    EXPOSE 3000
    
    CMD ["node", "server.js"]
    