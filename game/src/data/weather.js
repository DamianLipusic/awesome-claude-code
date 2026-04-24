/**
 * EmpireOS — Weather type definitions (T078 / T149).
 *
 * Weather events fire every 4–6 minutes and last 60–90 seconds.
 * Effects are applied to positive production rates only (not upkeep).
 *
 * Each entry:
 *   id          — unique key
 *   icon        — emoji
 *   name        — display name
 *   desc        — one-line description
 *   weight      — relative spawn probability
 *   duration    — how many ticks the weather lasts
 *   modifiers   — { allRates?: mult, [resKey]: mult } — per-resource multipliers
 *   combatMult  — T149: multiplier applied to player attack power in combat (1.0 = no effect)
 *   moraleDelta — optional flat morale change on spawn (negative = loss)
 *   logType     — message log colouring ('windfall'|'disaster'|'info')
 */
export const WEATHER_TYPES = Object.freeze([
  {
    id:         'clear_skies',
    icon:       '☀️',
    name:       'Clear Skies',
    desc:       'Bright weather and favourable conditions boost all production.',
    weight:     3,
    duration:   240,   // 60 s
    modifiers:  { allRates: 1.10 },
    combatMult: 1.05,  // T149: clear visibility grants +5% attack
    logType:    'windfall',
  },
  {
    id:         'heavy_rain',
    icon:       '🌧️',
    name:       'Heavy Rain',
    desc:       'Rain nourishes the crops but slows woodcutters.',
    weight:     2,
    duration:   300,   // 75 s
    modifiers:  { food: 1.25, wood: 0.90 },
    combatMult: 0.90,  // T149: wet ground and poor visibility −10% attack
    logType:    'info',
  },
  {
    id:         'scorching_heat',
    icon:       '🌡️',
    name:       'Scorching Heat',
    desc:       'Sweltering heat strains food stores but energises merchants.',
    weight:     2,
    duration:   240,   // 60 s
    modifiers:  { food: 0.85, gold: 1.15 },
    combatMult: 0.95,  // T149: heat fatigue −5% attack
    logType:    'info',
  },
  {
    id:         'windstorm',
    icon:       '🌪️',
    name:       'Windstorm',
    desc:       'Fierce winds aid lumberjacks but scatter quarry and mine dust.',
    weight:     2,
    duration:   240,   // 60 s
    modifiers:  { wood: 1.25, stone: 0.90, iron: 0.90 },
    combatMult: 1.10,  // T149: adrenaline and windward charge +10% attack
    logType:    'info',
  },
  {
    id:         'snowstorm',
    icon:       '❄️',
    name:       'Snowstorm',
    desc:       'Bitter snowfall slows all work and chills the troops.',
    weight:     1,
    duration:   360,   // 90 s
    modifiers:  { allRates: 0.80 },
    combatMult: 0.85,  // T149: heavy snow hampers movement −15% attack
    moraleDelta: -5,
    logType:    'disaster',
  },
]);
