FROM node:22-alpine AS builder

WORKDIR /app

# Build context is game/ so both shared/ and server/ are accessible
COPY shared ./shared
COPY server/package*.json ./
RUN npm install

COPY server ./
RUN npm run build

# ─── Production image ─────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
# Migrations live at dist/db/migrations (path.resolve(__dirname, 'migrations') from migrate.js)
COPY server/src/db/migrations ./dist/db/migrations

EXPOSE 3000

CMD ["node", "dist/index.js"]
