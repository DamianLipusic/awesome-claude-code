import { AA_DATA, PKA_NTERM, PKA_CTERM, HALF_LIFE, HPLC_RC } from './aaData';
import { Modifications, PeptideResults } from '../types';

// ── FASTA / Sequence Parsing ─────────────────────────────────────────────────

/** Accepts plain sequence or FASTA format (strips header lines starting with '>') */
export function parseInput(raw: string): string {
  if (raw.includes('>')) {
    // FASTA: remove header lines
    return raw
      .split('\n')
      .filter(l => !l.startsWith('>'))
      .join('')
      .toUpperCase()
      .replace(/\s/g, '');
  }
  return raw.toUpperCase().replace(/\s/g, '');
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateSequence(raw: string): { valid: boolean; sequence: string; errors: string[] } {
  const sequence = parseInput(raw);
  const errors: string[] = [];
  const invalid: string[] = [];
  for (const ch of sequence) {
    if (!AA_DATA[ch] && !invalid.includes(ch)) invalid.push(ch);
  }
  if (invalid.length) errors.push(`Unknown residues: ${invalid.join(', ')}`);
  if (sequence.length < 2) errors.push('Sequence must be at least 2 residues.');
  if (sequence.length > 1000) errors.push('Sequence too long (max 1000).');
  return { valid: errors.length === 0, sequence, errors };
}

// ── Molecular Weight ─────────────────────────────────────────────────────────

export function calcMW(sequence: string, mods: Modifications): { mono: number; avg: number } {
  let mono = 18.01056; // water
  let avg  = 18.015;
  for (const aa of sequence) {
    const d = AA_DATA[aa];
    if (d) { mono += d.mwMono; avg += d.mwAvg; }
  }
  if (mods.nAcetyl)   { mono += 42.0106; avg += 42.0373; }
  if (mods.cAmide)    { mono -= 0.9840;  avg -= 0.9847;  }
  mono -= mods.disulfide * 2.01565;
  avg  -= mods.disulfide * 2.0159;
  return { mono, avg };
}

// ── Net Charge & pI ──────────────────────────────────────────────────────────

function hh(pKa: number, pH: number, isBasic: boolean): number {
  // Henderson-Hasselbalch: returns fractional charge contribution
  if (isBasic) return  1 / (1 + Math.pow(10, pH - pKa));
  else          return -1 / (1 + Math.pow(10, pKa - pH));
}

export function calcNetCharge(sequence: string, pH: number, mods: Modifications): number {
  let charge = 0;
  // Termini
  if (!mods.nAcetyl) charge += hh(PKA_NTERM, pH, true);
  charge += hh(PKA_CTERM, pH, false);
  for (const aa of sequence) {
    const d = AA_DATA[aa];
    if (!d || d.pKaSC === null) continue;
    charge += hh(d.pKaSC, pH, d.group === 'basic');
  }
  return charge;
}

export function calcPI(sequence: string, mods: Modifications): number {
  let lo = 0, hi = 14;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const c = calcNetCharge(sequence, mid, mods);
    if (Math.abs(c) < 1e-4) return mid;
    if (c > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── Extinction Coefficient ───────────────────────────────────────────────────

export function calcExtinction(sequence: string): number {
  let nW = 0, nY = 0, nC = 0;
  for (const aa of sequence) {
    if (aa === 'W') nW++;
    else if (aa === 'Y') nY++;
    else if (aa === 'C') nC++;
  }
  return nW * 5500 + nY * 1490 + nC * 125;
}

// ── GRAVY ────────────────────────────────────────────────────────────────────

export function calcGRAVY(sequence: string): number {
  let sum = 0;
  for (const aa of sequence) {
    sum += AA_DATA[aa]?.hydro ?? 0;
  }
  return sum / sequence.length;
}

// ── Instability Index ────────────────────────────────────────────────────────
// Guruprasad et al. (1990) — uses DIWV dipeptide weights
// A 20×20 subset of the most common values; missing pairs default to 1.0

const DIWV: Record<string, number> = {
  'WW': 1.0, 'WC': 1.0, 'WT': 0.59,'WM': 2.44,'WN': 0.59,'WQ': 1.0, 'WY': 1.0, 'WA': 1.0, 'WP': 1.0,
  'WR': 2.44,'WD': 0.59,'WE': 0.59,'WF': 1.0, 'WG': 1.0, 'WH': 0.59,'WI': 1.0, 'WL': 1.0, 'WK': 1.0,
  'WS': 1.0, 'WV': -7.49,
  'CW': 24.68,'CC': -6.54,'CF': -4.22,'CY': -4.22,'CD': 20.26,'CE': 33.6,'CG': 19.49,'CH': 33.6,
  'CI': 33.6, 'CK': 1.0, 'CL': 20.26,'CM': 33.6, 'CN': 1.0, 'CP': 20.26,'CQ': -6.54,'CR': 1.0,
  'CS': 1.0, 'CT': 33.6, 'CV': -6.54,'CA': 1.0,
  'IW': 1.0, 'IC': 1.0, 'IF': 1.0, 'IY': 1.0, 'ID': 1.0, 'IE': 1.0, 'IG': 1.0, 'IH': 44.34,
  'II': 1.0, 'IK': -7.49,'IL': 1.0, 'IM': 1.0, 'IN': 1.0, 'IP': -1.88,'IQ': 1.0, 'IR': 1.0,
  'IS': 1.0, 'IT': 1.0, 'IV': -7.49,'IA': 1.0,
  'FW': 1.0, 'FC': 1.0, 'FF': 1.0, 'FY': 33.6, 'FD': 13.34,'FE': 1.0, 'FG': 1.0, 'FH': 1.0,
  'FI': 1.0, 'FK': 1.0, 'FL': 1.0, 'FM': 1.0, 'FN': 1.0, 'FP': 20.26,'FQ': 1.0, 'FR': 1.0,
  'FS': 1.0, 'FT': 1.0, 'FV': 1.0, 'FA': 1.0,
  'YW': -7.49,'YC': 1.0, 'YF': 1.0, 'YY': 13.34,'YD': 24.68,'YE': -6.54,'YG': -7.49,'YH': 13.34,
  'YI': 1.0, 'YK': 1.0, 'YL': 1.0, 'YM': 44.34,'YN': 1.0, 'YP': 13.34,'YQ': 1.0, 'YR': -15.91,
  'YS': 1.0, 'YT': -7.49,'YV': 1.0, 'YA': 1.0,
  'HW': 1.0, 'HC': 1.0, 'HF': 1.0, 'HY': 44.34,'HD': 1.0, 'HE': 1.0, 'HG': 1.0, 'HH': 1.0,
  'HI': 44.34,'HK': 24.68,'HL': 1.0, 'HM': 1.0, 'HN': 24.68,'HP': -1.88,'HQ': 1.0, 'HR': 1.0,
  'HS': 1.0, 'HT': -7.49,'HV': 1.0, 'HA': -7.49,
  'DF': -6.54,'DW': 6.08, 'DY': 1.0, 'DD': 1.0, 'DE': 1.0, 'DG': 1.0, 'DH': 1.0, 'DI': 1.0,
  'DK': -7.49,'DL': 1.0, 'DM': 1.0, 'DN': 1.0, 'DP': 1.0, 'DQ': 1.0, 'DR': -6.54,'DS': 1.0,
  'DT': 1.0, 'DV': 1.0, 'DA': 1.0, 'DC': 1.0,
  'EF': 1.0, 'EW': -14.03,'EY': 1.0,'ED': 1.0, 'EE': 1.0, 'EG': 1.0, 'EH': -6.54,'EI': 20.26,
  'EK': 1.0, 'EL': 1.0, 'EM': 1.0, 'EN': 1.0, 'EP': 20.26,'EQ': 1.0, 'ER': 1.0, 'ES': 1.0,
  'ET': 1.0, 'EV': 1.0, 'EA': 1.0, 'EC': 44.34,
  'KF': 1.0, 'KW': -14.03,'KY': 1.0,'KD': 1.0, 'KE': 1.0, 'KG': -7.49,'KH': 1.0, 'KI': -7.49,
  'KK': 1.0, 'KL': -7.49,'KM': 33.6, 'KN': 1.0, 'KP': -6.54,'KQ': 1.0, 'KR': 33.6, 'KS': 1.0,
  'KT': 1.0, 'KV': -7.49,'KA': 1.0, 'KC': 1.0,
  'RW': 1.0, 'RC': 1.0, 'RF': 1.0, 'RY': -6.54,'RD': 1.0, 'RE': 1.0, 'RG': -7.49,'RH': 20.26,
  'RI': 1.0, 'RK': 1.0, 'RL': 1.0, 'RM': 1.0, 'RN': 1.0, 'RP': 20.26,'RQ': 1.0, 'RR': 58.28,
  'RS': 44.94,'RT': 1.0, 'RV': 1.0, 'RA': 1.0,
  'GW': 13.34,'GC': 1.0, 'GF': 1.0, 'GY': -7.49,'GD': 1.0, 'GE': -6.54,'GG': 13.34,'GH': 1.0,
  'GI': -7.49,'GK': 1.0, 'GL': 1.0, 'GM': 1.0, 'GN': -7.49,'GP': 1.0, 'GQ': 1.0, 'GR': 1.0,
  'GS': 1.0, 'GT': -7.49,'GV': 1.0, 'GA': -7.49,
  'PW': -1.88,'PC': -6.54,'PF': 20.26,'PY': 1.0, 'PD': -6.54,'PE': 18.38,'PG': 1.0, 'PH': 1.0,
  'PI': 1.0, 'PK': 1.0, 'PL': 1.0, 'PM': -6.54,'PN': 1.0, 'PP': 20.26,'PQ': 20.26,'PR': -6.54,
  'PS': 20.26,'PT': 1.0, 'PV': 20.26,'PA': 20.26,
  'SW': 1.0, 'SC': 33.6, 'SF': 1.0, 'SY': 1.0, 'SD': 1.0, 'SE': 20.26,'SG': 1.0, 'SH': 1.0,
  'SI': 1.0, 'SK': -7.49,'SL': 1.0, 'SM': 1.0, 'SN': 1.0, 'SP': 44.94,'SQ': 20.26,'SR': 20.26,
  'SS': 20.26,'ST': 1.0, 'SV': 1.0, 'SA': 1.0,
  'TW': -14.03,'TC': 1.0,'TF': 13.34,'TY': 1.0,'TD': 1.0,'TE': 20.26,'TG': -7.49,'TH': 1.0,
  'TI': 1.0, 'TK': 1.0, 'TL': 1.0, 'TM': 1.0, 'TN': -14.03,'TP': 1.0, 'TQ': -6.54,'TR': 1.0,
  'TS': 1.0, 'TT': 1.0, 'TV': 1.0, 'TA': 1.0,
  'MW': 1.0, 'MC': 1.0, 'MF': 1.0, 'MY': 44.34,'MD': 1.0, 'ME': 1.0, 'MG': 1.0, 'MH': 58.28,
  'MI': 1.0, 'MK': 1.0, 'ML': 1.0, 'MM': -1.88,'MN': 1.0, 'MP': 44.34,'MQ': -6.54,'MR': -2.85,
  'MS': 44.94,'MT': -1.88,'MV': 1.0, 'MA': 13.34,
  'NW': -9.37,'NC': -1.88,'NF': -14.03,'NY': 1.0,'ND': 1.0,'NE': 1.0,'NG': -14.03,'NH': 1.0,
  'NI': 44.34,'NK': 24.68,'NL': 1.0, 'NM': 1.0, 'NN': 1.0, 'NP': -1.88,'NQ': -6.54,'NR': 1.0,
  'NS': 1.0, 'NT': -7.49,'NV': 1.0, 'NA': 1.0,
  'QW': 1.0, 'QC': -6.54,'QF': -6.54,'QY': -6.54,'QD': 20.26,'QE': 20.26,'QG': 1.0, 'QH': 1.0,
  'QI': 1.0, 'QK': 1.0, 'QL': 1.0, 'QM': 1.0, 'QN': 1.0, 'QP': 20.26,'QQ': 20.26,'QR': 1.0,
  'QS': 44.94,'QT': 1.0, 'QV': -6.54,'QA': 1.0,
  'VW': 1.0, 'VC': 1.0, 'VF': 1.0, 'VY': -6.54,'VD': -14.03,'VE': 1.0,'VG': -7.49,'VH': 1.0,
  'VI': 1.0, 'VK': -7.49,'VL': 1.0, 'VM': 1.0, 'VN': 1.0, 'VP': 20.26,'VQ': 1.0, 'VR': 1.0,
  'VS': 1.0, 'VT': -7.49,'VV': 1.0, 'VA': 1.0,
  'LW': 24.68,'LC': 1.0, 'LF': 1.0, 'LY': 1.0, 'LD': 1.0, 'LE': 1.0, 'LG': 1.0, 'LH': 1.0,
  'LI': 1.0, 'LK': -7.49,'LL': 1.0, 'LM': 1.0, 'LN': 1.0, 'LP': 20.26,'LQ': 33.6, 'LR': 20.26,
  'LS': 1.0, 'LT': 1.0, 'LV': 1.0, 'LA': 1.0,
  'AW': 1.0, 'AC': 44.34,'AF': 1.0, 'AY': 1.0, 'AD': -7.49,'AE': 1.0,'AG': 1.0, 'AH': -7.49,
  'AI': 1.0, 'AK': 1.0, 'AL': 1.0, 'AM': 1.0, 'AN': 1.0, 'AP': 20.26,'AQ': 1.0, 'AR': 1.0,
  'AS': 1.0, 'AT': 1.0, 'AV': 1.0, 'AA': 1.0,
};

export function calcInstabilityIndex(sequence: string): number {
  if (sequence.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < sequence.length - 1; i++) {
    const pair = sequence[i] + sequence[i + 1];
    sum += DIWV[pair] ?? 1.0;
  }
  return (10 / sequence.length) * sum;
}

// ── Aliphatic Index ──────────────────────────────────────────────────────────

export function calcAliphaticIndex(sequence: string): number {
  const L = sequence.length;
  let nA = 0, nV = 0, nI = 0, nL = 0;
  for (const aa of sequence) {
    if (aa === 'A') nA++;
    else if (aa === 'V') nV++;
    else if (aa === 'I') nI++;
    else if (aa === 'L') nL++;
  }
  return (nA / L) * 100 + 2.9 * (nV / L) * 100 + 3.9 * ((nI + nL) / L) * 100;
}

// ── Half-Life ────────────────────────────────────────────────────────────────

export function calcHalfLife(sequence: string): string {
  return HALF_LIFE[sequence[0]] ?? 'Unknown';
}

// ── HPLC Retention Time ──────────────────────────────────────────────────────

export function calcHPLCRetentionTime(sequence: string, mods: Modifications): number {
  let rt = 0;
  for (const aa of sequence) rt += HPLC_RC[aa] ?? 0;
  if (mods.nAcetyl) rt += 3.0;   // acetylation increases retention
  if (mods.cAmide)  rt += 1.5;
  return rt;
}

// ── Solubility Score ─────────────────────────────────────────────────────────

export function calcSolubility(sequence: string, mods: Modifications): number {
  let score = 100;
  const L = sequence.length;
  let hydrophobicCount = 0;
  let maxHydroRun = 0;
  let currentRun = 0;
  for (const aa of sequence) {
    const d = AA_DATA[aa];
    if (!d) continue;
    if (d.hydro > 1.5) {
      hydrophobicCount++;
      currentRun++;
      maxHydroRun = Math.max(maxHydroRun, currentRun);
    } else {
      currentRun = 0;
    }
  }
  // Penalty for high hydrophobic content
  const hydroFraction = hydrophobicCount / L;
  if (hydroFraction > 0.45) score -= 40;
  else if (hydroFraction > 0.35) score -= 20;
  else if (hydroFraction > 0.25) score -= 10;
  // Penalty for long hydrophobic stretches
  if (maxHydroRun > 5) score -= 25;
  else if (maxHydroRun > 3) score -= 10;
  // Penalty for near-zero charge at pH 7
  const netCharge = Math.abs(calcNetCharge(sequence, 7.0, mods));
  if (netCharge < 1) score -= 20;
  return Math.max(0, Math.min(100, score));
}

// ── Hydrophobicity Profile ───────────────────────────────────────────────────

export function calcHydroProfile(sequence: string, window = 5): { position: number; aa: string; value: number }[] {
  const result = [];
  const half = Math.floor(window / 2);
  for (let i = 0; i < sequence.length; i++) {
    const start = Math.max(0, i - half);
    const end   = Math.min(sequence.length - 1, i + half);
    let sum = 0;
    for (let j = start; j <= end; j++) sum += AA_DATA[sequence[j]]?.hydro ?? 0;
    result.push({ position: i + 1, aa: sequence[i], value: sum / (end - start + 1) });
  }
  return result;
}

// ── Charge vs pH curve ───────────────────────────────────────────────────────

export function calcChargeVsPH(sequence: string, mods: Modifications): { ph: number; charge: number }[] {
  const result = [];
  for (let i = 0; i <= 140; i++) {
    const ph = i / 10;
    result.push({ ph, charge: parseFloat(calcNetCharge(sequence, ph, mods).toFixed(3)) });
  }
  return result;
}

// ── AA Composition ───────────────────────────────────────────────────────────

export function calcComposition(sequence: string): Record<string, number> {
  const comp: Record<string, number> = {};
  for (const aa of sequence) {
    comp[aa] = (comp[aa] ?? 0) + 1;
  }
  return comp;
}

// ── Master calculate ─────────────────────────────────────────────────────────

export function calculateAll(sequence: string, mods: Modifications): PeptideResults {
  const { mono, avg } = calcMW(sequence, mods);
  return {
    sequence,
    length: sequence.length,
    mwMono: mono,
    mwAvg: avg,
    pI: calcPI(sequence, mods),
    netCharge: parseFloat(calcNetCharge(sequence, 7.4, mods).toFixed(2)),
    extinctionCoeff: calcExtinction(sequence),
    gravy: parseFloat(calcGRAVY(sequence).toFixed(3)),
    instabilityIndex: parseFloat(calcInstabilityIndex(sequence).toFixed(2)),
    aliphaticIndex: parseFloat(calcAliphaticIndex(sequence).toFixed(2)),
    halfLife: calcHalfLife(sequence),
    retentionTime: parseFloat(calcHPLCRetentionTime(sequence, mods).toFixed(1)),
    solubilityScore: calcSolubility(sequence, mods),
    composition: calcComposition(sequence),
    chargeVsPH: calcChargeVsPH(sequence, mods),
    hydrophobicityProfile: calcHydroProfile(sequence),
  };
}
