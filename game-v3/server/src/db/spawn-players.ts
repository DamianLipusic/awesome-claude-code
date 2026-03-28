import pool from './client.js';
import bcrypt from 'bcrypt';

const PLAYERS = [
  { username: 'MaxPower', email: 'max@empire.os' },
  { username: 'DarkLord', email: 'dark@empire.os' },
  { username: 'TradeMaster', email: 'trade@empire.os' },
  { username: 'CrimeBoss', email: 'crime@empire.os' },
  { username: 'FactoryKing', email: 'factory@empire.os' },
  { username: 'SteelBaron', email: 'steel@empire.os' },
  { username: 'BreadMaker', email: 'bread@empire.os' },
  { username: 'SpyGirl', email: 'spy@empire.os' },
  { username: 'Mogul99', email: 'mogul@empire.os' },
  { username: 'NightOwl', email: 'night@empire.os' },
];

const BIZ_TYPES = ['MINE', 'MINE', 'FACTORY', 'FACTORY', 'SHOP', 'FARM', 'WAREHOUSE', 'RESTAURANT', 'MINE', 'SHOP'];

async function spawn() {
  const hash = await bcrypt.hash('test1234', 12);
  const seasonRes = await pool.query("SELECT id FROM seasons WHERE status = 'active' LIMIT 1");
  const seasonId = seasonRes.rows[0]?.id;
  const locsRes = await pool.query('SELECT id FROM locations ORDER BY price ASC');
  const locs = locsRes.rows.map(r => r.id);
  const recipesRes = await pool.query('SELECT id, business_type FROM recipes');
  const recipeMap = new Map<string, string>();
  for (const r of recipesRes.rows) {
    if (!recipeMap.has(r.business_type as string)) recipeMap.set(r.business_type as string, r.id as string);
  }

  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i];
    try {
      // Create player
      const cash = 50000 + Math.floor(Math.random() * 50000);
      const level = 1 + Math.floor(Math.random() * 5);
      const xp = level * 200;
      const res = await pool.query(
        `INSERT INTO players (season_id, username, email, password_hash, cash, level, xp, last_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
        [seasonId, p.username, p.email, hash, cash, level, xp],
      );
      const playerId = res.rows[0].id;

      // Create business
      const bizType = BIZ_TYPES[i];
      const locId = locs[i % locs.length];
      const recipeId = recipeMap.get(bizType) ?? null;
      const bizRes = await pool.query(
        `INSERT INTO businesses (season_id, owner_id, location_id, type, name, recipe_id)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [seasonId, playerId, locId, bizType, `${p.username}'s ${bizType}`, recipeId],
      );
      const bizId = bizRes.rows[0].id;

      // Hire 1-3 employees
      const hireCount = 1 + Math.floor(Math.random() * 3);
      const empRes = await pool.query(
        `UPDATE employees SET business_id = $1, status = 'active', hired_at = NOW()
         WHERE id IN (SELECT id FROM employees WHERE status = 'available' LIMIT $2) RETURNING id`,
        [bizId, hireCount],
      );

      // Add some inventory
      if (recipeId) {
        const recipeOut = await pool.query('SELECT output_item_id FROM recipes WHERE id = $1', [recipeId]);
        if (recipeOut.rows.length) {
          const qty = 10 + Math.floor(Math.random() * 50);
          await pool.query(
            `INSERT INTO inventory (business_id, item_id, amount) VALUES ($1, $2, $3)
             ON CONFLICT (business_id, item_id) DO UPDATE SET amount = inventory.amount + $3`,
            [bizId, recipeOut.rows[0].output_item_id, qty],
          );
        }
      }

      console.log(`✓ ${p.username}: ${bizType} at loc ${i}, ${empRes.rowCount} employees, $${cash}`);
    } catch (e: any) {
      console.log(`✗ ${p.username}: ${e.message?.slice(0, 60)}`);
    }
  }

  // Refill employee pool
  const poolCount = await pool.query("SELECT COUNT(*)::int AS cnt FROM employees WHERE status = 'available'");
  console.log(`\nEmployee pool remaining: ${poolCount.rows[0].cnt}`);

  const snapshot = await pool.query(`
    SELECT (SELECT COUNT(*) FROM players)::int AS players,
           (SELECT COUNT(*) FROM businesses WHERE status != 'shutdown')::int AS businesses,
           (SELECT COUNT(*) FROM employees WHERE status IN ('active','training'))::int AS employees
  `);
  console.log(`Players: ${snapshot.rows[0].players}, Businesses: ${snapshot.rows[0].businesses}, Employees: ${snapshot.rows[0].employees}`);

  await pool.end();
}

spawn();
