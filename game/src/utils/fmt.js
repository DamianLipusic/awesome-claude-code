/**
 * Format a resource number for display.
 * Uses K/M/B suffixes for large values.
 */
export function fmtNum(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)         return (n / 1_000).toFixed(1) + 'K';
  return String(Math.floor(n));
}

/**
 * Format a rate (per second) with sign and /s suffix.
 */
export function fmtRate(r) {
  const sign = r >= 0 ? '+' : '';
  return `${sign}${r.toFixed(1)}/s`;
}

/**
 * Format seconds into mm:ss.
 */
export function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
