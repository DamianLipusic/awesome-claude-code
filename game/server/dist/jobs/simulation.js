"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.economy_update = economy_update;
exports.employee_production = employee_production;
exports.market_refresh = market_refresh;
exports.crime_action_resolve = crime_action_resolve;
exports.laundering_tick = laundering_tick;
exports.heat_decay = heat_decay;
exports.daily_costs = daily_costs;
exports.progressive_tax = progressive_tax;
exports.season_reset = season_reset;
const client_1 = require("../db/client");
const constants_1 = require("../lib/constants");
const detection_1 = require("../lib/detection");
const entities_1 = require("../../../shared/src/types/entities");
const handler_1 = require("../websocket/handler");
// ─── Economy Update ───────────────────────────────────────────
/**
 * Update AI prices based on scarcity formula for all resources in season.
 */
async function economy_update(season_id) {
    const resources = await (0, client_1.query)(`SELECT id, name, base_value, global_supply, global_demand
       FROM resources WHERE season_id = $1`, [season_id]);
    for (const res of resources.rows) {
        const newPrice = (0, constants_1.calculateAiPrice)(parseFloat(res.base_value), parseFloat(res.global_supply), parseFloat(res.global_demand));
        await (0, client_1.query)(`UPDATE resources SET current_ai_price = $1 WHERE id = $2`, [newPrice, res.id]);
        // Record price history
        await (0, client_1.query)(`INSERT INTO price_history (resource_id, season_id, price)
       VALUES ($1, $2, $3)`, [res.id, season_id, newPrice]);
    }
    // Slight supply regeneration per tick (markets recover slowly)
    await (0, client_1.query)(`UPDATE resources
        SET global_supply = LEAST(global_supply * 1.005, base_value * 2000)
      WHERE season_id = $1`, [season_id]);
}
// ─── Employee Production ──────────────────────────────────────
/**
 * Run one production tick for a specific business.
 */
async function employee_production(business_id) {
    await (0, client_1.withTransaction)(async (client) => {
        const bizRes = await client.query(`SELECT id, owner_id, type, tier, status, capacity, inventory, storage_cap, season_id, efficiency
         FROM businesses WHERE id = $1 FOR UPDATE`, [business_id]);
        if (bizRes.rows.length === 0)
            return;
        const biz = bizRes.rows[0];
        if (biz.status !== 'ACTIVE')
            return;
        const recipes = constants_1.PRODUCTION_RECIPES[biz.type];
        if (!recipes)
            return;
        const recipe = recipes[biz.tier];
        if (!recipe || recipe.units_per_tick_per_worker === 0)
            return;
        // Get active workers
        const empRes = await client.query(`SELECT COUNT(*) as count,
              AVG(efficiency) as avg_efficiency,
              AVG(corruption_risk) as corruption_risk
         FROM employees
        WHERE business_id = $1
          AND role = 'WORKER'`, [business_id]);
        const workerCount = parseInt(empRes.rows[0].count ?? '0');
        if (workerCount === 0)
            return;
        const avgEfficiency = parseFloat(empRes.rows[0].avg_efficiency ?? '1.0');
        const bizEfficiency = parseFloat(biz.efficiency);
        const corruptionRisk = parseFloat(empRes.rows[0].corruption_risk ?? '0.05');
        const inventory = biz.inventory;
        // Check inputs are available
        for (const input of recipe.inputs) {
            const have = inventory[input.resource_name] ?? 0;
            const needed = input.quantity * workerCount;
            if (have < needed) {
                // Not enough inputs — skip production this tick
                return;
            }
        }
        // Consume inputs
        for (const input of recipe.inputs) {
            const needed = input.quantity * workerCount;
            inventory[input.resource_name] = (inventory[input.resource_name] ?? 0) - needed;
        }
        // Produce outputs
        const unitsProduced = Math.floor(recipe.units_per_tick_per_worker * workerCount * avgEfficiency * bizEfficiency);
        for (const output of recipe.outputs) {
            if (output.quantity === 0)
                continue;
            const qty = Math.floor(output.quantity * workerCount * avgEfficiency * bizEfficiency);
            const current = inventory[output.resource_name] ?? 0;
            const space = biz.storage_cap - Object.values(inventory).reduce((a, b) => a + b, 0);
            inventory[output.resource_name] = current + Math.min(qty, Math.max(space, 0));
        }
        // Corruption check
        if (Math.random() < corruptionRisk * 0.01) {
            // Employee theft: lose up to 5% of first inventory item
            const items = Object.entries(inventory).filter(([, v]) => v > 0);
            if (items.length > 0) {
                const [item, qty] = items[0];
                const stolen = Math.floor(qty * 0.05);
                inventory[item] = qty - stolen;
                await createAlert(client, biz.owner_id, biz.season_id, 'EMPLOYEE_THEFT', `An employee at ${business_id} stole ${stolen} units of ${item}.`, { business_id, resource: item, amount: stolen });
                (0, handler_1.emitToPlayer)(biz.owner_id, 'alert', {
                    type: 'EMPLOYEE_THEFT', business_id, resource: item, amount: stolen
                });
            }
        }
        await client.query(`UPDATE businesses SET inventory = $1 WHERE id = $2`, [JSON.stringify(inventory), business_id]);
        console.log(`[sim] Production tick: business ${business_id} produced ${unitsProduced} units`);
    });
}
// ─── Market Refresh ───────────────────────────────────────────
/**
 * Replenish AI listings per city, applying player price pressure.
 */
