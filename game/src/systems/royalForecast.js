/**
 * EmpireOS — Royal Forecast System (T225).
 *
 * At the start of each season the Court Astronomer generates a forecast.
 * The player may spend 30 gold to "Heed the Forecast", gaining a season-long
 * rate bonus appropriate to the prediction:
 *
 *   Spring (0): +0.5 food/s  — planting preparation
 *   Summer (1): +0.3 food/s  — drought mitigation provisions
 *   Autumn (2): +0.5 gold/s  — harvest surplus trading
 *   Winter (3): +0.5 food/s  — winter provision stockpile
 *
 * The bonus expires naturally at the next SEASON_CHANGED.
 *
 * state.forecast = {
 *   seasonIdx:   0-3,
 *   icon:        string,
 *   name:        string,
 *   prediction:  string,
 *   bonusDesc:   string,
 *   bonus:       { [res]: number } (rate delta per second),
 *   heeded:      boolean,
 *   totalHeeded: number,
 * }
 */

import { state }        from '../core/state.js';
import { emit, on, Events } from '../core/events.js';
import { addMessage }   from '../core/actions.js';

// ── Constants ──────────────────────────────────────────────────────────────

export const FORECAST_GOLD_COST = 30;

const _FORECAST_DEFS = [
  {
    seasonIdx:  0,
    icon:       '🌱',
    name:       'Fertile Growth',
    prediction: 'The stars favour abundant harvests. Fields will yield well this season.',
    bonus:      { food: 0.5 },
    bonusDesc:  '+0.5 food/s (spring planting)',
  },
  {
    seasonIdx:  1,
    icon:       '🌤️',
    name:       'Summer Drought Warning',
    prediction: 'Scorching heat approaches. Wise rulers stockpile food in advance.',
    bonus:      { food: 0.3 },
    bonusDesc:  '+0.3 food/s (drought mitigation)',
  },
  {
    seasonIdx:  2,
    icon:       '🍂',
    name:       'Harvest Surplus',
    prediction: 'A bountiful autumn awaits. Merchants will pay well for surplus grain.',
    bonus:      { gold: 0.5 },
    bonusDesc:  '+0.5 gold/s (harvest trading)',
  },
  {
    seasonIdx:  3,
    icon:       '❄️',
    name:       'Cold Snap Ahead',
    prediction: 'A harsh winter is foretold. Prepare your granaries or face hardship.',
    bonus:      { food: 0.5 },
    bonusDesc:  '+0.5 food/s (winter provisions)',
  },
];

// ── Init ──────────────────────────────────────────────────────────────────

export function initForecast() {
  on(Events.SEASON_CHANGED, _onSeasonChanged);
}

function _onSeasonChanged(data) {
  const seasonIdx = data?.index ?? state.season?.index ?? 0;
  const def       = _FORECAST_DEFS[seasonIdx];
  if (!def) return;

  const prevTotal = state.forecast?.totalHeeded ?? 0;
  state.forecast = {
    seasonIdx,
    icon:       def.icon,
    name:       def.name,
    prediction: def.prediction,
    bonusDesc:  def.bonusDesc,
    bonus:      def.bonus,
    heeded:     false,
    totalHeeded: prevTotal,
  };

  addMessage(
    `🔭 Royal Forecast: ${def.icon} ${def.name} — ${def.prediction}`,
    'info',
  );
  emit(Events.FORECAST_CHANGED, { seasonIdx });
}

// ── Action ────────────────────────────────────────────────────────────────

/**
 * Heed the current forecast.  Spends FORECAST_GOLD_COST gold and activates
 * the season bonus.  Returns { ok: true } or { ok: false, reason }.
 */
export function heedForecast() {
  if (!state.forecast)
    return { ok: false, reason: 'No forecast available yet.' };
  if (state.forecast.heeded)
    return { ok: false, reason: 'Already heeded this forecast.' };
  if ((state.resources?.gold ?? 0) < FORECAST_GOLD_COST)
    return { ok: false, reason: `Need ${FORECAST_GOLD_COST} gold.` };

  state.resources.gold -= FORECAST_GOLD_COST;
  state.forecast.heeded = true;
  state.forecast.totalHeeded += 1;

  addMessage(
    `🔭 Forecast heeded! ${state.forecast.icon} ${state.forecast.bonusDesc} for this season. (${FORECAST_GOLD_COST}🪙 spent)`,
    'windfall',
  );
  emit(Events.FORECAST_CHANGED, { heeded: true });
  emit(Events.RESOURCE_CHANGED, {});
  return { ok: true };
}

// ── Accessor ──────────────────────────────────────────────────────────────

/**
 * Returns the active rate bonus object { [res]: delta } when heeded,
 * or null when no bonus is active.
 */
export function getForecastBonus() {
  if (!state.forecast?.heeded) return null;
  return state.forecast.bonus ?? null;
}
