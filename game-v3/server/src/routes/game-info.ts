import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { BUSINESS_TYPES, ITEMS, RECIPES, SEED_LOCATIONS, EMPLOYEE_POOL, TRAINING, AUTOSELL, LEVEL_THRESHOLDS, UNLOCK_CONDITIONS, upgradeCost, storageCap, maxEmployees } from '../config/game.config.js';

export async function gameInfoRoutes(app: FastifyInstance) {
  // GET /api/v1/game/info — full game encyclopedia
  app.get('/', async (_req, reply) => {
    // Build business type info with costs and upgrade path
    const businessTypes = Object.entries(BUSINESS_TYPES).map(([key, val]) => ({
      key,
      cost: val.cost,
      dailyCost: val.dailyCost,
      category: val.category,
      emoji: val.emoji,
      upgradeCosts: [1, 2, 3, 4, 5].map(tier => ({
        tier,
        cost: upgradeCost(key as keyof typeof BUSINESS_TYPES, tier),
        storageCap: storageCap(tier),
        maxEmployees: maxEmployees(tier),
      })),
    }));

    // Build items info
    const items = Object.entries(ITEMS).map(([key, val]) => ({
      key,
      name: val.name,
      basePrice: val.basePrice,
      category: val.category,
      stage: val.stage,
    }));

    // Build recipes with full input/output info
    const recipes = RECIPES.map(r => ({
      businessType: r.businessType,
      outputItem: r.outputItem,
      outputName: ITEMS[r.outputItem].name,
      outputPrice: ITEMS[r.outputItem].basePrice,
      baseRate: r.baseRate,
      cycleMinutes: r.cycleMinutes,
      inputs: r.inputs.map(inp => ({
        item: inp.item,
        name: ITEMS[inp.item].name,
        basePrice: ITEMS[inp.item].basePrice,
        qtyPerUnit: inp.qtyPerUnit,
      })),
      // Profit estimate: output price - sum(input price * qty)
      profitPerUnit: ITEMS[r.outputItem].basePrice - r.inputs.reduce((sum, inp) => sum + ITEMS[inp.item].basePrice * inp.qtyPerUnit, 0),
    }));

    // Production chains: show the full chain from raw → finished
    const productionChains = [
      {
        name: 'Ore → Steel → Tools',
        steps: [
          { business: 'MINE', produces: 'Ore ($12)', emoji: '⛏️' },
          { business: 'FACTORY', consumes: '3x Ore', produces: 'Steel ($35)', emoji: '🏭' },
          { business: 'SHOP', consumes: '2x Steel', produces: 'Tools ($80)', emoji: '🏪' },
        ],
        finalValue: ITEMS.tools.basePrice,
        totalInputCost: ITEMS.ore.basePrice * 3 * 2, // 6 ore for 2 steel for 1 tool
        profitPerUnit: ITEMS.tools.basePrice - (ITEMS.steel.basePrice * 2),
      },
      {
        name: 'Wheat → Flour → Bread',
        steps: [
          { business: 'MINE', produces: 'Wheat ($5)', emoji: '⛏️' },
          { business: 'FACTORY', consumes: '2x Wheat', produces: 'Flour ($20)', emoji: '🏭' },
          { business: 'SHOP', consumes: '2x Flour', produces: 'Bread ($50)', emoji: '🏪' },
        ],
        finalValue: ITEMS.bread.basePrice,
        totalInputCost: ITEMS.wheat.basePrice * 2 * 2, // 4 wheat for 2 flour for 1 bread
        profitPerUnit: ITEMS.bread.basePrice - (ITEMS.flour.basePrice * 2),
      },
    ];

    // Locations
    const locations = SEED_LOCATIONS.map(loc => ({
      name: loc.name,
      type: loc.type,
      zone: loc.zone,
      price: loc.price,
      dailyCost: loc.dailyCost,
      traffic: loc.traffic,
      visibility: loc.visibility,
      storage: loc.storage,
      laundering: loc.laundering,
    }));

    // Employee tiers
    const employeeTiers = Object.entries(EMPLOYEE_POOL.tiers).map(([tier, val]) => ({
      tier,
      weight: val.weight,
      efficiencyRange: [val.effMin, val.effMax],
      salaryRange: [val.salaryMin, val.salaryMax],
    }));

    // Training info
    const trainingTypes = Object.entries(TRAINING).map(([type, val]) => ({
      type,
      durationMinutes: val.durationMinutes,
      costMultiplier: val.costMultiplier,
      maxStatGain: val.maxStatGain,
    }));

    // Autosell info
    const autosell = {
      priceModifier: AUTOSELL.priceModifier,
      demandFactor: AUTOSELL.demandFactor,
      description: `Sells at ${AUTOSELL.priceModifier * 100}% of market price, capped by location traffic × ${AUTOSELL.demandFactor}`,
    };

    // Level thresholds
    const levels = LEVEL_THRESHOLDS.map((xp, i) => ({
      level: i + 1,
      xpRequired: xp,
    }));

    // Unlock phases
    const unlockPhases = Object.entries(UNLOCK_CONDITIONS).map(([phase, cond]) => ({
      phase: Number(phase),
      conditions: cond,
    }));

    // Get current market prices from DB
    const pricesResult = await query(`
      SELECT i.key, i.name, i.base_price,
        COALESCE(
          (SELECT AVG(ml.price_per_unit) FROM market_listings ml
           WHERE ml.item_id = i.id AND ml.status = 'open'
           AND ml.created_at > NOW() - INTERVAL '24 hours'),
          i.base_price
        )::numeric(18,2) AS current_price
      FROM items i ORDER BY i.production_stage, i.name
    `);

    return reply.send({
      data: {
        businessTypes,
        items,
        recipes,
        productionChains,
        locations,
        employeeTiers,
        trainingTypes,
        autosell,
        levels,
        unlockPhases,
        currentPrices: pricesResult.rows,
        tips: [
          'Start with a MINE — it produces Ore with no inputs needed.',
          'Build a FACTORY and assign a Steel recipe to process Ore into Steel (3x more valuable).',
          'Hire workers to increase production. More workers = more output per tick.',
          'Train workers to boost their efficiency — higher efficiency = more production.',
          'Location traffic affects auto-sell: high-traffic locations sell more automatically.',
          'Upgrade businesses to increase storage and max employee slots.',
          'Keep an eye on daily costs — location rent + employee salaries are charged daily.',
          'Buy cheap raw materials on the market to feed your factories.',
          'The market sells at 95% of current price. Auto-sell is only 80%.',
        ],
      },
    });
  });
}
