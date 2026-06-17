import type { SeitenPlan, GeruestPlan, BausteinSeite } from '../models/Project';

interface PlanSvgOptionen {
  showRahmen?: boolean;
  showBelag?: boolean;
  showGelaender?: boolean;
  showAnker?: boolean;
  showMasse?: boolean;
}

const SCALE = 50; // 1:50 — 1 meter = 20mm at this scale, in SVG units (1 SVG unit = 1mm)
function m(meter: number): number { return meter * 1000 / SCALE; }

const FARBEN = {
  boden: '#888888',
  fassade: '#E0E0E0',
  fassadeRand: '#9E9E9E',
  rahmen: '#1565C0',
  riegel: '#1976D2',
  diagonale: '#42A5F5',
  belag: '#B3E5FC',
  belagRand: '#0288D1',
  gelaender: '#F57F17',
  bordbrett: '#E65100',
  anker: '#D32F2F',
  masse: '#212121',
  oeffnung: '#FFFFFF',
  oeffnungRand: '#616161',
};

export function generiereSeitenElevationSVG(
  seitenPlan: SeitenPlan,
  seite: BausteinSeite,
  plan: GeruestPlan,
  optionen: PlanSvgOptionen = {},
): string {
  const {
    showRahmen = true,
    showBelag = true,
    showGelaender = true,
    showAnker = true,
    showMasse = true,
  } = optionen;

  const gesamtBreite = seitenPlan.felder.reduce((sum, f) => sum + f.breite, 0);
  const letzteLage = seitenPlan.lagen.at(-1);
  const gesamtHoehe = letzteLage ? letzteLage.startY + letzteLage.hoehe : 0;

  // SVG dimensions in mm (at 1:50 scale)
  const svgBreite = m(gesamtBreite) + 60; // margins for dimensions
  const svgHoehe = m(gesamtHoehe) + 60;
  const originX = 40; // left margin
  const originY = svgHoehe - 20; // bottom margin (Y grows upward in drawing, downward in SVG)

  function xPos(meter: number): number { return originX + m(meter); }
  function yPos(meter: number): number { return originY - m(meter); }

  const linien: string[] = [];
  const flaechen: string[] = [];
  const texte: string[] = [];

  // Ground line
  linien.push(`<line x1="${originX - 10}" y1="${yPos(0)}" x2="${xPos(gesamtBreite) + 10}" y2="${yPos(0)}" stroke="${FARBEN.boden}" stroke-width="2" stroke-dasharray="5,3"/>`);

  // Facade outline
  flaechen.push(`<rect x="${xPos(0)}" y="${yPos(gesamtHoehe)}" width="${m(gesamtBreite)}" height="${m(gesamtHoehe)}" fill="${FARBEN.fassade}" stroke="${FARBEN.fassadeRand}" stroke-width="1"/>`);

  // Openings
  for (const oeffnung of seite.oeffnungen) {
    const ox = xPos(oeffnung.horizontalOffset);
    const oy = yPos(oeffnung.bruestungHoehe + oeffnung.hoehe);
    const ow = m(oeffnung.breite);
    const oh = m(oeffnung.hoehe);
    flaechen.push(`<rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="${FARBEN.oeffnung}" stroke="${FARBEN.oeffnungRand}" stroke-width="0.5"/>`);
  }

  // Scaffold bays and lifts
  for (const feld of seitenPlan.felder) {
    for (const lage of seitenPlan.lagen) {
      // Belag (deck hatching)
      if (showBelag && lage.hatBelag) {
        const bx = xPos(feld.startX);
        const by = yPos(lage.startY + lage.hoehe);
        const bw = m(feld.breite);
        const bh = m(lage.hoehe * 0.1); // 10% height for plank thickness
        flaechen.push(`<rect x="${bx}" y="${by + m(lage.hoehe) - bh}" width="${bw}" height="${bh}" fill="${FARBEN.belag}" stroke="${FARBEN.belagRand}" stroke-width="0.5"/>`);
      }
    }
  }

  // Vertical columns (Rahmen / Rohre)
  if (showRahmen) {
    for (const feld of seitenPlan.felder) {
      // Left column of each field
      linien.push(`<line x1="${xPos(feld.startX)}" y1="${yPos(0)}" x2="${xPos(feld.startX)}" y2="${yPos(gesamtHoehe)}" stroke="${FARBEN.rahmen}" stroke-width="2"/>`);
    }
    // Right edge column
    linien.push(`<line x1="${xPos(gesamtBreite)}" y1="${yPos(0)}" x2="${xPos(gesamtBreite)}" y2="${yPos(gesamtHoehe)}" stroke="${FARBEN.rahmen}" stroke-width="2"/>`);

    // Horizontal ledgers at each lift height
    for (const lage of seitenPlan.lagen) {
      linien.push(`<line x1="${xPos(0)}" y1="${yPos(lage.startY)}" x2="${xPos(gesamtBreite)}" y2="${yPos(lage.startY)}" stroke="${FARBEN.riegel}" stroke-width="1.5"/>`);
    }
    // Top ledger
    linien.push(`<line x1="${xPos(0)}" y1="${yPos(gesamtHoehe)}" x2="${xPos(gesamtBreite)}" y2="${yPos(gesamtHoehe)}" stroke="${FARBEN.riegel}" stroke-width="1.5"/>`);

    // Diagonal braces (one diagonal per 4 bays)
    for (let i = 0; i < seitenPlan.felder.length; i += 4) {
      const feld = seitenPlan.felder[i];
      for (const lage of seitenPlan.lagen) {
        const x1 = xPos(feld.startX);
        const y1 = yPos(lage.startY);
        const x2 = xPos(feld.startX + feld.breite);
        const y2 = yPos(lage.startY + lage.hoehe);
        linien.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${FARBEN.diagonale}" stroke-width="0.8" opacity="0.7"/>`);
      }
    }
  }

  // Guardrails at top of each lift
  if (showGelaender) {
    for (const lage of seitenPlan.lagen) {
      if (lage.hatGelaender) {
        const yG = yPos(lage.startY + lage.hoehe);
        linien.push(`<line x1="${xPos(0)}" y1="${yG - 3}" x2="${xPos(gesamtBreite)}" y2="${yG - 3}" stroke="${FARBEN.gelaender}" stroke-width="1.5"/>`);
        if (lage.hatBordbrett) {
          linien.push(`<line x1="${xPos(0)}" y1="${yG - 1}" x2="${xPos(gesamtBreite)}" y2="${yG - 1}" stroke="${FARBEN.bordbrett}" stroke-width="1"/>`);
        }
      }
    }
  }

  // Anchors
  if (showAnker) {
    const seiteAnker = plan.verankerungen.filter(a => a.seitenId === seite.id);
    for (const anker of seiteAnker) {
      const ax = xPos(anker.x);
      const ay = yPos(anker.y);
      flaechen.push(`<circle cx="${ax}" cy="${ay}" r="3" fill="${FARBEN.anker}" stroke="white" stroke-width="0.5"/>`);
      linien.push(`<line x1="${ax}" y1="${ay}" x2="${ax - 8}" y2="${ay}" stroke="${FARBEN.anker}" stroke-width="1"/>`);
    }
  }

  // Dimension annotations
  if (showMasse) {
    // Overall width at bottom
    const yMass = yPos(0) + 15;
    texte.push(`<line x1="${xPos(0)}" y1="${yMass - 5}" x2="${xPos(0)}" y2="${yMass + 5}" stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    texte.push(`<line x1="${xPos(gesamtBreite)}" y1="${yMass - 5}" x2="${xPos(gesamtBreite)}" y2="${yMass + 5}" stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    texte.push(`<line x1="${xPos(0)}" y1="${yMass}" x2="${xPos(gesamtBreite)}" y2="${yMass}" stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    texte.push(`<text x="${xPos(gesamtBreite / 2)}" y="${yMass + 10}" text-anchor="middle" font-size="7" fill="${FARBEN.masse}">${gesamtBreite.toFixed(2)} m</text>`);

    // Individual bay widths
    for (const feld of seitenPlan.felder) {
      const xMitte = xPos(feld.startX + feld.breite / 2);
      texte.push(`<text x="${xMitte}" y="${yPos(0) + 8}" text-anchor="middle" font-size="5" fill="${FARBEN.masse}">${feld.breite.toFixed(2)}</text>`);
    }

    // Height dimension on left
    const xMassLinks = originX - 20;
    texte.push(`<line x1="${xMassLinks - 5}" y1="${yPos(0)}" x2="${xMassLinks + 5}" y2="${yPos(0)}" stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    texte.push(`<line x1="${xMassLinks - 5}" y1="${yPos(gesamtHoehe)}" x2="${xMassLinks + 5}" y2="${yPos(gesamtHoehe)}" stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    texte.push(`<line x1="${xMassLinks}" y1="${yPos(0)}" x2="${xMassLinks}" y2="${yPos(gesamtHoehe)}" stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    texte.push(`<text x="${xMassLinks - 8}" y="${yPos(gesamtHoehe / 2)}" text-anchor="middle" font-size="7" fill="${FARBEN.masse}" transform="rotate(-90,${xMassLinks - 8},${yPos(gesamtHoehe / 2)})">${gesamtHoehe.toFixed(2)} m</text>`);

    // Lift heights on left side
    for (const lage of seitenPlan.lagen) {
      texte.push(`<text x="${xPos(0) - 3}" y="${yPos(lage.startY + lage.hoehe / 2)}" text-anchor="end" font-size="5" fill="${FARBEN.masse}">${lage.hoehe.toFixed(1)}</text>`);
    }
  }

  // Title block
  const titelY = svgHoehe - 5;
  texte.push(`<text x="${svgBreite / 2}" y="${titelY}" text-anchor="middle" font-size="8" font-weight="bold" fill="#212121">${seite.anzeigename} — Maßstab 1:50</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgBreite} ${svgHoehe}" width="${svgBreite}mm" height="${svgHoehe}mm">
  <defs>
    <style>text { font-family: Arial, Helvetica, sans-serif; }</style>
  </defs>
  <rect width="100%" height="100%" fill="white"/>
  <g id="flaechen">${flaechen.join('\n  ')}</g>
  <g id="linien">${linien.join('\n  ')}</g>
  <g id="texte">${texte.join('\n  ')}</g>
</svg>`;
}

// ─── Grundriss (Floor Plan) ──────────────────────────────────────────────────
//
// Draufsicht (top-down view) for one facade side.
// X-axis  = facade width (bay layout)
// Y-axis  = depth away from building wall
//
// Layout (Y, upward = away from wall):
//   y = 0            → building wall (thick line)
//   y = wandabstand  → front standards row  (default 0.25 m)
//   y = wandabstand + RAHMEN_TIEFE → back standards row
//   deck fills the bay area between front & back row
//
// Standards are shown as small squares; anchor positions are
// shown as red dots on the wall line; diagonal braces are shown
// as thin X patterns in alternate bays.

const RAHMEN_TIEFE = 0.73;   // distance between inner and outer standard rows (m)
const BELAG_BREITE = 0.32;   // width of one plank board (m)
const STD_RADIUS   = 0.04;   // visual radius of a standard post (m)
const WANDABSTAND  = 0.25;   // default wall clearance (m)

interface GrundrissOptionen {
  wandabstand?: number;        // actual measured clearance, default 0.25m
  showStaender?: boolean;      // show standard posts
  showBelag?: boolean;         // shade working deck
  showAnker?: boolean;         // show anchor positions
  showDiagonalen?: boolean;    // show plan-view brace pattern
  showMasse?: boolean;         // dimension annotations
}

export function generiereGrundrissSSVG(
  seitenPlan: SeitenPlan,
  seite: BausteinSeite,
  plan: GeruestPlan,
  optionen: GrundrissOptionen = {},
): string {
  const {
    wandabstand = WANDABSTAND,
    showStaender = true,
    showBelag = true,
    showAnker = true,
    showDiagonalen = true,
    showMasse = true,
  } = optionen;

  const gesamtBreite = seitenPlan.felder.reduce((sum, f) => sum + f.breite, 0);

  // Depth of the full scaffold cross-section
  const geruestTiefe = wandabstand + RAHMEN_TIEFE;

  // SVG page (1:50 scale)
  const MARG_LEFT   = 50;
  const MARG_RIGHT  = 20;
  const MARG_TOP    = 30;
  const MARG_BOTTOM = 40;

  const svgBreite = m(gesamtBreite) + MARG_LEFT + MARG_RIGHT;
  const svgHoehe  = m(geruestTiefe) + MARG_TOP + MARG_BOTTOM;

  // Coordinate helpers (Y grows downward in SVG, but we draw wall at bottom → scaffold extends up)
  const wallY = svgHoehe - MARG_BOTTOM;     // building wall at bottom
  function xOf(meterX: number): number { return MARG_LEFT + m(meterX); }
  function yOf(depthM: number): number  { return wallY - m(depthM); }   // depth from wall

  const innerY = yOf(wandabstand);              // front standard row (near wall)
  const outerY = yOf(wandabstand + RAHMEN_TIEFE); // back standard row (far from wall)

  const elemente: string[] = [];

  // ── Wall clearance zone (light yellow) ──────────────────────────────────
  elemente.push(`<rect x="${xOf(0)}" y="${innerY}" width="${m(gesamtBreite)}" height="${m(wandabstand)}"
    fill="#FFFDE7" stroke="none"/>`);

  // ── Working deck per field (light blue) ──────────────────────────────────
  if (showBelag) {
    for (const feld of seitenPlan.felder) {
      const bx  = xOf(feld.startX);
      const bw  = m(feld.breite);
      const plankenAnzahl = Math.ceil(feld.breite / BELAG_BREITE);
      const plankenBreite = m(BELAG_BREITE);

      for (let i = 0; i < plankenAnzahl; i++) {
        const px = bx + i * plankenBreite;
        const clipped = Math.min(plankenBreite, bx + bw - px);
        if (clipped <= 0) continue;
        const shade = i % 2 === 0 ? '#B3E5FC' : '#81D4FA';
        elemente.push(`<rect x="${px}" y="${outerY}" width="${clipped}" height="${m(RAHMEN_TIEFE)}"
          fill="${shade}" stroke="${FARBEN.belagRand}" stroke-width="0.3"/>`);
      }
    }
  }

  // ── Building wall ─────────────────────────────────────────────────────────
  elemente.push(`<line x1="${xOf(0)}" y1="${wallY}" x2="${xOf(gesamtBreite)}" y2="${wallY}"
    stroke="#424242" stroke-width="4"/>`);
  // Wall fill below
  elemente.push(`<rect x="${xOf(0)}" y="${wallY}" width="${m(gesamtBreite)}" height="4"
    fill="#9E9E9E"/>`);

  // ── Openings on wall ─────────────────────────────────────────────────────
  for (const oeffnung of seite.oeffnungen) {
    const ox = xOf(oeffnung.horizontalOffset);
    const ow = m(oeffnung.breite);
    elemente.push(`<rect x="${ox}" y="${wallY - 2}" width="${ow}" height="8"
      fill="white" stroke="${FARBEN.oeffnungRand}" stroke-width="0.5"/>`);
    elemente.push(`<text x="${ox + ow / 2}" y="${wallY + 8}"
      text-anchor="middle" font-size="5" fill="#616161">${oeffnung.typ}</text>`);
  }

  // ── Diagonal plan-view braces ─────────────────────────────────────────────
  if (showDiagonalen) {
    for (let i = 0; i < seitenPlan.felder.length; i += 4) {
      const feld = seitenPlan.felder[i];
      const x1 = xOf(feld.startX);
      const x2 = xOf(feld.startX + feld.breite);
      elemente.push(`<line x1="${x1}" y1="${outerY}" x2="${x2}" y2="${innerY}"
        stroke="${FARBEN.diagonale}" stroke-width="0.7" opacity="0.6"/>`);
      elemente.push(`<line x1="${x2}" y1="${outerY}" x2="${x1}" y2="${innerY}"
        stroke="${FARBEN.diagonale}" stroke-width="0.7" opacity="0.6"/>`);
    }
  }

  // ── Standard posts ────────────────────────────────────────────────────────
  if (showStaender) {
    const postR = m(STD_RADIUS);
    const yRows = [innerY, outerY];

    // One post per field boundary (including right edge)
    const postXs = [
      ...seitenPlan.felder.map(f => xOf(f.startX)),
      xOf(gesamtBreite),
    ];

    for (const px of postXs) {
      for (const py of yRows) {
        elemente.push(`<rect x="${px - postR}" y="${py - postR}" width="${postR * 2}" height="${postR * 2}"
          fill="${FARBEN.rahmen}" stroke="white" stroke-width="0.5" rx="1"/>`);
      }
    }

    // Inner ledger lines
    elemente.push(`<line x1="${xOf(0)}" y1="${innerY}" x2="${xOf(gesamtBreite)}" y2="${innerY}"
      stroke="${FARBEN.riegel}" stroke-width="1.2"/>`);
    elemente.push(`<line x1="${xOf(0)}" y1="${outerY}" x2="${xOf(gesamtBreite)}" y2="${outerY}"
      stroke="${FARBEN.riegel}" stroke-width="1.2"/>`);

    // Field divider ledgers (transversal Rahmen)
    for (const feld of seitenPlan.felder) {
      const fx = xOf(feld.startX);
      elemente.push(`<line x1="${fx}" y1="${innerY}" x2="${fx}" y2="${outerY}"
        stroke="${FARBEN.rahmen}" stroke-width="1.5"/>`);
    }
    // Rightmost divider
    elemente.push(`<line x1="${xOf(gesamtBreite)}" y1="${innerY}" x2="${xOf(gesamtBreite)}" y2="${outerY}"
      stroke="${FARBEN.rahmen}" stroke-width="1.5"/>`);
  }

  // ── Anchor positions on wall ──────────────────────────────────────────────
  if (showAnker) {
    const seiteAnker = plan.verankerungen.filter(a => a.seitenId === seite.id);
    for (const anker of seiteAnker) {
      const ax = xOf(anker.x);
      elemente.push(`<circle cx="${ax}" cy="${wallY}" r="3" fill="${FARBEN.anker}" stroke="white" stroke-width="0.5"/>`);
      elemente.push(`<line x1="${ax}" y1="${wallY}" x2="${ax}" y2="${wallY - 6}"
        stroke="${FARBEN.anker}" stroke-width="1"/>`);
    }
  }

  // ── Dimension annotations ────────────────────────────────────────────────
  if (showMasse) {
    // Total facade width at top
    const yDimTop = outerY - 10;
    elemente.push(`<line x1="${xOf(0)}" y1="${yDimTop - 4}" x2="${xOf(0)}" y2="${yDimTop + 4}"
      stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    elemente.push(`<line x1="${xOf(gesamtBreite)}" y1="${yDimTop - 4}" x2="${xOf(gesamtBreite)}" y2="${yDimTop + 4}"
      stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    elemente.push(`<line x1="${xOf(0)}" y1="${yDimTop}" x2="${xOf(gesamtBreite)}" y2="${yDimTop}"
      stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    elemente.push(`<text x="${xOf(gesamtBreite / 2)}" y="${yDimTop - 3}"
      text-anchor="middle" font-size="7" fill="${FARBEN.masse}">${gesamtBreite.toFixed(2)} m</text>`);

    // Individual bay widths
    for (const feld of seitenPlan.felder) {
      const xMitte = xOf(feld.startX + feld.breite / 2);
      elemente.push(`<text x="${xMitte}" y="${outerY - 2}"
        text-anchor="middle" font-size="5" fill="${FARBEN.masse}">${feld.breite.toFixed(2)}</text>`);
    }

    // Wall clearance dimension on left
    const xDimLeft = xOf(0) - 18;
    elemente.push(`<line x1="${xDimLeft - 4}" y1="${wallY}" x2="${xDimLeft + 4}" y2="${wallY}"
      stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    elemente.push(`<line x1="${xDimLeft - 4}" y1="${innerY}" x2="${xDimLeft + 4}" y2="${innerY}"
      stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    elemente.push(`<line x1="${xDimLeft}" y1="${wallY}" x2="${xDimLeft}" y2="${innerY}"
      stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    elemente.push(`<text x="${xDimLeft - 6}" y="${(wallY + innerY) / 2}"
      text-anchor="middle" font-size="6" fill="${FARBEN.masse}"
      transform="rotate(-90,${xDimLeft - 6},${(wallY + innerY) / 2})">${wandabstand.toFixed(2)} m</text>`);

    // Scaffold width dimension (wall to outer face)
    elemente.push(`<line x1="${xDimLeft - 4}" y1="${outerY}" x2="${xDimLeft + 4}" y2="${outerY}"
      stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    elemente.push(`<line x1="${xDimLeft}" y1="${innerY}" x2="${xDimLeft}" y2="${outerY}"
      stroke="${FARBEN.masse}" stroke-width="0.8"/>`);
    elemente.push(`<text x="${xDimLeft - 6}" y="${(innerY + outerY) / 2}"
      text-anchor="middle" font-size="6" fill="${FARBEN.masse}"
      transform="rotate(-90,${xDimLeft - 6},${(innerY + outerY) / 2})">${RAHMEN_TIEFE.toFixed(2)} m</text>`);
  }

  // ── Labels ────────────────────────────────────────────────────────────────
  // Side label
  elemente.push(`<text x="${xOf(gesamtBreite / 2)}" y="${svgHoehe - 6}"
    text-anchor="middle" font-size="8" font-weight="bold" fill="#212121"
  >${escapeXml(seite.anzeigename)} – Draufsicht – Maßstab 1:50</text>`);

  // Compass/direction indicators
  elemente.push(`<text x="${xOf(0)}" y="${wallY + 12}"
    text-anchor="start" font-size="6" fill="#555">▼ Gebäude</text>`);
  elemente.push(`<text x="${xOf(0)}" y="${outerY - 14}"
    text-anchor="start" font-size="6" fill="#555">▲ Außengerüst</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgBreite} ${svgHoehe}" width="${svgBreite}mm" height="${svgHoehe}mm">
  <defs>
    <style>text { font-family: Arial, Helvetica, sans-serif; }</style>
  </defs>
  <rect width="100%" height="100%" fill="white"/>
  <g id="grundriss">${elemente.join('\n  ')}</g>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
