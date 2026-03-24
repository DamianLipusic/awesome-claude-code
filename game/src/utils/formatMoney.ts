const SUFFIXES = [
  { value: 1e18, suffix: 'Qi' },
  { value: 1e15, suffix: 'Qa' },
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
];

export function formatMoney(amount: number): string {
  if (amount < 0) return '$0';
  for (const { value, suffix } of SUFFIXES) {
    if (amount >= value) {
      const num = amount / value;
      return `$${num >= 100 ? num.toFixed(0) : num >= 10 ? num.toFixed(1) : num.toFixed(2)}${suffix}`;
    }
  }
  return `$${Math.floor(amount).toLocaleString()}`;
}

export function formatPerSecond(amount: number): string {
  return `${formatMoney(amount)}/sec`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
