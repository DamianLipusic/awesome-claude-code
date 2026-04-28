/**
 * EmpireOS — Procedural sound effects (T178)
 *
 * All sounds are synthesized via the Web Audio API — no audio files required.
 * Sounds are disabled by default; the player enables them in Settings.
 * The preference is persisted to localStorage.
 *
 * Public API:
 *   initAudio()            — wire up game event listeners
 *   isSoundEnabled()       — returns boolean
 *   setSoundEnabled(bool)  — toggle; persisted to localStorage
 */

import { on, Events } from '../core/events.js';

const STORAGE_KEY = 'empireos-sound';

// ── Audio context (lazy, created on first user gesture) ─────────────────────

let _ctx = null;

function _getCtx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

// ── Preference ───────────────────────────────────────────────────────────────

let _enabled = false;

export function isSoundEnabled() { return _enabled; }

export function setSoundEnabled(on) {
  _enabled = !!on;
  try { localStorage.setItem(STORAGE_KEY, _enabled ? '1' : '0'); } catch {}
}

function _loadPref() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _enabled = raw === '1';
  } catch {
    _enabled = false;
  }
}

// ── Low-level synth primitives ────────────────────────────────────────────────

/**
 * Play a single synthesized tone.
 * @param {number} freq       Frequency in Hz
 * @param {number} duration   Duration in seconds
 * @param {string} type       OscillatorType ('sine'|'triangle'|'sawtooth'|'square')
 * @param {number} gainPeak   Peak gain (0–1)
 * @param {number} startDelay Seconds from now to start
 */
function _tone(freq, duration, type = 'triangle', gainPeak = 0.25, startDelay = 0) {
  const ctx = _getCtx();
  if (!ctx) return;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type      = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);

  const t0 = ctx.currentTime + startDelay;
  const t1 = t0 + duration * 0.1;   // attack
  const t2 = t0 + duration * 0.8;   // sustain end
  const t3 = t0 + duration;          // release end

  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(gainPeak, t1);
  gain.gain.setValueAtTime(gainPeak, t2);
  gain.gain.linearRampToValueAtTime(0, t3);

  osc.start(t0);
  osc.stop(t3 + 0.05);
}

/**
 * Play a sequence of notes with fixed spacing.
 */
function _seq(freqs, noteDur, type = 'triangle', gainPeak = 0.25, spacing = null) {
  const step = spacing ?? noteDur * 0.85;
  freqs.forEach((f, i) => _tone(f, noteDur, type, gainPeak, i * step));
}

// ── Named sound effects ───────────────────────────────────────────────────────

function _play(fn) {
  if (!_enabled) return;
  try { fn(); } catch {}
}

const Sfx = {
  buildComplete() {
    // Cheerful ascending major arpeggio
    _seq([523, 659, 784, 1047], 0.18, 'triangle', 0.22);
  },

  researchComplete() {
    // Soft mystical chime
    _seq([880, 1109, 1319], 0.22, 'sine', 0.20);
  },

  battleWon() {
    // Triumphant brass-like fanfare
    _seq([392, 523, 659, 784, 1047], 0.15, 'sawtooth', 0.18);
  },

  battleLost() {
    // Descending dirge
    _seq([523, 440, 370, 311], 0.22, 'sawtooth', 0.18);
  },

  achievementUnlocked() {
    // Bright sparkle ascending scale
    _seq([523, 659, 784, 1047, 1319, 1568], 0.12, 'triangle', 0.28);
  },

  ageAdvanced() {
    // Grand chord swell — root + fifth + octave + two in sequence
    _tone(261, 1.2, 'triangle', 0.20, 0.0);
    _tone(392, 1.1, 'triangle', 0.18, 0.1);
    _tone(523, 1.0, 'triangle', 0.22, 0.2);
    _tone(784, 0.9, 'triangle', 0.20, 0.3);
    _tone(1047, 0.7, 'sine',   0.18, 0.45);
  },

  notification() {
    // Gentle double ping
    _seq([880, 1047], 0.14, 'sine', 0.18);
  },

  resourceAlert() {
    // Urgent warning pulse × 3
    [0, 0.22, 0.44].forEach(d => _tone(440, 0.16, 'square', 0.14, d));
  },

  questComplete() {
    // Triumphant two-tone + rise
    _seq([659, 784, 1047], 0.20, 'triangle', 0.22);
  },

  gameOver() {
    // Slow falling minor third into silence
    _tone(440, 0.4, 'sawtooth', 0.20, 0.0);
    _tone(370, 0.5, 'sawtooth', 0.18, 0.35);
    _tone(294, 0.8, 'sine',    0.15, 0.75);
  },
};

// ── Event wiring ──────────────────────────────────────────────────────────────

export function initAudio() {
  _loadPref();

  on(Events.BUILDING_CHANGED, d => {
    if (d?.action === 'built') _play(Sfx.buildComplete);
  });

  on(Events.TECH_CHANGED, d => {
    if (d?.done) _play(Sfx.researchComplete);
  });

  on(Events.COMBAT, d => {
    if (d?.result === 'win')  _play(Sfx.battleWon);
    if (d?.result === 'loss') _play(Sfx.battleLost);
  });

  on(Events.ACHIEVEMENT_UNLOCKED, () => _play(Sfx.achievementUnlocked));

  on(Events.AGE_CHANGED, () => _play(Sfx.ageAdvanced));

  on(Events.QUEST_COMPLETED, () => _play(Sfx.questComplete));

  on(Events.GAME_OVER, () => _play(Sfx.gameOver));

  on(Events.MESSAGE, d => {
    // Low-priority notification ping for important non-combat messages
    if (['quest', 'achievement', 'age', 'hero', 'relic', 'prestige', 'title'].includes(d?.type)) return; // handled above
    if (['raid', 'disaster', 'barbarian', 'crisis', 'siege'].includes(d?.type)) {
      _play(Sfx.resourceAlert);
    } else if (['windfall', 'festival', 'boon', 'treaty'].includes(d?.type)) {
      _play(Sfx.notification);
    }
  });
}
