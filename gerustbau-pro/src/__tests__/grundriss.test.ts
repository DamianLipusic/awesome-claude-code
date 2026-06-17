import { generiereGrundrissSSVG } from '../algorithms/planGenerator';
import type { SeitenPlan, GeruestPlan, BausteinSeite } from '../models/Project';

// ─── Fixtures (same helpers as planGenerator.test) ───────────────────────────

function makeSeite(id = 'seite-1', oeffnungen: BausteinSeite['oeffnungen'] = []): BausteinSeite {
  return {
    id,
    projektId: 'proj-1',
    label: 'nord',
    anzeigename: 'Nord',
    fotos: [],
    messungen: [],
    messungStatus: 'vollstaendig',
    oeffnungen,
  };
}

function makeSeitenPlan(
  seitenId = 'seite-1',
  felder = [
    { index: 0, breite: 3.07, startX: 0 },
    { index: 1, breite: 3.07, startX: 3.07 },
  ],
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
      { seitenId, x: 3.07, y: 4, typ: 'flex-anker' },
      { seitenId, x: 6.14, y: 4, typ: 'flex-anker' },
    ],
    gesamtgewicht: 2000,
    lastklasse: '3',
  };
}

// ─── Grundstruktur ───────────────────────────────────────────────────────────

describe('generiereGrundrissSSVG – Grundstruktur', () => {
  test('gibt einen String zurück', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(typeof svg).toBe('string');
    expect(svg.length).toBeGreaterThan(0);
  });

  test('beginnt mit <svg', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg.trim()).toMatch(/^<svg /);
  });

  test('endet mit </svg>', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg.trim()).toMatch(/<\/svg>$/);
  });

  test('enthält xmlns', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  test('enthält viewBox mit 4 Werten', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan());
    const m = svg.match(/viewBox="([^"]+)"/);
    expect(m).not.toBeNull();
    const parts = m![1].split(/\s+/);
    expect(parts).toHaveLength(4);
    for (const p of parts) {
      expect(Number.isFinite(parseFloat(p))).toBe(true);
    }
  });

  test('enthält Maßstab 1:50', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg).toContain('1:50');
  });

  test('enthält Seitenname', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan());
    expect(svg).toContain('Nord');
  });
});

// ─── Ebenen-Toggles ──────────────────────────────────────────────────────────

describe('generiereGrundrissSSVG – Ebenen', () => {
  test('showBelag=true erzeugt farbige Rechtecke', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showBelag: true });
    // Belag shading uses light-blue fills
    expect(svg).toContain('#B3E5FC');
  });

  test('showBelag=false enthält keine Belag-Farben', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showBelag: false });
    expect(svg).not.toContain('#B3E5FC');
    expect(svg).not.toContain('#81D4FA');
  });

  test('showAnker=true erzeugt Kreise', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showAnker: true });
    expect(svg).toContain('<circle');
  });

  test('showAnker=false enthält keine Kreise', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showAnker: false });
    expect(svg).not.toContain('<circle');
  });

  test('showDiagonalen=true enthält Diagonalen-Farbe', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showDiagonalen: true });
    expect(svg).toContain('#42A5F5');
  });

  test('showDiagonalen=false enthält keine Diagonalen', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showDiagonalen: false });
    expect(svg).not.toContain('#42A5F5');
  });

  test('showMasse=true enthält Bemaßungstext mit m-Einheit', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showMasse: true });
    expect(svg).toMatch(/\d+\.\d+ m/);
  });

  test('showMasse=false enthält weniger Textelemente', () => {
    const mit = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showMasse: true });
    const ohne = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showMasse: false });
    const zaehleText = (s: string) => (s.match(/<text/g) ?? []).length;
    expect(zaehleText(mit)).toBeGreaterThan(zaehleText(ohne));
  });

  test('showStaender=true enthält Standard-Post-Rechtecke', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { showStaender: true });
    // Posts use the rahmen color
    expect(svg).toContain('#1565C0');
  });
});

// ─── Wandabstand ─────────────────────────────────────────────────────────────

