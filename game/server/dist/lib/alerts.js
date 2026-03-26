"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAlert = createAlert;
exports.getPlayerAlerts = getPlayerAlerts;
const client_1 = require("../db/client");
async function createAlert(playerId, seasonId, type, message, data) {
    await (0, client_1.query)(`INSERT INTO alerts (id, player_id, season_id, type, message, data, read, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, false, NOW())`, [
        crypto.randomUUID(),
        playerId,
        seasonId,
        type,
        message,
        JSON.stringify(data ?? {}),
    ]);
}
async function getPlayerAlerts(playerId, limit = 50) {
    const res = await (0, client_1.query)(`SELECT * FROM alerts WHERE player_id = $1 ORDER BY created_at DESC LIMIT $2`, [playerId, limit]);
    return res.rows;
}
//# sourceMappingURL=alerts.js.map