/**
 * EmpireOS — Weather type definitions (T078).
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
 *   moraleDelta — optional flat morale change on spawn (negative = loss)
 *   logType     — message log colouring ('windfall'|'disaster'|'info')
 */
export const WEATHER_TYPES = Object.freeze([
  {
    id:       'clear_skies',
    icon:     '☀️',
    name:     'Clear Skies',
    desc:     'Bright weather and favourable conditions boost all production.',
    weight:   3,
    duration: 240,   // 60 s
    modifiers: { allRates: 1.10 },
    logType:  'windfall',
  },
  {
    id:       'heavy_rain',
    icon:     '🌧️',
    name:     'Heavy Rain',
    desc:     'Rain nourishes the crops but slows woodcutters.',
    weight:   2,
    duration: 300,   // 75 s
    modifiers: { food: 1.25, wood: 0.90 },
    logType:  'info',
  },
  {
    id:       'scorching_heat',
    icon:     '🌡️',
    name:     'Scorching Heat',
    desc:     'Sweltering heat strains food stores but energises merchants.',
    weight:   2,
    duration: 240,   // 60 s
    modifiers: { food: 0.85, gold: 1.15 },
    logType:  'info',
  },
  {
    id:       'windstorm',
    icon:     '🌪️',
    name:     'Windstorm',
    desc:     'Fierce winds aid lumberjacks but scatter quarry and mine dust.',
    weight:   2,
    duration: 240,   // 60 s
    modifiers: { wood: 1.25, stone: 0.90, iron: 0.90 },
    logType:  'info',
  },
  {
    id:       'snowstorm',
    icon:     '❄️',
    name:     'Snowstorm',
    desc:     'Bitter snowfall slows all work and chills the troops.',
    weight:   1,
    duration: 360,   // 90 s
    modifiers: { allRates: 0.80 },
    moraleDelta: -5,
    logType:  'disaster',
  },
]);