describe('generiereGrundrissSSVG – Wandabstand', () => {
  test('standard 0.25m ist sichtbar im Bemaßungstext', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), {
      wandabstand: 0.25,
      showMasse: true,
    });
    expect(svg).toContain('0.25');
  });

  test('benutzerdefinierter Wandabstand 0.40m ist sichtbar', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), {
      wandabstand: 0.40,
      showMasse: true,
    });
    expect(svg).toContain('0.40');
  });

  test('größerer Wandabstand → höheres SVG', () => {
    const svgKlein = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { wandabstand: 0.25 });
    const svgGross = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), { wandabstand: 0.80 });
    const extractH = (s: string) => {
      const m = s.match(/height="([\d.]+)mm"/);
      return m ? parseFloat(m[1]) : 0;
    };
    expect(extractH(svgGross)).toBeGreaterThan(extractH(svgKlein));
  });
});

// ─── Skalierung ───────────────────────────────────────────────────────────────

describe('generiereGrundrissSSVG – Skalierung', () => {
  test('breitere Fassade → breiteres SVG', () => {
    const schmal = generiereGrundrissSSVG(
      makeSeitenPlan('s', [{ index: 0, breite: 3.07, startX: 0 }]),
      makeSeite(), makePlan(),
    );
    const breit = generiereGrundrissSSVG(
      makeSeitenPlan('s', [
        { index: 0, breite: 3.07, startX: 0 },
        { index: 1, breite: 3.07, startX: 3.07 },
        { index: 2, breite: 3.07, startX: 6.14 },
      ]),
      makeSeite(), makePlan(),
    );
    const extractW = (s: string) => {
      const m = s.match(/width="([\d.]+)mm"/);
      return m ? parseFloat(m[1]) : 0;
    };
    expect(extractW(breit)).toBeGreaterThan(extractW(schmal));
  });
});

// ─── Anker-Filterung ──────────────────────────────────────────────────────────

describe('generiereGrundrissSSVG – Anker-Filterung', () => {
  test('zeigt nur Anker der eigenen Seite', () => {
    const plan = makePlan('seite-1');
    plan.verankerungen = [
      { seitenId: 'seite-1', x: 0, y: 4, typ: 'flex-anker' },
      { seitenId: 'seite-1', x: 6, y: 4, typ: 'flex-anker' },
      { seitenId: 'seite-2', x: 0, y: 4, typ: 'flex-anker' },
    ];
    const svg = generiereGrundrissSSVG(makeSeitenPlan('seite-1'), makeSeite('seite-1'), plan, { showAnker: true });
    const circles = svg.match(/<circle/g) ?? [];
    expect(circles.length).toBe(2); // only seite-1 anchors
  });
});

// ─── Öffnungen ────────────────────────────────────────────────────────────────

describe('generiereGrundrissSSVG – Öffnungen', () => {
  test('Öffnung wird an der Wandlinie eingetragen', () => {
    const seite = makeSeite('seite-1', [{
      id: 'oe1',
      typ: 'fenster',
      breite: 1.0,
      hoehe: 1.2,
      bruestungHoehe: 1.0,
      horizontalOffset: 1.0,
    }]);
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), seite, makePlan(), {});
    expect(svg).toContain('fenster');
  });

  test('keine Öffnungen → kein Öffnungstext', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), {});
    expect(svg).not.toContain('fenster');
    expect(svg).not.toContain('tuer');
  });
});

// ─── Robustheit ───────────────────────────────────────────────────────────────

describe('generiereGrundrissSSVG – Robustheit', () => {
  test('leere Felder wirft keinen Fehler', () => {
    expect(() =>
      generiereGrundrissSSVG(makeSeitenPlan('s', []), makeSeite(), makePlan())
    ).not.toThrow();
  });

  test('keine Verankerungen wirft keinen Fehler', () => {
    const plan = makePlan();
    plan.verankerungen = [];
    expect(() =>
      generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), plan, { showAnker: true })
    ).not.toThrow();
  });

  test('alle Optionen false ergibt gültiges SVG', () => {
    const svg = generiereGrundrissSSVG(makeSeitenPlan(), makeSeite(), makePlan(), {
      showStaender: false,
      showBelag: false,
      showAnker: false,
      showDiagonalen: false,
      showMasse: false,
    });
    expect(svg).toMatch(/^<svg /);
    expect(svg).toMatch(/<\/svg>$/);
  });

  test('einzelnes Feld funktioniert', () => {
    const svg = generiereGrundrissSSVG(
      makeSeitenPlan('s', [{ index: 0, breite: 2.07, startX: 0 }]),
      makeSeite(), makePlan(), {},
    );
    expect(svg).toMatch(/^<svg /);
  });
});
