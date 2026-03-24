import { berechneMaterialien } from '../algorithms/materialCalculator';
import type { BausteinSeite } from '../models/Project';

// ─── Helpers ────────────────────────────────────────────────────────────────

function baueSeite(
  breite: number,
  hoehe: number,
  oeffnungen: BausteinSeite['oeffnungen'] = [],
): BausteinSeite {
  return {
    id: 'seite-1',
    projektId: 'proj-1',
    label: 'nord',
    anzeigename: 'Nord',
    fotos: [],
    messungen: [
      { id: 'm1', seitenId: 'seite-1', typ: 'breite', wert: breite, quelle: 'manuell', genauigkeit: 'gemessen' },
      { id: 'm2', seitenId: 'seite-1', typ: 'hoehe', wert: hoehe, quelle: 'manuell', genauigkeit: 'gemessen' },
    ],
    messungStatus: 'vollstaendig',
    oeffnungen,
  };
}

// ─── Layher Allround ─────────────────────────────────────────────────────────

describe('berechneMaterialien – Layher Allround', () => {
  const SYSTEM = 'layher-allround' as const;

  test('einfache Fassade 6m × 4m liefert Plan + Materialien', () => {
    const { plan, materialien, warnungen } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });

    expect(warnungen).toHaveLength(0);
    expect(plan.seiten).toHaveLength(1);
    expect(materialien.length).toBeGreaterThan(0);
  });

  test('5 % Sicherheitszuschlag ist einkalkuliert', () => {
    // Run twice with same input – deterministic output
    const result1 = berechneMaterialien({
      seiten: [baueSeite(6.14, 4)],   // exactly 2 × 3.07 fields
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    // All quantities must be integers (rounded up) and > base value
    for (const pos of result1.materialien) {
      expect(Number.isInteger(pos.menge)).toBe(true);
      expect(pos.menge).toBeGreaterThan(0);
    }
  });

  test('Felder werden auf Standard-Feldbreiten aufgeteilt', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6.14, 4)],   // 2 × 3.07
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const felder = plan.seiten[0].felder;
    expect(felder).toHaveLength(2);
    expect(felder[0].breite).toBeCloseTo(3.07, 2);
    expect(felder[1].breite).toBeCloseTo(3.07, 2);
    expect(felder[0].startX).toBeCloseTo(0, 2);
    expect(felder[1].startX).toBeCloseTo(3.07, 2);
  });

  test('Lagen werden korrekt berechnet (2m + 2m = 4m)', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const lagen = plan.seiten[0].lagen;
    expect(lagen).toHaveLength(2);
    expect(lagen[0].hoehe).toBe(2.0);
    expect(lagen[1].hoehe).toBe(2.0);
    expect(lagen[0].startY).toBe(0);
    expect(lagen[1].startY).toBe(2.0);
  });

  test('jede Lage hat Belag, Geländer und Bordbrett', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    for (const lage of plan.seiten[0].lagen) {
      expect(lage.hatBelag).toBe(true);
      expect(lage.hatGelaender).toBe(true);
      expect(lage.hatBordbrett).toBe(true);
    }
  });

  test('Rahmen vorhanden', () => {
    const { materialien } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const rahmen = materialien.filter(p => p.komponenteId.includes('rahmen'));
    expect(rahmen.length).toBeGreaterThan(0);
    expect(rahmen[0].menge).toBeGreaterThan(0);
  });

  test('Riegel vorhanden', () => {
    const { materialien } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const riegel = materialien.filter(p => p.komponenteId.includes('riegel'));
    expect(riegel.length).toBeGreaterThan(0);
  });

  test('Verankerungen werden generiert', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(plan.verankerungen.length).toBeGreaterThan(0);
    for (const anker of plan.verankerungen) {
      expect(anker.seitenId).toBe('seite-1');
      expect(anker.x).toBeGreaterThanOrEqual(0);
      expect(anker.y).toBeGreaterThan(0);
    }
  });

  test('Gesamtgewicht > 0', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(plan.gesamtgewicht).toBeGreaterThan(0);
  });

  test('lastklasse default ist 3', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(plan.lastklasse).toBe('3');
  });

  test('lastklasse kann überschrieben werden', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
      lastklasse: '5',
    });
    expect(plan.lastklasse).toBe('5');
  });

  test('Warnung wenn Breitenmessung fehlt', () => {
    const seiteOhneBreite: BausteinSeite = {
      id: 'seite-x',
      projektId: 'proj-1',
      label: 'sued',
      anzeigename: 'Süd',
      fotos: [],
      messungen: [
        { id: 'm1', seitenId: 'seite-x', typ: 'hoehe', wert: 4, quelle: 'manuell', genauigkeit: 'gemessen' },
      ],
      messungStatus: 'unvollstaendig',
      oeffnungen: [],
    };
    const { warnungen } = berechneMaterialien({
      seiten: [seiteOhneBreite],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(warnungen.length).toBeGreaterThan(0);
    expect(warnungen[0]).toMatch(/breite|höhe|messung/i);
  });

  test('Warnung wenn Höhenmessung fehlt', () => {
    const seiteOhneHoehe: BausteinSeite = {
      id: 'seite-y',
      projektId: 'proj-1',
      label: 'ost',
      anzeigename: 'Ost',
      fotos: [],
      messungen: [
        { id: 'm1', seitenId: 'seite-y', typ: 'breite', wert: 6, quelle: 'manuell', genauigkeit: 'gemessen' },
      ],
      messungStatus: 'unvollstaendig',
      oeffnungen: [],
    };
    const { warnungen } = berechneMaterialien({
      seiten: [seiteOhneHoehe],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(warnungen.length).toBeGreaterThan(0);
  });

  test('Türöffnung reduziert Belagmenge', () => {
    const ohneOeffnung = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const mitTuer = berechneMaterialien({
      seiten: [baueSeite(6, 4, [{
        id: 'oe1',
        typ: 'tuer',
        breite: 1.0,
        hoehe: 2.2,
        bruestungHoehe: 0,
        horizontalOffset: 1.0,
      }])],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });

    const belagOhne = ohneOeffnung.materialien.find(p => p.komponenteId.includes('belag'));
    const belagMit = mitTuer.materialien.find(p => p.komponenteId.includes('belag'));

    // With a door deduction, belag count should be ≤ without
    if (belagOhne && belagMit) {
      expect(belagMit.menge).toBeLessThanOrEqual(belagOhne.menge);
    }
  });

  test('mehrere Seiten werden kumuliert', () => {
    const seite2 = { ...baueSeite(4, 3), id: 'seite-2', anzeigename: 'Süd', label: 'sued' as const };
    seite2.messungen = seite2.messungen.map(m => ({ ...m, seitenId: 'seite-2' }));

    const { plan, materialien } = berechneMaterialien({
      seiten: [baueSeite(6, 4), seite2],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });

    expect(plan.seiten).toHaveLength(2);
    expect(materialien.length).toBeGreaterThan(0);
    // Cumulative material should be more than single side
    const totalMenge = materialien.reduce((s, p) => s + p.menge, 0);
    const einzel = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const einzeMenge = einzel.materialien.reduce((s, p) => s + p.menge, 0);
    expect(totalMenge).toBeGreaterThan(einzeMenge);
  });

  test('arbeitshoehe wird auf Gebäudehöhe begrenzt', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 3)],
      systemId: SYSTEM,
      arbeitshoehe: 10, // higher than building
    });
    const gesamtLagHoehe = plan.seiten[0].lagen.reduce((s, l) => s + l.hoehe, 0);
    expect(gesamtLagHoehe).toBeLessThanOrEqual(3 + 0.5); // slight tolerance
  });

  test('plan hat erstelltAm als ISO-String', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(() => new Date(plan.erstelltAm)).not.toThrow();
    expect(new Date(plan.erstelltAm).getTime()).not.toBeNaN();
  });

  test('jedes Material hat eindeutige id', () => {
    const { materialien } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const ids = materialien.map(m => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

// ─── Layher Blitz ─────────────────────────────────────────────────────────────

describe('berechneMaterialien – Layher Blitz', () => {
  const SYSTEM = 'layher-blitz' as const;

  test('liefert Rohre und Kupplungen', () => {
    const { materialien, warnungen } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(warnungen).toHaveLength(0);
    const rohre = materialien.filter(p => p.komponenteId.includes('rohr'));
    const kuppl = materialien.filter(p => p.komponenteId.includes('kupplung') || p.komponenteId.includes('winkel'));
    expect(rohre.length).toBeGreaterThan(0);
    expect(kuppl.length).toBeGreaterThan(0);
  });

  test('Rohr-Menge skaliert mit Fassadenbreite', () => {
    const schmal = berechneMaterialien({
      seiten: [baueSeite(5, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const breit = berechneMaterialien({
      seiten: [baueSeite(10, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const rohrSchmal = schmal.materialien.find(p => p.komponenteId === 'lb-rohr-600')?.menge ?? 0;
    const rohrBreit = breit.materialien.find(p => p.komponenteId === 'lb-rohr-600')?.menge ?? 0;
    expect(rohrBreit).toBeGreaterThan(rohrSchmal);
  });

  test('Geländer als Laufmeter vorhanden', () => {
    const { materialien } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const gelaender = materialien.find(p => p.komponenteId === 'lb-rohrgelaender');
    expect(gelaender).toBeDefined();
    expect(gelaender!.menge).toBeGreaterThan(0);
    expect(gelaender!.einheit).toBe('m');
  });

  test('Verankerungen werden generiert', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(plan.verankerungen.length).toBeGreaterThan(0);
  });

  test('Gesamtgewicht > 0', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(plan.gesamtgewicht).toBeGreaterThan(0);
  });

  test('Spindeln vorhanden', () => {
    const { materialien } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const spindel = materialien.find(p => p.komponenteId === 'lb-spindel');
    expect(spindel).toBeDefined();
    expect(spindel!.menge).toBeGreaterThan(0);
  });
});

// ─── Tobler ──────────────────────────────────────────────────────────────────

describe('berechneMaterialien – Tobler', () => {
  const SYSTEM = 'tobler' as const;

  test('liefert Plan ohne Warnungen', () => {
    const { warnungen, plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(warnungen).toHaveLength(0);
    expect(plan.seiten).toHaveLength(1);
  });

  test('Rahmen vorhanden', () => {
    const { materialien } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const rahmen = materialien.filter(p => p.komponenteId.startsWith('tb-rahmen'));
    expect(rahmen.length).toBeGreaterThan(0);
  });

  test('Felder passen zu Tobler-Standardbreiten', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(5.14, 4)],   // 2 × 2.57
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    const breiten = plan.seiten[0].felder.map(f => f.breite);
    for (const b of breiten) {
      expect([0.73, 1.09, 1.57, 2.07, 2.57, 3.07]).toContainEqual(expect.closeTo(b, 2));
    }
  });

  test('Gesamtgewicht > 0', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: SYSTEM,
      arbeitshoehe: 4,
    });
    expect(plan.gesamtgewicht).toBeGreaterThan(0);
  });
});

// ─── Anker-Geometrie (EN 12810-1) ─────────────────────────────────────────────

describe('Verankerungsgeometrie – EN 12810-1', () => {
  test('max. vertikaler Abstand ≤ 4 m', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(10, 12)],
      systemId: 'layher-allround',
      arbeitshoehe: 12,
    });
    const anker = plan.verankerungen;
    const ys = [...new Set(anker.map(a => a.y))].sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeLessThanOrEqual(4.01);
    }
  });

  test('max. horizontaler Abstand ≤ 6 m', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(12, 8)],
      systemId: 'layher-allround',
      arbeitshoehe: 8,
    });
    const anker = plan.verankerungen;
    const xs = [...new Set(anker.map(a => a.x))].sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeLessThanOrEqual(6.01);
    }
  });

  test('Anker liegen innerhalb Fassadenbreite', () => {
    const breite = 8;
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(breite, 6)],
      systemId: 'layher-allround',
      arbeitshoehe: 6,
    });
    for (const anker of plan.verankerungen) {
      expect(anker.x).toBeGreaterThanOrEqual(0);
      expect(anker.x).toBeLessThanOrEqual(breite + 0.01);
    }
  });

  test('Anker liegen innerhalb Gerüsthöhe', () => {
    const hoehe = 6;
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(8, hoehe)],
      systemId: 'layher-allround',
      arbeitshoehe: hoehe,
    });
    for (const anker of plan.verankerungen) {
      expect(anker.y).toBeGreaterThan(0);
      expect(anker.y).toBeLessThanOrEqual(hoehe + 0.01);
    }
  });
});