async function market_refresh(season_id) {
    await (0, client_1.withTransaction)(async (client) => {
        const resources = await client.query(`SELECT id, name, tier, current_ai_price, illegal
         FROM resources WHERE season_id = $1`, [season_id]);
        for (const city of entities_1.CITIES) {
            for (const res of resources.rows) {
                // Skip illegal items in non-capital cities
                if (res.illegal && city.size !== 'CAPITAL')
                    continue;
                const aiPrice = parseFloat(res.current_ai_price);
                const aiBuyPrice = aiPrice * (constants_1.AI_BUY_DISCOUNT / constants_1.AI_MARKUP);
                const cap = constants_1.AI_QUANTITY_CAPS[city.size]?.[res.tier] ?? 500;
                const targetQty = Math.round(cap * 0.8);
                // Update or replenish AI_SELL listing
                const existingSell = await client.query(`SELECT id, quantity_remaining FROM market_listings
            WHERE season_id=$1 AND city=$2 AND resource_id=$3
              AND listing_type='AI_SELL' AND status='OPEN'
            LIMIT 1`, [season_id, city.name, res.id]);
                if (existingSell.rows.length > 0) {
                    const existing = existingSell.rows[0];
                    const currentQty = parseFloat(existing.quantity_remaining);
                    if (currentQty < targetQty * 0.3) {
                        // Replenish to target
                        await client.query(`UPDATE market_listings
                  SET quantity_remaining = $1, quantity = $1, price_per_unit = $2
                WHERE id = $3`, [targetQty, aiPrice, existing.id]);
                    }
                    else {
                        // Just update price
                        await client.query(`UPDATE market_listings SET price_per_unit = $1 WHERE id = $2`, [aiPrice, existing.id]);
                    }
                }
                else {
                    await client.query(`INSERT INTO market_listings
               (season_id, listing_type, resource_id, city, quantity,
                quantity_remaining, price_per_unit, min_quantity, is_anonymous, status)
             VALUES ($1,'AI_SELL',$2,$3,$4,$4,$5,1,false,'OPEN')`, [season_id, res.id, city.name, targetQty, aiPrice]);
                }
                // Update AI_BUY listing
                const existingBuy = await client.query(`SELECT id FROM market_listings
            WHERE season_id=$1 AND city=$2 AND resource_id=$3
              AND listing_type='AI_BUY' AND status='OPEN'
            LIMIT 1`, [season_id, city.name, res.id]);
                if (existingBuy.rows.length > 0) {
                    await client.query(`UPDATE market_listings SET price_per_unit = $1 WHERE id = $2`, [aiBuyPrice, existingBuy.rows[0].id]);
                }
                else {
                    await client.query(`INSERT INTO market_listings
               (season_id, listing_type, resource_id, city, quantity,
                quantity_remaining, price_per_unit, min_quantity, is_anonymous, status)
             VALUES ($1,'AI_BUY',$2,$3,$4,$4,$5,1,false,'OPEN')`, [season_id, res.id, city.name, targetQty, aiBuyPrice]);
                }
            }
        }
    });
    console.log('[sim] Market refresh complete.');
}
// ─── Crime Action Resolve ─────────────────────────────────────
/**
 * Resolve a completed criminal operation.
 */
