import pool from './client.js';

async function reset() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // New tables first (FK deps)
    await client.query('DELETE FROM player_trust');
    await client.query('DELETE FROM intel_reports');
    await client.query('DELETE FROM bulk_orders');
    await client.query('DELETE FROM contracts');
    await client.query('DELETE FROM laundering_jobs');
    await client.query('DELETE FROM crime_operations');
    await client.query('DELETE FROM price_history');
    await client.query('DELETE FROM achievements');
    await client.query('DELETE FROM discovery_progress');
    await client.query('DELETE FROM training');
    await client.query('DELETE FROM inventory_log');
    await client.query('DELETE FROM inventory');
    await client.query('DELETE FROM market_listings');
    await client.query('DELETE FROM activity_log');
    await client.query('DELETE FROM game_ticks');
    await client.query('DELETE FROM game_events');
    await client.query('DELETE FROM employees');
    await client.query('DELETE FROM businesses');
    await client.query('DELETE FROM refresh_tokens');
    await client.query('DELETE FROM players');
    await client.query('COMMIT');
    console.log('All player data wiped.');
  } finally {
    client.release();
    await pool.end();
  }
}
reset();
