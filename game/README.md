# EmpireOS — Multiplayer Economy Game

A realistic multiplayer mobile business/economy game where every player is an entrepreneur. Two progression paths: **Legal Empire** and **Criminal Underground**.

## Project Structure

```
game/
├── shared/          TypeScript entity interfaces (consumed by server + client)
├── server/          Node.js/Fastify backend + simulation engine
└── client/          React Native (Expo) mobile app
```

## Quick Start

### Prerequisites
- Node.js 22+
- Docker Desktop (for PostgreSQL + Redis)

### 1. Start infrastructure
```bash
cd server
docker-compose up -d
```

### 2. Install dependencies
```bash
# From game/ root
npm install
```

### 3. Run DB migrations + seed
```bash
cd server
cp .env.example .env
npm run migrate
npm run seed
```

### 4. Start server
```bash
cd server
npm run dev
# → http://localhost:3000
# → ws://localhost:3000/ws
```

### 5. Start client
```bash
cd client
npx expo start
# Scan QR code with Expo Go app
```

## Architecture

| Layer | Tech |
|-------|------|
| Client | React Native (Expo), TypeScript, Zustand, TanStack Query |
| Server | Node.js 22, Fastify, TypeScript |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 + BullMQ |
| Real-time | WebSocket (`/ws`) |

## Core Systems

- **Economy Engine** — AI baseline market + player marketplace, price discovery, supply/demand
- **Simulation Loop** — BullMQ jobs every 5min (production, prices), 1h (market refresh), 24h (taxes, costs)
- **Crime System** — Dirty money, 4 laundering methods, heat score 0-1000, detection probability formula
- **Season System** — 6-month full server wipes, meta-progression preserved

## API Base URL
```
http://localhost:3000/api/v1
```

See `server/src/routes/` for all route definitions.

## Season 1: Iron Dawn
- Duration: 6 months from first player registration
- Starting cash: $5,000
- 5 cities: Ironport (Capital), Duskfield, Ashvale, Coldmarsh, Farrow
- 10 resource types across 3 tiers