async function crime_action_resolve(operation_id) {
    await (0, client_1.withTransaction)(async (client) => {
        const opRes = await client.query(`SELECT * FROM criminal_operations WHERE id = $1 FOR UPDATE`, [operation_id]);
        if (opRes.rows.length === 0)
            return;
        const op = opRes.rows[0];
        if (op.status !== 'ACTIVE')
            return;
        // Fetch heat score
        const heatRes = await client.query(`SELECT score, informant_active FROM heat_scores
        WHERE player_id=$1 AND season_id=$2 LIMIT 1`, [op.player_id, op.season_id]);
        const heatScore = heatRes.rows.length > 0 ? parseFloat(heatRes.rows[0].score) : 0;
        const informantActive = heatRes.rows.length > 0 ? heatRes.rows[0].informant_active : false;
        const secReduction = await (0, detection_1.getPlayerSecurityReduction)(op.player_id);
        const opConfig = entities_1.CRIME_OP_CONFIGS[op.op_type];
        const { detected, roll, probability } = (0, detection_1.detection_check)(heatScore, {
            risk_level: op.risk_level,
            security_reduction: secReduction,
            informant_active: informantActive,
            bribe_applied: false,
        });
        if (detected) {
            // Determine penalty based on heat level
            const level = (0, detection_1.getHeatLevel)(heatScore);
            const penalty = determinePenalty(level, op.player_id);
            await client.query(`UPDATE criminal_operations
            SET status='BUSTED', was_detected=true,
                detection_roll=$1, penalty_applied=$2
          WHERE id=$3`, [roll, JSON.stringify(penalty), operation_id]);
            // Apply penalty
            await applyPenalty(client, op.player_id, op.season_id, penalty);
            // Add heat for getting caught
            await addHeat(client, op.player_id, op.season_id, opConfig.risk_level * 30);
            await createAlert(client, op.player_id, op.season_id, 'CRIME_BUSTED', `Your ${op.op_type} operation was busted! Penalty: ${JSON.stringify(penalty)}`, { operation_id, penalty, probability });
            (0, handler_1.emitToPlayer)(op.player_id, 'crime_busted', { operation_id, penalty });
        }
        else {
            // Success
            const yield_amount = parseFloat(op.dirty_money_yield);
            await client.query(`UPDATE criminal_operations
            SET status='COMPLETED', was_detected=false, detection_roll=$1
          WHERE id=$2`, [roll, operation_id]);
            // Credit dirty money
            await client.query(`UPDATE dirty_money_balances
            SET total_dirty = total_dirty + $1,
                total_earned = total_earned + $1
          WHERE player_id=$2 AND season_id=$3`, [yield_amount, op.player_id, op.season_id]);
            // Add heat for committing crime
            await addHeat(client, op.player_id, op.season_id, opConfig.risk_level * 10);
            // Update player alignment
            await updateAlignment(client, op.player_id);
            await createAlert(client, op.player_id, op.season_id, 'CRIME_COMPLETED', `Your ${op.op_type} operation succeeded! Earned $${yield_amount.toFixed(2)} dirty money.`, { operation_id, yield_amount });
            (0, handler_1.emitToPlayer)(op.player_id, 'crime_completed', { operation_id, yield_amount });
        }
    });
}
// ─── Laundering Tick ──────────────────────────────────────────
/**
 * Complete due laundering processes.
 */
