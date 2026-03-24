FROM node:22-alpine AS builder

# Use /workspace so directory structure mirrors the repo:
#   /workspace/shared/   ← shared package
#   /workspace/server/   ← server source
# This preserves all relative import paths (e.g. ../../../shared/src/...)
WORKDIR /workspace

COPY shared ./shared
COPY server ./server

WORKDIR /workspace/server
RUN npm install
RUN npm run build

# ─── Production image ─────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /workspace/server

ENV NODE_ENV=production

COPY server/package*.json ./
RUN npm install --omit=dev

COPY --from=builder /workspace/server/dist ./dist
# Migrations path: dist/db/migrations (matches path.resolve(__dirname, 'migrations') in migrate.js)
COPY server/src/db/migrations ./dist/db/migrations

EXPOSE 3000

CMD ["node", "dist/index.js"]
