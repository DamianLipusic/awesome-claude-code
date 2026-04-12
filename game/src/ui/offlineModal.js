/**
 * EmpireOS — Offline Progress Modal (T049)
 *
 * When the player returns after ≥30 seconds of real-world absence this module:
 *   1. calcOfflineProgress() — computes and applies resource gains/losses for the
 *      time away (capped at MAX_OFFLINE_SECS), mutating state.resources in-place.
 *   2. showOfflineModal() — renders a welcome-back modal reporting the deltas.
 *
 * Public API:
 *   calcOfflineProgress(saveTs, rates, resources, caps) → { elapsed, gains } | null
 *   showOfflineModal(elapsed, gains) → void
 */

const MODAL_ID        = 'offline-modal';
const MAX_OFFLINE_SECS = 8 * 3600;   // cap at 8 hours
const MIN_OFFLINE_SECS = 30;         // ignore trivially short absences

/** Metadata for display order and labels. */
const RES_META = [
  { id: 'gold',  icon: '💰', name: 'Gold'  },
  { id: 'food',  icon: '🌾', name: 'Food'  },
  { id: 'wood',  icon: '🪵', name: 'Wood'  },
  { id: 'stone', icon: '🪨', name: 'Stone' },
  { id: 'iron',  icon: '⚙️', name: 'Iron'  },
  { id: 'mana',  icon: '✨', name: 'Mana'  },
];

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Calculate offline resource progress and apply it to `resources` in-place.
 *
 * @param {number} saveTs     Unix timestamp (ms) when the save was written.
 * @param {object} rates      Current per-second rates (after recalcRates()).
 * @param {object} resources  Live resource object — mutated by this function.
 * @param {object} caps       Resource caps.
 * @returns {{ elapsed: number, gains: object }} or null if elapsed < MIN_OFFLINE_SECS.
 */
export function calcOfflineProgress(saveTs, rates, resources, caps) {
  if (!saveTs) return null;

  const elapsedRaw    = Math.floor((Date.now() - saveTs) / 1000);
  if (elapsedRaw < MIN_OFFLINE_SECS) return null;

  const elapsed = Math.min(elapsedRaw, MAX_OFFLINE_SECS);
  const gains   = {};

  for (const { id } of RES_META) {
    const rate   = rates[id]     ?? 0;
    const before = resources[id] ?? 0;
    const cap    = caps[id]      ?? Infinity;
    const delta  = rate * elapsed;
    const after  = Math.min(cap, Math.max(0, before + delta));
    gains[id]     = after - before;
    resources[id] = after;
  }

  return { elapsed, gains };
}

/**
 * Show the welcome-back modal.
 * Should be called after all UI panels have been initialised.
 *
 * @param {number} elapsed  Seconds the player was away (already capped).
 * @param {object} gains    Per-resource delta object (may be negative).
 */
export function showOfflineModal(elapsed, gains) {
  if (!elapsed || elapsed < MIN_OFFLINE_SECS) return;

  // Require at least one resource change ≥ 1 unit to bother showing
  const meaningful = Object.values(gains).some(v => Math.abs(v) >= 1);
  if (!meaningful) return;

  // Remove any stale instance from a previous load
  document.getElementById(MODAL_ID)?.remove();

  const timeStr = _formatTime(elapsed);

  const rows = RES_META
    .filter(r => Math.abs(gains[r.id] ?? 0) >= 1)
    .map(r => {
      const v    = gains[r.id];
      const sign = v >= 0 ? '+' : '';
      const cls  = v >= 0 ? 'offline-gain--pos' : 'offline-gain--neg';
      return `
        <div class="offline-gain-row">
          <span class="offline-gain-icon">${r.icon}</span>
          <span class="offline-gain-name">${r.name}</span>
          <span class="offline-gain-val ${cls}">${sign}${Math.round(v).toLocaleString()}</span>
        </div>`;
    }).join('');

  const el = document.createElement('div');
  el.id        = MODAL_ID;
  el.className = 'modal-overlay';
  el.setAttribute('role',       'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="modal-box offline-modal-box">
      <div class="offline-header">
        <span class="offline-moon">🌙</span>
        <div>
          <div class="offline-title">Welcome Back!</div>
          <div class="offline-sub">Away for <strong>${timeStr}</strong> — your empire kept going.</div>
        </div>
      </div>
      <div class="offline-gains">
        ${rows || '<p class="offline-no-change">No significant changes while you were away.</p>'}
      </div>
      <div class="modal-footer">
        <button class="btn btn--ng-start" id="offline-modal-ok">Continue →</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  const ok = document.getElementById('offline-modal-ok');
  ok.addEventListener('click', _close);
  el.addEventListener('click', e => { if (e.target === el) _close(); });

  // Keyboard: Enter or Escape dismisses
  document.addEventListener('keydown', _keyHandler);
}

// ── Internal helpers ──────────────────────────────────────────────────────

function _close() {
  document.getElementById(MODAL_ID)?.remove();
  document.removeEventListener('keydown', _keyHandler);
}

function _keyHandler(e) {
  if (e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault();
    _close();
  }
}

/**
 * Format seconds into a human-readable string: "2h 15m" or "45m".
 */
function _formatTime(secs) {
  const totalMins = Math.floor(secs / 60);
  const hours     = Math.floor(totalMins / 60);
  const mins      = totalMins % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${totalMins}m`;
}