async function laundering_tick() {
    const due = await (0, client_1.query)(`SELECT id, player_id, season_id, clean_amount, dirty_amount, detection_risk, method
       FROM laundering_processes
      WHERE status='IN_PROGRESS' AND completes_at <= NOW()`, []);
    for (const proc of due.rows) {
        await (0, client_1.withTransaction)(async (client) => {
            // Detection check for laundering
            const heatRes = await client.query(`SELECT score, informant_active FROM heat_scores
          WHERE player_id=$1 AND season_id=$2 LIMIT 1`, [proc.player_id, proc.season_id]);
            const heatScore = heatRes.rows.length > 0 ? parseFloat(heatRes.rows[0].score) : 0;
            const informantActive = heatRes.rows.length > 0 ? heatRes.rows[0].informant_active : false;
            const secReduction = await (0, detection_1.getPlayerSecurityReduction)(proc.player_id);
            const methodConfig = entities_1.LAUNDERING_METHODS[proc.method];
            const { detected } = (0, detection_1.detection_check)(heatScore, {
                risk_level: Math.ceil(parseFloat(proc.detection_risk) * 10),
                security_reduction: secReduction * methodConfig.detection_modifier,
                informant_active: informantActive,
                bribe_applied: false,
            });
            if (detected) {
                await client.query(`UPDATE laundering_processes SET status='SEIZED' WHERE id=$1`, [proc.id]);
                await client.query(`UPDATE dirty_money_balances
              SET flagged=true, flagged_since=NOW()
            WHERE player_id=$1 AND season_id=$2`, [proc.player_id, proc.season_id]);
                await addHeat(client, proc.player_id, proc.season_id, 150);
                await createAlert(client, proc.player_id, proc.season_id, 'LAUNDERING_SEIZED', `Your laundering operation was seized! $${parseFloat(proc.dirty_amount).toFixed(2)} confiscated.`, { process_id: proc.id });
                (0, handler_1.emitToPlayer)(proc.player_id, 'laundering_seized', { process_id: proc.id });
            }
            else {
                const cleanAmount = parseFloat(proc.clean_amount);
                await client.query(`UPDATE laundering_processes SET status='COMPLETED' WHERE id=$1`, [proc.id]);
                // Subtract dirty money and add clean cash
                await client.query(`UPDATE dirty_money_balances
              SET total_dirty = GREATEST(total_dirty - $1, 0),
                  total_laundered = total_laundered + $1
            WHERE player_id=$2 AND season_id=$3`, [parseFloat(proc.dirty_amount), proc.player_id, proc.season_id]);
                await client.query(`UPDATE players SET cash = cash + $1 WHERE id = $2`, [cleanAmount, proc.player_id]);
                await createAlert(client, proc.player_id, proc.season_id, 'LAUNDERING_COMPLETE', `Laundering complete! $${cleanAmount.toFixed(2)} clean cash added.`, { process_id: proc.id, clean_amount: cleanAmount });
                (0, handler_1.emitToPlayer)(proc.player_id, 'laundering_complete', { process_id: proc.id, clean_amount: cleanAmount });
            }
        });
    }
}
// ─── Heat Decay ───────────────────────────────────────────────
/**
 * Decay all players' heat scores by configured rate.
 */
async function heat_decay() {
    // Fetch all active heat scores
    const scores = await (0, client_1.query)(`SELECT hs.id, hs.player_id, hs.season_id, hs.score,
            hs.decay_rate, hs.under_investigation, hs.investigation_ends
       FROM heat_scores hs
       JOIN season_profiles sp ON sp.id = hs.season_id
      WHERE sp.status = 'ACTIVE'`, []);
    for (const hs of scores.rows) {
        let score = parseFloat(hs.score);
        if (score <= 0)
            continue;
        // Check if lay_low is active (we'd need a separate field, using decay_rate as proxy)
        const decayRate = parseFloat(hs.decay_rate);
        let decay = decayRate; // per hour, called every hour
        // Investigation pauses decay
        if (hs.under_investigation) {
            const investigationEnds = hs.investigation_ends ? new Date(hs.investigation_ends) : null;
            if (!investigationEnds || investigationEnds > new Date()) {
                decay = 0;
            }
            else {
                // Investigation ended
                await (0, client_1.query)(`UPDATE heat_scores SET under_investigation=false, investigation_ends=NULL WHERE id=$1`, [hs.id]);
            }
        }
        score = Math.max(0, score - decay);
        const newLevel = (0, detection_1.getHeatLevel)(score);
        await (0, client_1.query)(`UPDATE heat_scores SET score=$1, level=$2 WHERE id=$3`, [score, newLevel, hs.id]);
    }
}
// ─── Daily Costs ─────────────────────────────────────────────
/**
 * Deduct daily salaries, operating costs, and dirty money liability.
 */
