import pool from './client.js';
import { RECIPES } from '../config/game.config.js';

async function addNewRecipes() {
  const client = await pool.connect();
  try {
    const itemsRes = await client.query('SELECT id, key FROM items');
    const itemMap = new Map(itemsRes.rows.map((r: { id: string; key: string }) => [r.key, r.id]));

    const existingRes = await client.query('SELECT business_type, output_item_id FROM recipes');
    const existing = new Set(existingRes.rows.map((r: { business_type: string; output_item_id: string }) =>
      r.business_type + ':' + r.output_item_id));

    let added = 0;
    for (const recipe of RECIPES) {
      const outputId = itemMap.get(recipe.outputItem);
      if (!outputId) { console.log('Skip: no item', recipe.outputItem); continue; }
      const key = recipe.businessType + ':' + outputId;
      if (existing.has(key)) { console.log('Skip existing:', recipe.businessType, '->', recipe.outputItem); continue; }

      const recipeRes = await client.query(
        'INSERT INTO recipes (business_type, output_item_id, base_rate, cycle_minutes) VALUES ($1, $2, $3, $4) RETURNING id',
        [recipe.businessType, outputId, recipe.baseRate, recipe.cycleMinutes],
      );
      const recipeId = recipeRes.rows[0].id;

      for (const inp of recipe.inputs) {
        const inputId = itemMap.get(inp.item);
        if (inputId) {
          await client.query(
            'INSERT INTO recipe_inputs (recipe_id, item_id, quantity_per_unit) VALUES ($1, $2, $3)',
            [recipeId, inputId, inp.qtyPerUnit],
          );
        }
      }
      added++;
      console.log('Added:', recipe.businessType, '->', recipe.outputItem);
    }
    console.log(`Done. Added ${added} new recipes. Total recipes: ${existing.size + added}`);
  } finally {
    client.release();
    await pool.end();
  }
}

addNewRecipes();
