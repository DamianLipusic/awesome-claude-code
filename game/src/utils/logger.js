const DEBUG = false;

export function log(...args) {
  if (DEBUG) console.log('[EmpireOS]', ...args);
}

export function warn(...args) {
  console.warn('[EmpireOS]', ...args);
}

export function err(...args) {
  console.error('[EmpireOS]', ...args);
}
