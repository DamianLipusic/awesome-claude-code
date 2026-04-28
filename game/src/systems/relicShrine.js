/**
 * EmpireOS — Relic Shrine System (T180).
 *
 * When the unique `relicShrine` building is constructed (Medieval Age),
 * the shrine passively awards prestige from discovered relics every 60 seconds.
 * Additionally, the player may "Commune with Relics" every 5 minutes for a
 * bonus that scales with how many relics have been discovered.
 *
 * Commune tiers:
 *   0 relics → +20 prestige
 *   1 relic  → +30 prestige
 *   2–3      → +50 prestige, +50 gold
 *   4–5      → +80 prestige, +80 gold, +5 morale
 *   6 (all)  → +150 prestige, +150 gold, +10 morale, reveal 5 fog tiles
 *
 * State: state.relicShrine = {
 *   nextPrestigeTick:     number,
 *   communeCooldownUntil: number,
 *   totalCommunions:      number,
 *   totalPrestigeAwarded: number,
 * } | null
 */

import { state }        from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';
import { awardPrestige } from './prestige.js';
import { changeMorale } from './morale.js';
import { TICKS_PER_SECOND } from '../core/tick.js';

const PRESTIGE_INTERVAL = 60 * TICKS_PER_SECOND;     // 60 s
const COMMUNE_COOLDOWN  = 5 * 60 * TICKS_PER_SECOND; // 5 min
const PRESTIGE_PER_RELIC = 12;                        // per interval per relic

export function initRelicShrine() {
  if (!state.relicShrine) {
    state.relicShrine = {
      nextPrestigeTick:     state.tick + PRESTIGE_INTERVAL,
      communeCooldownUntil: 0,
      totalCommunions:      0,
      totalPrestigeAwarded: 0,
    };
  }
}

export function relicShrineTick() {
  if (!(state.buildings?.relicShrine >= 1)) return;
  if (!state.relicShrine) initRelicShrine();

  const rs = state.relicShrine;

  if (state.tick >= rs.nextPrestigeTick) {
    rs.nextPrestigeTick = state.tick + PRESTIGE_INTERVAL;
    const count = getRelicCount();
    if (count > 0) {
      const amount = count * PRESTIGE_PER_RELIC;
      awardPrestige(amount, 'relic shrine');
      rs.totalPrestigeAwarded += amount;
    }
  }
}

/**
 * Player action: commune with relics for a scaled bonus.
 * Returns { ok: boolean, reason?: string }
 */
export function communeWithRelics() {
  if (!(state.buildings?.relicShrine >= 1)) {
    return { ok: false, reason: 'Relic Shrine not built' };
  }
  if (!state.relicShrine) initRelicShrine();

  const rs = state.relicShrine;
  if (state.tick < rs.communeCooldownUntil) {
    const secs = Math.ceil((rs.communeCooldownUntil - state.tick) / TICKS_PER_SECOND);
    return { ok: false, reason: `Commune available in ${secs}s` };
  }

  const count = getRelicCount();
  rs.communeCooldownUntil = state.tick + COMMUNE_COOLDOWN;
  rs.totalCommunions++;

  let bonusDesc;
  if (count >= 6) {
    awardPrestige(150, 'relic shrine communion');
    state.resources.gold = Math.min(state.caps.gold, (state.resources.gold ?? 0) + 150);
    changeMorale(10);
    _revealFogTiles(5);
    bonusDesc = '+150 prestige, +150 gold, +10 morale, 5 fog tiles revealed';
  } else if (count >= 4) {
    awardPrestige(80, 'relic shrine communion');
    state.resources.gold = Math.min(state.caps.gold, (state.resources.gold ?? 0) + 80);
    changeMorale(5);
    bonusDesc = '+80 prestige, +80 gold, +5 morale';
  } else if (count >= 2) {
    awardPrestige(50, 'relic shrine communion');
    state.resources.gold = Math.min(state.caps.gold, (state.resources.gold ?? 0) + 50);
    bonusDesc = '+50 prestige, +50 gold';
  } else if (count === 1) {
    awardPrestige(30, 'relic shrine communion');
    bonusDesc = '+30 prestige';
  } else {
    awardPrestige(20, 'relic shrine communion');
    bonusDesc = '+20 prestige';
  }

  emit(Events.RESOURCE_CHANGED, {});
  emit(Events.RELIC_SHRINE_COMMUNE, { count, bonusDesc });
  addMessage(
    `⛩️ Relic Shrine Communion — ${count} relic${count !== 1 ? 's' : ''} resonated: ${bonusDesc}.`,
    'windfall',
  );

  return { ok: true };
}

export function getRelicCount() {
  return Object.keys(state.relics?.discovered ?? {}).length;
}

/** Seconds until commune is available again, 0 if ready. */
export function getCommuneSecsLeft() {
  if (!state.relicShrine) return 0;
  return Math.max(0, Math.ceil(
    (state.relicShrine.communeCooldownUntil - state.tick) / TICKS_PER_SECOND,
  ));
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _revealFogTiles(n) {
  if (!state.map) return;
  const { tiles, width, height } = state.map;
  const candidates = [];
  const seen = new Set();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y][x].owner !== 'player') continue;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = x + dx;
        const ny = y + dy;
        const key = `${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (nx >= 0 && ny >= 0 && nx < width && ny < height && !tiles[ny][nx].revealed) {
          candidates.push({ x: nx, y: ny });
        }
      }
    }
  }
  candidates.sort(() => Math.random() - 0.5);
  let revealed = 0;
  for (const { x, y } of candidates.slice(0, n)) {
    tiles[y][x].revealed = true;
    revealed++;
  }
  if (revealed > 0) emit(Events.MAP_CHANGED, {});
}
