FROM node:22-alpine AS builder

WORKDIR /app

# Copy shared package (server imports from it via path alias)
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
# Migrations live at dist/db/migrations (path.resolve(__dirname, 'migrations') from migrate.js)
COPY src/db/migrations ./dist/db/migrations

EXPOSE 3000

CMD ["node", "dist/index.js"]
