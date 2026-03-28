// Seed just the discovery rules (standalone, no FK conflicts)
import 'dotenv/config';
import pool from './client.js';

const DISCOVERY_RULES = [
  { key: 'first_business', trigger: { cash_gte: 8000, business_count_eq: 0 }, surface: 'dashboard', reward: 'info', payload: { message: 'A location in the industrial district is available for a good price...' }, sort: 10 },
  { key: 'hire_first_worker', trigger: { business_count_gte: 1, employee_count_eq: 0 }, surface: 'dashboard', reward: 'info', payload: { message: 'New workers are looking for employment. Check the recruit pool.' }, sort: 20 },
  { key: 'production_started', trigger: { total_inventory_gte: 1 }, surface: 'dashboard', reward: 'info', payload: { message: 'Your workers are producing! Check your inventory.' }, sort: 25 },
  { key: 'sell_on_market', trigger: { total_inventory_gte: 20, has_never_sold: true }, surface: 'dashboard', reward: 'option', payload: { message: 'You could get better prices selling directly on the market...' }, sort: 30 },
  { key: 'inventory_filling', trigger: { any_storage_pct_gte: 70 }, surface: 'business_detail', reward: 'info', payload: { message: 'Storage is filling up. Sell or upgrade before production stops.' }, sort: 35 },
  { key: 'second_business', trigger: { business_count_eq: 1, cash_gte: 15000 }, surface: 'dashboard', reward: 'info', payload: { message: 'With this capital, expanding to a second business could multiply your income.' }, sort: 40 },
  { key: 'production_chain', trigger: { has_mine: true, has_no_factory: true, cash_gte: 15000 }, surface: 'dashboard', reward: 'info', payload: { message: 'Raw materials sell cheap. Processing them into steel or flour would multiply their value.' }, sort: 50 },
  { key: 'training_hint', trigger: { employee_count_gte: 3, has_never_trained: true }, surface: 'employees', reward: 'option', payload: { message: 'Some workers show potential. Training could unlock it.' }, sort: 55 },
  { key: 'upgrade_hint', trigger: { any_business_at_max_employees: true }, surface: 'business_detail', reward: 'info', payload: { message: 'This business is at capacity. Upgrading allows more workers and storage.' }, sort: 60 },
  { key: 'shop_hint', trigger: { has_factory: true, has_no_shop: true, cash_gte: 8000 }, surface: 'dashboard', reward: 'info', payload: { message: 'Finished goods pile up. A shop in a high-traffic area could move them faster.' }, sort: 65 },
  { key: 'cost_warning', trigger: { daily_costs_exceed_income: true }, surface: 'dashboard', reward: 'info', payload: { message: 'Your expenses are outpacing income. Review your accounting before it gets critical.' }, sort: 70 },
  { key: 'transfer_hint', trigger: { business_count_gte: 2, any_converter_missing_input: true }, surface: 'business_detail', reward: 'option', payload: { message: 'You can transfer materials between your businesses. Check inventory.' }, sort: 75 },
];

async function seedDiscovery() {
  let count = 0;
  for (const rule of DISCOVERY_RULES) {
    const res = await pool.query(
      `INSERT INTO discovery_rules (key, trigger_condition, ui_surface, reward_type, reward_payload, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO NOTHING
       RETURNING id`,
      [rule.key, JSON.stringify(rule.trigger), rule.surface, rule.reward, JSON.stringify(rule.payload), rule.sort],
    );
    if (res.rows.length > 0) count++;
  }
  console.log(`[seed-discovery] Inserted ${count} new rules`);
  const total = await pool.query('SELECT COUNT(*)::int AS c FROM discovery_rules');
  console.log(`[seed-discovery] Total rules in DB: ${total.rows[0].c}`);
  await pool.end();
}

seedDiscovery().catch((err) => {
  console.error('[seed-discovery] Fatal:', err);
  pool.end().finally(() => process.exit(1));
});