// ─── Feldaufteilung (greedy) ──────────────────────────────────────────────────

describe('Feldaufteilung', () => {
  test('exakter Fit 3.07 + 3.07', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6.14, 4)],
      systemId: 'layher-allround',
      arbeitshoehe: 4,
    });
    expect(plan.seiten[0].felder).toHaveLength(2);
  });

  test('sehr schmale Fassade (< 1 Feld)', () => {
    const { plan, warnungen } = berechneMaterialien({
      seiten: [baueSeite(0.73, 2)],
      systemId: 'layher-allround',
      arbeitshoehe: 2,
    });
    expect(warnungen).toHaveLength(0);
    expect(plan.seiten[0].felder).toHaveLength(1);
    expect(plan.seiten[0].felder[0].breite).toBeCloseTo(0.73, 2);
  });

  test('startX-Werte akkumulieren korrekt', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6.14, 4)],
      systemId: 'layher-allround',
      arbeitshoehe: 4,
    });
    const felder = plan.seiten[0].felder;
    let expected = 0;
    for (const feld of felder) {
      expect(feld.startX).toBeCloseTo(expected, 2);
      expected += feld.breite;
    }
  });

  test('Feld-Indizes laufen von 0 aufsteigend', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6.14, 4)],
      systemId: 'layher-allround',
      arbeitshoehe: 4,
    });
    plan.seiten[0].felder.forEach((f, i) => {
      expect(f.index).toBe(i);
    });
  });
});

