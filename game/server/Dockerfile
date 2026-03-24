FROM node:22-alpine AS builder

WORKDIR /app

# Copy shared package first (server depends on it)
COPY ../shared /shared
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Production image ─────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./src/db/migrations

EXPOSE 3000

CMD ["node", "dist/index.js"]
