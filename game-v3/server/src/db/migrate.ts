import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './client.js';
import pool from './client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.resolve(__dirname, 'migrations');

async function migrate() {
  console.log('[migrate] Reading migration files from', MIGRATIONS_DIR);

  // Read all .sql files in migrations/ alphabetically
  let files: string[];
  try {
    files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();
  } catch (err) {
    console.error('[migrate] Could not read migrations directory:', err);
    process.exit(1);
  }

  if (files.length === 0) {
    console.warn('[migrate] No .sql migration files found.');
    process.exit(0);
  }

  console.log(`[migrate] Found ${files.length} migration file(s):`, files);

  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`[migrate] Executing: ${file}`);
    try {
      await query(sql);
      console.log(`[migrate]   Done: ${file}`);
    } catch (err: unknown) {
      const pg = err as { code?: string; message?: string };
      // Ignore "already exists" errors so migrations are idempotent on re-runs
      if (pg.code && pg.code.startsWith('42')) {
        console.warn(`[migrate]   Skipped (object already exists): ${file} — ${pg.message}`);
      } else {
        console.error(`[migrate]   FAILED: ${file}`, err);
        await pool.end();
        process.exit(1);
      }
    }
  }

  console.log('[migrate] All migrations complete.');
  await pool.end();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('[migrate] Fatal error:', err);
  process.exit(1);
});