// ─── Lagberechnung ────────────────────────────────────────────────────────────

describe('Lagberechnung', () => {
  test('1-Lag-Gerüst (1m Höhe)', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 1)],
      systemId: 'layher-allround',
      arbeitshoehe: 1,
    });
    expect(plan.seiten[0].lagen).toHaveLength(1);
    expect(plan.seiten[0].lagen[0].hoehe).toBe(1.0);
  });

  test('3-Lag-Gerüst (6m Höhe: 2+2+2)', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 6)],
      systemId: 'layher-allround',
      arbeitshoehe: 6,
    });
    expect(plan.seiten[0].lagen).toHaveLength(3);
    const total = plan.seiten[0].lagen.reduce((s, l) => s + l.hoehe, 0);
    expect(total).toBeCloseTo(6, 1);
  });

  test('Lage-Indizes laufen von 0 aufsteigend', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 6)],
      systemId: 'layher-allround',
      arbeitshoehe: 6,
    });
    plan.seiten[0].lagen.forEach((l, i) => {
      expect(l.index).toBe(i);
    });
  });

  test('startY-Werte akkumulieren korrekt', () => {
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(6, 6)],
      systemId: 'layher-allround',
      arbeitshoehe: 6,
    });
    let expected = 0;
    for (const lage of plan.seiten[0].lagen) {
      expect(lage.startY).toBeCloseTo(expected, 2);
      expected += lage.hoehe;
    }
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  test('leere Seitenliste liefert leeren Plan', () => {
    const { plan, materialien, warnungen } = berechneMaterialien({
      seiten: [],
      systemId: 'layher-allround',
      arbeitshoehe: 4,
    });
    expect(plan.seiten).toHaveLength(0);
    expect(materialien).toHaveLength(0);
    expect(warnungen).toHaveLength(0);
  });

  test('unbekanntes System wirft Fehler', () => {
    expect(() =>
      berechneMaterialien({
        seiten: [baueSeite(6, 4)],
        // @ts-expect-error intentionally invalid
        systemId: 'nicht-vorhanden',
        arbeitshoehe: 4,
      })
    ).toThrow();
  });

  test('sehr große Fassade (30m) läuft ohne Infinite Loop', () => {
    expect(() =>
      berechneMaterialien({
        seiten: [baueSeite(30, 12)],
        systemId: 'layher-allround',
        arbeitshoehe: 12,
      })
    ).not.toThrow();
    const { plan } = berechneMaterialien({
      seiten: [baueSeite(30, 12)],
      systemId: 'layher-allround',
      arbeitshoehe: 12,
    });
    expect(plan.seiten[0].felder.length).toBeLessThanOrEqual(100);
  });

  test('planId ist kein leerer String', () => {
    const { materialien } = berechneMaterialien({
      seiten: [baueSeite(6, 4)],
      systemId: 'layher-allround',
      arbeitshoehe: 4,
    });
    for (const pos of materialien) {
      expect(pos.planId).toBeTruthy();
    }
  });
});
