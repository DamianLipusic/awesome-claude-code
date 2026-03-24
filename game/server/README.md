# Economy Game Server

## Setup

1. `cp .env.example .env`
2. `docker-compose up -d` (starts PostgreSQL + Redis)
3. `npm install`
4. `npm run migrate` (runs DB migrations)
5. `npm run seed` (seeds initial season + resources + employees)
6. `npm run dev` (starts server with hot reload)

## Scripts

- `npm run dev` — tsx watch with hot reload
- `npm run build` — compile TypeScript
- `npm run start` — run compiled output
- `npm run migrate` — run DB migrations
- `npm run seed` — seed initial season + resources + employees

## API

Base URL: `http://localhost:3000/api/v1`
WebSocket: `ws://localhost:3000/ws`

### Auth
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`

### Players
- `GET /api/v1/players/me`
- `GET /api/v1/players/leaderboard`

### Businesses
- `GET /api/v1/businesses`
- `POST /api/v1/businesses`
- `GET /api/v1/businesses/:id`
- `PATCH /api/v1/businesses/:id`
- `DELETE /api/v1/businesses/:id`

### Employees
- `GET /api/v1/employees` — browse available employees
- `POST /api/v1/employees/:id/hire`
- `POST /api/v1/employees/:id/fire`

### Market
- `GET /api/v1/market` — listings for a city
- `POST /api/v1/market` — create a listing
- `POST /api/v1/market/:id/buy`

### Contracts
- `GET /api/v1/contracts`
- `POST /api/v1/contracts`
- `GET /api/v1/contracts/:id`
- `POST /api/v1/contracts/:id/accept`
- `DELETE /api/v1/contracts/:id`

### Crime
- `POST /api/v1/crime/operations`
- `GET /api/v1/crime/operations`
- `POST /api/v1/crime/bribe`
- `POST /api/v1/crime/launder`

### Seasons
- `GET /api/v1/seasons/current`
- `GET /api/v1/seasons/:id`

### Health
- `GET /health`

## WebSocket

Connect to `ws://localhost:3000/ws?token=<access_jwt>`.

Events emitted by the server:
- `connected` — on successful connection
- `pong` — response to `ping`
- `alert` — player alert notification
- `crime_completed` / `crime_busted` — crime resolution
- `laundering_complete` / `laundering_seized` — laundering resolution
- `season_reset` — broadcast when a new season begins

Client actions:
- `{ action: 'ping' }`
- `{ action: 'subscribe', channel: 'market:{city}:{resource_id}' }`
- `{ action: 'unsubscribe', channel: '...' }`
