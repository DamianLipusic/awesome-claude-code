"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentSeason = getCurrentSeason;
exports.getSeasonById = getSeasonById;
const client_1 = require("../db/client");
async function getCurrentSeason() {
    const res = await (0, client_1.query)(`SELECT * FROM season_profiles WHERE status = 'ACTIVE' ORDER BY started_at DESC LIMIT 1`);
    if (res.rows.length === 0)
        return null;
    return res.rows[0];
}
async function getSeasonById(id) {
    const res = await (0, client_1.query)(`SELECT * FROM season_profiles WHERE id = $1`, [id]);
    if (res.rows.length === 0)
        return null;
    return res.rows[0];
}
//# sourceMappingURL=season.js.map