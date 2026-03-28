"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const cors_1 = __importDefault(require("@fastify/cors"));
const websocket_1 = __importDefault(require("@fastify/websocket"));
const auth_1 = require("./routes/auth");
const players_1 = require("./routes/players");
const businesses_1 = require("./routes/businesses");
const employees_1 = require("./routes/employees");
const market_1 = require("./routes/market");
const contracts_1 = require("./routes/contracts");
const crime_1 = require("./routes/crime");
const seasons_1 = require("./routes/seasons");
const handler_1 = require("./websocket/handler");
const queue_1 = require("./jobs/queue");
const client_1 = __importDefault(require("./db/client"));
const app = (0, fastify_1.default)({
    logger: {
        level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
});
async function main() {
    // ─── Plugins ──────────────────────────────────────────────────
    await app.register(cors_1.default, { origin: true });
    await app.register(jwt_1.default, {
        secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
    });
    await app.register(websocket_1.default);
    // ─── Routes ───────────────────────────────────────────────────
    await app.register(auth_1.authRoutes, { prefix: '/api/v1/auth' });
    await app.register(players_1.playerRoutes, { prefix: '/api/v1/players' });
    await app.register(businesses_1.businessRoutes, { prefix: '/api/v1/businesses' });
    await app.register(employees_1.employeeRoutes, { prefix: '/api/v1/employees' });
    await app.register(market_1.marketRoutes, { prefix: '/api/v1/market' });
    await app.register(contracts_1.contractRoutes, { prefix: '/api/v1/contracts' });
    await app.register(crime_1.crimeRoutes, { prefix: '/api/v1/crime' });
    await app.register(seasons_1.seasonRoutes, { prefix: '/api/v1/seasons' });
    // ─── WebSocket ────────────────────────────────────────────────
    await (0, handler_1.registerWebSocketHandler)(app);
    // ─── Health check ─────────────────────────────────────────────
    app.get('/health', async () => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    }));
    // ─── BullMQ workers ───────────────────────────────────────────
    try {
        await (0, queue_1.startWorkers)();
        await (0, queue_1.scheduleRecurringJobs)();
        app.log.info('BullMQ workers started and recurring jobs scheduled.');
    }
    catch (err) {
        app.log.warn({ err }, 'BullMQ workers could not start (Redis may be unavailable)');
    }
    // ─── Graceful shutdown ────────────────────────────────────────
    const shutdown = async (signal) => {
        app.log.info(`Received ${signal}, shutting down gracefully...`);
        await app.close();
        await client_1.default.end();
        process.exit(0);
    };
    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
    process.on('SIGINT', () => { void shutdown('SIGINT'); });
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    app.log.info(`Server listening on port ${port}`);
}
main().catch((err) => {
    console.error('[startup] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map