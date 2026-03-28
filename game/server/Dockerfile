FROM node:22-alpine

WORKDIR /workspace

# Preserve directory structure so relative imports work:
#   /workspace/shared/ and /workspace/server/
COPY shared ./shared
COPY server ./server

WORKDIR /workspace/server

# Install all deps (including tsx for running TypeScript directly)
RUN npm install

EXPOSE 3000

# Run with tsx — no compile step needed
CMD ["npx", "tsx", "src/index.ts"]