async function daily_costs(season_id) {
    await (0, client_1.withTransaction)(async (client) => {
        // Fetch all active businesses
        const businesses = await client.query(`SELECT id, owner_id, daily_operating_cost, status
         FROM businesses WHERE season_id=$1 AND status NOT IN ('BANKRUPT')`, [season_id]);
        // Aggregate costs per player
        const playerCosts = {};
        for (const biz of businesses.rows) {
            if (biz.status === 'IDLE' || biz.status === 'ACTIVE') {
                playerCosts[biz.owner_id] = (playerCosts[biz.owner_id] ?? 0) + parseFloat(biz.daily_operating_cost);
            }
        }
        // Fetch employee salaries per player
        const salaries = await client.query(`SELECT b.owner_id, SUM(e.salary) as total_salary
         FROM employees e
         JOIN businesses b ON b.id = e.business_id
        WHERE b.season_id=$1 AND e.business_id IS NOT NULL
        GROUP BY b.owner_id`, [season_id]);
        for (const row of salaries.rows) {
            playerCosts[row.owner_id] = (playerCosts[row.owner_id] ?? 0) + parseFloat(row.total_salary);
        }
        // Fetch security layer costs
        const secCosts = await client.query(`SELECT sl.player_id, SUM(sl.daily_cost) as total_cost
         FROM security_layers sl
        WHERE sl.season_id=$1
        GROUP BY sl.player_id`, [season_id]);
        for (const row of secCosts.rows) {
            playerCosts[row.player_id] = (playerCosts[row.player_id] ?? 0) + parseFloat(row.total_cost);
        }
        // Deduct costs from each player
        for (const [playerId, cost] of Object.entries(playerCosts)) {
            await client.query(`UPDATE players
            SET cash = GREATEST(cash - $1, 0),
                last_active = last_active  -- preserve last_active
          WHERE id=$2`, [cost, playerId]);
            // Update business total_expenses
            await client.query(`UPDATE businesses
            SET total_expenses = total_expenses + $1
          WHERE owner_id=$2 AND season_id=$3`, [cost, playerId, season_id]);
        }
        // Dirty money liability (0.5% per day)
        const dirtyBalances = await client.query(`SELECT id, player_id, total_dirty
         FROM dirty_money_balances WHERE season_id=$1 AND total_dirty > 0`, [season_id]);
        for (const bal of dirtyBalances.rows) {
            const dirty = parseFloat(bal.total_dirty);
            const liability = dirty * constants_1.DIRTY_MONEY_LIABILITY_RATE;
            // Deduct from player's cash as "risk cost"
            await client.query(`UPDATE players SET cash = GREATEST(cash - $1, 0) WHERE id=$2`, [liability, bal.player_id]);
        }
        console.log('[sim] Daily costs applied.');
    });
}
// ─── Progressive Tax ──────────────────────────────────────────
/**
 * Apply progressive tax brackets to all players.
 */
async function progressive_tax(season_id) {
    await (0, client_1.withTransaction)(async (client) => {
        const players = await client.query(`SELECT p.id, p.net_worth, p.cash
         FROM players p WHERE p.season_id=$1`, [season_id]);
        for (const player of players.rows) {
            const nw = parseFloat(player.net_worth);
            let taxAmount = 0;
            // Progressive tax — only tax the cash portion, not assets
            const cash = parseFloat(player.cash);
            let remaining = cash;
            for (const bracket of constants_1.TAX_BRACKETS) {
                if (nw < bracket.min_nw)
                    break;
                const taxableInBracket = Math.min(Math.max(nw - bracket.min_nw, 0), bracket.max_nw === Infinity ? nw : bracket.max_nw - bracket.min_nw);
                taxAmount += taxableInBracket * bracket.rate;
            }
            // Cap tax at available cash
            taxAmount = Math.min(taxAmount, remaining);
            if (taxAmount > 0) {
                await client.query(`UPDATE players SET cash = cash - $1 WHERE id=$2`, [taxAmount, player.id]);
                console.log(`[sim] Tax applied: player ${player.id} taxed $${taxAmount.toFixed(2)}`);
            }
        }
        console.log('[sim] Progressive tax applied.');
    });
}
// ─── Season Reset ─────────────────────────────────────────────
/**
 * Full wipe + new season creation after ending season.
 */
