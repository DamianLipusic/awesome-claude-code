/**
 * EmpireOS — Toast notification system (T029).
 *
 * Displays brief slide-in notifications in the bottom-right corner for
 * high-importance game events (quest completions, achievements, age advances,
 * raids, windfalls, disasters) that would otherwise scroll away in the log.
 *
 * Usage:
 *   import { showToast } from './ui/toastManager.js';
 *   showToast('Quest complete: First Steps!', 'quest');
 *
 * initToasts() wires MESSAGE-event subscriptions automatically.
 */

import { on, Events } from '../core/events.js';

const TOAST_DURATION_MS = 3500; // visible for 3.5 s before fading out

// Message types that get a toast (others stay log-only)
const TOAST_TYPES = new Set([
  'quest', 'achievement', 'age',
  'raid', 'windfall', 'disaster',
]);

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Wire up event subscriptions. Call once during boot.
 */
export function initToasts() {
  // Create the container if it doesn't already exist
  if (!document.getElementById('toast-container')) {
    const el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
  }

  // Listen to MESSAGE events and toast the important ones
  on(Events.MESSAGE, (d) => {
    if (d?.type && TOAST_TYPES.has(d.type)) {
      showToast(d.text, d.type);
    }
  });
}

/**
 * Show a toast with the given message text and style type.
 * The toast disappears automatically after TOAST_DURATION_MS.
 *
 * @param {string} text     - The message to display (plain text, no HTML)
 * @param {string} [type]   - CSS modifier class suffix (quest/achievement/age/raid/…)
 * @param {number} [duration] - Override display duration in ms
 */
export function showToast(text, type = 'info', duration = TOAST_DURATION_MS) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = text;

  // Allow click to dismiss
  el.addEventListener('click', () => _dismissToast(el), { once: true });

  container.appendChild(el);

  // Auto-dismiss after duration
  const timerId = setTimeout(() => _dismissToast(el), duration);
  el._dismissTimer = timerId;
}

// ── Internals ──────────────────────────────────────────────────────────────

function _dismissToast(el) {
  if (!el || !el.parentElement) return; // already removed
  clearTimeout(el._dismissTimer);
  el.classList.add('toast--exiting');
  el.addEventListener('animationend', () => el.remove(), { once: true });
  // Fallback removal in case animationend doesn't fire (hidden tab, etc.)
  setTimeout(() => el.remove(), 400);
}
