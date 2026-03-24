import { generiereSeitenElevationSVG } from '../algorithms/planGenerator';
import type { SeitenPlan, GeruestPlan, BausteinSeite } from '../models/Project';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeSeite(id = 'seite-1', breite = 6, hoehe = 4): BausteinSeite {
  return {
    id,
    projektId: 'proj-1',
    label: 'nord',
    anzeigename: 'Nord',
    fotos: [],
    messungen: [],
    messungStatus: 'vollstaendig',
    oeffnungen: [],
  };
}

function makeSeitenPlan(
  seitenId = 'seite-1',
  felder = [{ index: 0, breite: 3.07, startX: 0 }, { index: 1, breite: 3.07, startX: 3.07 }],
  lagen = [
    { index: 0, hoehe: 2.0, startY: 0, hatBelag: true, hatGelaender: true, hatBordbrett: true },
    { index: 1, hoehe: 2.0, startY: 2.0, hatBelag: true, hatGelaender: true, hatBordbrett: true },
  ],
): SeitenPlan {
  return { seitenId, felder, lagen, oberesGelaender: true };
}

function makePlan(seitenId = 'seite-1'): GeruestPlan {
  return {
    id: 'plan-1',
    projektId: 'proj-1',
    erstelltAm: new Date().toISOString(),
    systemId: 'layher-allround',
    seiten: [makeSeitenPlan(seitenId)],
    verankerungen: [
      { seitenId, x: 0, y: 4, typ: 'flex-anker' },
      { seitenId, x: 6, y: 4, typ: 'flex-anker' },
    ],
    gesamtgewicht: 2000,
    lastklasse: '3',
  };
}

// ─── Grundstruktur ───────────────────────────────────────────────────────────

describe('generiereSeitenElevationSVG – Grundstruktur', () => {
  test('gibt einen nicht-leeren String zurück', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(0);
  });

  test('beginnt mit <svg-Tag', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg.trim()).toMatch(/^<svg /);
  });

  test('endet mit </svg>', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg.trim()).toMatch(/<\/svg>$/);
  });

  test('enthält xmlns-Attribut', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('enthält viewBox-Attribut', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg).toContain('viewBox=');
  });

  test('viewBox hat 4 numerische Werte', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan());
    const match = svg.match(/viewBox="([^"]+)"/);
    expect(match).not.toBeNull();
    const parts = match![1].split(/\s+/);
    expect(parts).toHaveLength(4);
    for (const p of parts) {
      expect(Number.isFinite(parseFloat(p))).toBe(true);
    }
  });
});

// ─── Inhalt ──────────────────────────────────────────────────────────────────

describe('generiereSeitenElevationSVG – Inhalt', () => {
  test('enthält Seitenname im Titel', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg).toContain('Nord');
  });

  test('enthält Maßstab 1:50', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg).toContain('1:50');
  });

  test('enthält Rahmen-Linien (showRahmen=true)', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showRahmen: true });
    expect(svg).toContain('<line');
  });

  test('showRahmen=false reduziert Linienanzahl', () => {
    const mitRahmen = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showRahmen: true });
    const ohneRahmen = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showRahmen: false });
    const zaehleLinien = (s: string) => (s.match(/<line/g) ?? []).length;
    expect(zaehleLinien(mitRahmen)).toBeGreaterThan(zaehleLinien(ohneRahmen));
  });

  test('showBelag=true fügt Rechtecke ein', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showBelag: true });
    expect(svg).toContain('<rect');
  });

  test('showAnker=true fügt Kreise ein', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showAnker: true });
    expect(svg).toContain('<circle');
  });

  test('showAnker=false enthält keine Kreise', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showAnker: false });
    expect(svg).not.toContain('<circle');
  });

  test('showMasse=true enthält Bemaßungstext', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showMasse: true });
    expect(svg).toContain('<text');
    // should show the total width in meters
    expect(svg).toMatch(/\d+\.\d+ m/);
  });

  test('showMasse=false enthält keine Bemaßungslinien', () => {
    const mit = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showMasse: true });
    const ohne = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showMasse: false });
    // without dimensions there should be fewer text elements
    const zaehleText = (s: string) => (s.match(/<text/g) ?? []).length;
    expect(zaehleText(mit)).toBeGreaterThan(zaehleText(ohne));
  });

  test('Öffnungen erzeugen weiße Rechtecke', () => {
    const seite = makeSeite();
    seite.oeffnungen = [{
      id: 'oe1',
      typ: 'fenster',
      breite: 1.0,
      hoehe: 1.2,
      bruestungHoehe: 1.0,
      horizontalOffset: 1.0,
    }];
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), seite, makePlan());
    expect(svg).toContain('#FFFFFF');
  });

  test('Geländer-Linien vorhanden wenn showGelaender=true', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), {
      showGelaender: true,
      showRahmen: false,
      showBelag: false,
      showAnker: false,
      showMasse: false,
    });
    // Guardrail color is #F57F17
    expect(svg).toContain('#F57F17');
  });

  test('Bordbrett-Farbe vorhanden', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showGelaender: true });
    expect(svg).toContain('#E65100');
  });
});