async function season_reset(ending_season_id) {
    await (0, client_1.withTransaction)(async (client) => {
        // 1. Mark season as COMPLETED
        await client.query(`UPDATE season_profiles SET status='COMPLETED' WHERE id=$1`, [ending_season_id]);
        // 2. Calculate final rankings and store in season top_players
        const topPlayers = await client.query(`SELECT id, username, net_worth FROM players
        WHERE season_id=$1
        ORDER BY net_worth DESC LIMIT 100`, [ending_season_id]);
        const topPlayersData = topPlayers.rows.map((p, i) => ({
            player_id: p.id,
            username: p.username,
            rank: i + 1,
            net_worth: parseFloat(p.net_worth),
        }));
        await client.query(`UPDATE season_profiles
          SET top_players=$1,
              winner_id=$2
        WHERE id=$3`, [
            JSON.stringify(topPlayersData),
            topPlayers.rows[0]?.id ?? null,
            ending_season_id
        ]);
        // 3. Record season history for each player and grant meta_points
        for (let i = 0; i < topPlayersData.length; i++) {
            const tp = topPlayersData[i];
            const metaPoints = Math.max(100 - tp.rank, 5);
            const historyEntry = {
                season_id: ending_season_id,
                rank: tp.rank,
                net_worth: tp.net_worth,
                achievements: [],
            };
            await client.query(`UPDATE players
            SET meta_points = meta_points + $1,
                season_history = season_history || $2::jsonb
          WHERE id=$3`, [metaPoints, JSON.stringify([historyEntry]), tp.player_id]);
        }
        // 4. Create new season
        const seasonNumRes = await client.query(`SELECT season_number FROM season_profiles ORDER BY season_number DESC LIMIT 1`);
        const nextSeasonNum = (seasonNumRes.rows[0]?.season_number ?? 0) + 1;
        const now = new Date();
        const endsAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
        const taxBrackets = JSON.stringify([
            { min_nw: 0, max_nw: 50000, rate: 0.00 },
            { min_nw: 50000, max_nw: 150000, rate: 0.05 },
            { min_nw: 150000, max_nw: 500000, rate: 0.10 },
            { min_nw: 500000, max_nw: 1500000, rate: 0.18 },
            { min_nw: 1500000, max_nw: 5000000, rate: 0.25 },
            { min_nw: 5000000, max_nw: 999999999, rate: 0.35 },
        ]);
        const newSeasonRes = await client.query(`INSERT INTO season_profiles
         (season_number, name, started_at, ends_at, status, starting_cash,
          tax_rate_brackets, crime_multiplier, resource_set, total_players, top_players)
       VALUES ($1,$2,$3,$4,'ACTIVE',10000,$5,1.0,'{}',0,'[]')
       RETURNING id`, [
            nextSeasonNum,
            `Season ${nextSeasonNum}`,
            now.toISOString(),
            endsAt.toISOString(),
            taxBrackets,
        ]);
        const newSeasonId = newSeasonRes.rows[0].id;
        // 5. Reset season-scoped fields for all players, apply veteran bonus
        const allPlayers = await client.query(`SELECT id, meta_points FROM players`);
        for (const p of allPlayers.rows) {
            const veteranBonus = Math.min(p.meta_points * 10, 5000);
            const startingCash = 10000 + veteranBonus;
            await client.query(`UPDATE players
            SET season_id=$1, cash=$2, net_worth=$2,
                business_slots=3, reputation_score=0,
                alignment='LEGAL', veteran_bonus_cash=$3
          WHERE id=$4`, [newSeasonId, startingCash, veteranBonus, p.id]);
            // Create new heat_score and dirty_money_balance for new season
            await client.query(`INSERT INTO heat_scores
           (player_id, season_id, score, level, decay_rate)
         VALUES ($1,$2,0,'COLD',2.0)`, [p.id, newSeasonId]);
            await client.query(`INSERT INTO dirty_money_balances
           (player_id, season_id, total_dirty, total_earned, total_laundered)
         VALUES ($1,$2,0,0,0)`, [p.id, newSeasonId]);
        }
        (0, handler_1.emitBroadcast)('season_reset', { new_season_id: newSeasonId, ended_season_id: ending_season_id });
        console.log(`[sim] Season reset complete. New season: ${newSeasonId}`);
    });
}
// ─── Helpers ──────────────────────────────────────────────────
async function addHeat(client, playerId, seasonId, amount) {
    const newScore = await client.query(`UPDATE heat_scores
        SET score = LEAST(score + $1, 1000),
            last_criminal_act = NOW()
      WHERE player_id=$2 AND season_id=$3
      RETURNING score`, [amount, playerId, seasonId]);
    if (newScore.rows.length > 0) {
        const score = parseFloat(newScore.rows[0].score);
        const level = (0, detection_1.getHeatLevel)(score);
        await client.query(`UPDATE heat_scores SET level=$1 WHERE player_id=$2 AND season_id=$3`, [level, playerId, seasonId]);
    }
}
async function createAlert(client, playerId, seasonId, type, message, data) {
    await client.query(`INSERT INTO alerts (player_id, season_id, type, message, data)
     VALUES ($1,$2,$3,$4,$5)`, [playerId, seasonId, type, message, JSON.stringify(data)]);
}
function determinePenalty(level, _playerId) {
    switch (level) {
        case 'COLD':
            return { type: 'FINE', amount: 1000 };
        case 'WARM':
            return { type: 'FINE', amount: 5000 };
        case 'HOT':
            return { type: 'RAID', duration_hours: 24, assets_seized_percent: 0.1 };
        case 'BURNING':
            return { type: 'ARREST', duration_hours: 48, assets_seized_percent: 0.2 };
        case 'FUGITIVE':
            return { type: 'FULL_TAKEDOWN', assets_seized_percent: 0.5 };
        default:
            return { type: 'FINE', amount: 1000 };
    }
}
async function applyPenalty(client, playerId, seasonId, penalty) {
    switch (penalty.type) {
        case 'FINE':
            if (penalty.amount) {
                await client.query(`UPDATE players SET cash = GREATEST(cash - $1, 0) WHERE id=$2`, [penalty.amount, playerId]);
            }
            break;
        case 'RAID':
            // Mark one random business as RAIDED
            await client.query(`UPDATE businesses
            SET status='RAIDED'
          WHERE owner_id=$1 AND season_id=$2 AND status='ACTIVE'
          ORDER BY RANDOM() LIMIT 1`, [playerId, seasonId]);
            if (penalty.assets_seized_percent) {
                await client.query(`UPDATE players SET cash = cash * (1 - $1) WHERE id=$2`, [penalty.assets_seized_percent, playerId]);
            }
            break;
        case 'ARREST':
            // Suspend all businesses temporarily, add heat, seize cash
            await client.query(`UPDATE businesses SET status='SUSPENDED'
          WHERE owner_id=$1 AND season_id=$2`, [playerId, seasonId]);
            if (penalty.assets_seized_percent) {
                await client.query(`UPDATE players SET cash = cash * (1 - $1) WHERE id=$2`, [penalty.assets_seized_percent, playerId]);
            }
            if (penalty.duration_hours) {
                await client.query(`UPDATE heat_scores
              SET under_investigation=true,
                  investigation_ends = NOW() + ($1 || ' hours')::interval
            WHERE player_id=$2 AND season_id=$3`, [penalty.duration_hours, playerId, seasonId]);
            }
            break;
        case 'FULL_TAKEDOWN':
            // Seize significant assets
            if (penalty.assets_seized_percent) {
                await client.query(`UPDATE players SET cash = cash * (1 - $1) WHERE id=$2`, [penalty.assets_seized_percent, playerId]);
            }
            await client.query(`UPDATE businesses SET status='BANKRUPT'
          WHERE owner_id=$1 AND season_id=$2`, [playerId, seasonId]);
            break;
    }
}
async function updateAlignment(client, playerId) {
    // Count completed criminal ops
    const criminalRes = await client.query(`SELECT COUNT(*) as count FROM criminal_operations
      WHERE player_id=$1 AND status='COMPLETED'`, [playerId]);
    const criminalCount = parseInt(criminalRes.rows[0].count ?? '0');
    let alignment;
    if (criminalCount >= 10)
        alignment = 'CRIMINAL';
    else if (criminalCount >= 3)
        alignment = 'MIXED';
    else
        alignment = 'LEGAL';
    await client.query(`UPDATE players SET alignment=$1 WHERE id=$2`, [alignment, playerId]);
}
//# sourceMappingURL=simulation.js.map