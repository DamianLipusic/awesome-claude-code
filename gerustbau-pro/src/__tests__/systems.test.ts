import { ALLE_SYSTEME, getSystem } from '../data/systems';
import type { GeruestSystem, GeruestKomponente, KomponentenKategorie } from '../data/systems';
import type { ScaffoldSystemId } from '../models/Project';

// ─── getSystem ────────────────────────────────────────────────────────────────

describe('getSystem', () => {
  test('gibt Layher Allround zurück', () => {
    const s = getSystem('layher-allround');
    expect(s.id).toBe('layher-allround');
  });

  test('gibt Layher Blitz zurück', () => {
    const s = getSystem('layher-blitz');
    expect(s.id).toBe('layher-blitz');
  });

  test('gibt Tobler zurück', () => {
    const s = getSystem('tobler');
    expect(s.id).toBe('tobler');
  });

  test('wirft Fehler für unbekanntes System', () => {
    expect(() => getSystem('nicht-vorhanden' as ScaffoldSystemId)).toThrow();
  });

  test('Fehlermeldung enthält System-ID', () => {
    expect(() => getSystem('xyz' as ScaffoldSystemId)).toThrow(/xyz/i);
  });
});

// ─── ALLE_SYSTEME ─────────────────────────────────────────────────────────────

describe('ALLE_SYSTEME', () => {
  test('enthält genau 3 Systeme', () => {
    expect(ALLE_SYSTEME).toHaveLength(3);
  });

  test('alle Systeme haben eine eindeutige ID', () => {
    const ids = ALLE_SYSTEME.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('jedes System hat name und hersteller', () => {
    for (const s of ALLE_SYSTEME) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.hersteller.length).toBeGreaterThan(0);
    }
  });
});

// ─── System-Datenintegrität ──────────────────────────────────────────────────