// ─── Anker nur für eigene Seite ───────────────────────────────────────────────

describe('generiereSeitenElevationSVG – Anker-Filterung', () => {
  test('zeigt nur Anker der eigenen Seite', () => {
    const plan = makePlan('seite-1');
    plan.verankerungen = [
      { seitenId: 'seite-1', x: 0, y: 4, typ: 'flex-anker' },
      { seitenId: 'seite-2', x: 0, y: 4, typ: 'flex-anker' },
    ];
    const svg = generiereSeitenElevationSVG(makeSeitenPlan('seite-1'), makeSeite('seite-1'), plan, { showAnker: true });
    // Only 1 anchor (for seite-1), not 2
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBe(1);
  });
});

// ─── SVG-Dimensionen skalieren mit Geometrie ─────────────────────────────────

describe('generiereSeitenElevationSVG – Skalierung', () => {
  test('breitere Fassade → größere SVG-Breite', () => {
    const schmal = generiereSeitenElevationSVG(
      makeSeitenPlan('s', [{ index: 0, breite: 3.07, startX: 0 }]),
      makeSeite(),
      makePlan(),
    );
    const breit = generiereSeitenElevationSVG(
      makeSeitenPlan('s', [
        { index: 0, breite: 3.07, startX: 0 },
        { index: 1, breite: 3.07, startX: 3.07 },
        { index: 2, breite: 3.07, startX: 6.14 },
      ]),
      makeSeite(),
      makePlan(),
    );

    const extrahiereBreite = (svg: string): number => {
      const m = svg.match(/width="([\d.]+)mm"/);
      return m ? parseFloat(m[1]) : 0;
    };

    expect(extrahiereBreite(breit)).toBeGreaterThan(extrahiereBreite(schmal));
  });

  test('höheres Gerüst → größere SVG-Höhe', () => {
    const niedrig = generiereSeitenElevationSVG(
      makeSeitenPlan('s', undefined, [
        { index: 0, hoehe: 2.0, startY: 0, hatBelag: true, hatGelaender: true, hatBordbrett: true },
      ]),
      makeSeite(),
      makePlan(),
    );
    const hoch = generiereSeitenElevationSVG(
      makeSeitenPlan('s', undefined, [
        { index: 0, hoehe: 2.0, startY: 0, hatBelag: true, hatGelaender: true, hatBordbrett: true },
        { index: 1, hoehe: 2.0, startY: 2.0, hatBelag: true, hatGelaender: true, hatBordbrett: true },
        { index: 2, hoehe: 2.0, startY: 4.0, hatBelag: true, hatGelaender: true, hatBordbrett: true },
      ]),
      makeSeite(),
      makePlan(),
    );

    const extrahiereHoehe = (svg: string): number => {
      const m = svg.match(/height="([\d.]+)mm"/);
      return m ? parseFloat(m[1]) : 0;
    };

    expect(extrahiereHoehe(hoch)).toBeGreaterThan(extrahiereHoehe(niedrig));
  });
});

// ─── Robustheit ───────────────────────────────────────────────────────────────

describe('generiereSeitenElevationSVG – Robustheit', () => {
  test('leere Felder und Lagen wirft keinen Fehler', () => {
    expect(() =>
      generiereSeitenElevationSVG(
        makeSeitenPlan('s', [], []),
        makeSeite(),
        makePlan(),
      )
    ).not.toThrow();
  });

  test('keine Verankerungen wirft keinen Fehler', () => {
    const plan = makePlan();
    plan.verankerungen = [];
    expect(() =>
      generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), plan, { showAnker: true })
    ).not.toThrow();
  });

  test('alle Optionen false – gibt trotzdem gültiges SVG zurück', () => {
    const svg = generiereSeitenElevationSVG(makeSeitenPlan(), makeSeite(), makePlan(), {
      showRahmen: false,
      showBelag: false,
      showGelaender: false,
      showAnker: false,
      showMasse: false,
    });
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
  });
});
