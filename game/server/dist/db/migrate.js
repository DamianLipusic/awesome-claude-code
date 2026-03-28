"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const client_1 = require("./client");
const client_2 = __importDefault(require("./client"));
const MIGRATIONS_DIR = path_1.default.resolve(__dirname, 'migrations');
async function migrate() {
    console.log('[migrate] Reading migration files from', MIGRATIONS_DIR);
    // Read all .sql files in migrations/ alphabetically
    let files;
    try {
        files = fs_1.default
            .readdirSync(MIGRATIONS_DIR)
            .filter((f) => f.endsWith('.sql'))
            .sort();
    }
    catch (err) {
        console.error('[migrate] Could not read migrations directory:', err);
        process.exit(1);
    }
    if (files.length === 0) {
        console.warn('[migrate] No .sql migration files found.');
        process.exit(0);
    }
    console.log(`[migrate] Found ${files.length} migration file(s):`, files);
    for (const file of files) {
        const filePath = path_1.default.join(MIGRATIONS_DIR, file);
        const sql = fs_1.default.readFileSync(filePath, 'utf8');
        console.log(`[migrate] Executing: ${file}`);
        try {
            await (0, client_1.query)(sql);
            console.log(`[migrate]   Done: ${file}`);
        }
        catch (err) {
            const pg = err;
            // Ignore "already exists" errors so migrations are idempotent on re-runs
            if (pg.code && pg.code.startsWith('42')) {
                console.warn(`[migrate]   Skipped (object already exists): ${file} — ${pg.message}`);
            }
            else {
                console.error(`[migrate]   FAILED: ${file}`, err);
                await client_2.default.end();
                process.exit(1);
            }
        }
    }
    console.log('[migrate] All migrations complete.');
    await client_2.default.end();
    process.exit(0);
}
migrate().catch((err) => {
    console.error('[migrate] Fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map