describe.each(ALLE_SYSTEME)('System $id – Datenintegrität', (system: GeruestSystem) => {
  test('standardFeldBreiten ist nicht leer', () => {
    expect(system.standardFeldBreiten.length).toBeGreaterThan(0);
  });

  test('standardLagHoehen ist nicht leer', () => {
    expect(system.standardLagHoehen.length).toBeGreaterThan(0);
  });

  test('alle standardFeldBreiten sind > 0', () => {
    for (const b of system.standardFeldBreiten) {
      expect(b).toBeGreaterThan(0);
    }
  });

  test('alle standardLagHoehen sind > 0', () => {
    for (const h of system.standardLagHoehen) {
      expect(h).toBeGreaterThan(0);
    }
  });

  test('hat mindestens 5 Komponenten', () => {
    expect(system.komponenten.length).toBeGreaterThanOrEqual(5);
  });

  test('alle Komponenten haben eindeutige IDs', () => {
    const ids = system.komponenten.map(k => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('alle Komponenten haben name, gewicht >= 0 und einheit', () => {
    for (const k of system.komponenten) {
      expect(k.name.length).toBeGreaterThan(0);
      expect(k.gewicht).toBeGreaterThanOrEqual(0);
      expect(['stk', 'm', 'kg']).toContain(k.einheit);
    }
  });

  test('alle Komponenten gehören zum richtigen systemId', () => {
    for (const k of system.komponenten) {
      expect(k.systemId).toBe(system.id);
    }
  });

  test('hat mind. eine Verankerungs-Komponente (anker)', () => {
    const anker = system.komponenten.filter(k => k.kategorie === 'anker');
    expect(anker.length).toBeGreaterThan(0);
  });

  test('hat mind. eine Belag-Komponente', () => {
    const belag = system.komponenten.filter(k => k.kategorie === 'belag');
    expect(belag.length).toBeGreaterThan(0);
  });

  test('hat mind. eine Spindel-Komponente', () => {
    const spindeln = system.komponenten.filter(k => k.kategorie === 'spindel');
    expect(spindeln.length).toBeGreaterThan(0);
  });

  test('Pflicht-Messungsanforderungen vorhanden (breite + hoehe)', () => {
    const pflichtTypen = system.messungsAnforderungen
      .filter(a => a.pflicht)
      .map(a => a.typ);
    expect(pflichtTypen).toContain('breite');
    expect(pflichtTypen).toContain('hoehe');
  });

  test('alle Messungsanforderungen haben bezeichnung und beschreibung', () => {
    for (const a of system.messungsAnforderungen) {
      expect(a.bezeichnung.length).toBeGreaterThan(0);
      expect(a.beschreibung.length).toBeGreaterThan(0);
    }
  });
});

// ─── Layher Allround – spezifische Checks ────────────────────────────────────

describe('Layher Allround – Vollständigkeit', () => {
  const system = getSystem('layher-allround');

  test('hat Rahmen für alle standardLagHoehen', () => {
    for (const h of system.standardLagHoehen) {
      const rahmen = system.komponenten.find(
        k => k.kategorie === 'rahmen' && k.standardLagHoehen?.some(lh => Math.abs(lh - h) < 0.01),
      );
      expect(rahmen).toBeDefined();
    }
  });

  test('hat Riegel für alle standardFeldBreiten', () => {
    for (const b of system.standardFeldBreiten) {
      const riegel = system.komponenten.find(
        k => k.kategorie === 'riegel' && k.standardFeldBreiten?.some(fb => Math.abs(fb - b) < 0.01),
      );
      expect(riegel).toBeDefined();
    }
  });

  test('hat Diagonale', () => {
    const diag = system.komponenten.filter(k => k.kategorie === 'diagonale');
    expect(diag.length).toBeGreaterThan(0);
  });

  test('hat Fußplatte', () => {
    const fp = system.komponenten.filter(k => k.kategorie === 'fussplatte');
    expect(fp.length).toBeGreaterThan(0);
  });
});

// ─── Layher Blitz – spezifische Checks ───────────────────────────────────────

describe('Layher Blitz – Vollständigkeit', () => {
  const system = getSystem('layher-blitz');

  test('hat Rohre', () => {
    const rohre = system.komponenten.filter(k => k.kategorie === 'rohr');
    expect(rohre.length).toBeGreaterThan(0);
  });

  test('hat Kupplungen', () => {
    const kuppl = system.komponenten.filter(k => k.kategorie === 'kupplung');
    expect(kuppl.length).toBeGreaterThan(0);
  });

  test('lb-rohr-600 vorhanden', () => {
    expect(system.komponenten.find(k => k.id === 'lb-rohr-600')).toBeDefined();
  });

  test('lb-winkelkupplung vorhanden', () => {
    expect(system.komponenten.find(k => k.id === 'lb-winkelkupplung')).toBeDefined();
  });

  test('Geländer hat Einheit m', () => {
    const gelaender = system.komponenten.find(k => k.kategorie === 'gelaender');
    expect(gelaender?.einheit).toBe('m');
  });

  test('Bordbrett hat Einheit m', () => {
    const bordbrett = system.komponenten.find(k => k.kategorie === 'bordbrett');
    expect(bordbrett?.einheit).toBe('m');
  });
});

// ─── Tobler – spezifische Checks ─────────────────────────────────────────────

describe('Tobler – Vollständigkeit', () => {
  const system = getSystem('tobler');

  test('hat Rahmen', () => {
    const rahmen = system.komponenten.filter(k => k.kategorie === 'rahmen');
    expect(rahmen.length).toBeGreaterThan(0);
  });

  test('hat Riegel für alle standardFeldBreiten', () => {
    for (const b of system.standardFeldBreiten) {
      const riegel = system.komponenten.find(
        k => k.kategorie === 'riegel' && k.standardFeldBreiten?.some(fb => Math.abs(fb - b) < 0.01),
      );
      expect(riegel).toBeDefined();
    }
  });

  test('hat Alu-Belag', () => {
    const alu = system.komponenten.filter(k => k.kategorie === 'belag' && k.id.includes('alu'));
    expect(alu.length).toBeGreaterThan(0);
  });
});

// ─── Kategorien-Konsistenz ────────────────────────────────────────────────────

const GUELTIGE_KATEGORIEN: KomponentenKategorie[] = [
  'rahmen', 'riegel', 'diagonale', 'belag', 'gelaender', 'bordbrett',
  'fussplatte', 'spindel', 'anker', 'treppe', 'rohr', 'kupplung', 'sonstiges',
];

describe('Kategorien-Konsistenz', () => {
  test('alle Komponenten haben eine gültige Kategorie', () => {
    for (const system of ALLE_SYSTEME) {
      for (const k of system.komponenten) {
        expect(GUELTIGE_KATEGORIEN).toContain(k.kategorie);
      }
    }
  });
});
