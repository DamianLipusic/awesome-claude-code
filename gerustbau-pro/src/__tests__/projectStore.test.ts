// Mock expo notifications (native module) before importing the store
jest.mock('../utils/notifications', () => ({
  scheduleTerminNotifications: jest.fn().mockResolvedValue(undefined),
  cancelTerminNotifications: jest.fn().mockResolvedValue(undefined),
}));

import { useProjektStore } from '../store/projectStore';
import type { GeruestPlan, MaterialPosition } from '../models/Project';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getState() {
  return useProjektStore.getState();
}

function erstelleTestProjekt(name = 'Testprojekt') {
  return getState().erstelleProjekt({
    name,
    systemId: 'layher-allround',
    zweck: 'fassade',
    gesamthoehe: 8,
    etagen: 2,
    arbeitshoehe: 8,
  });
}

beforeEach(() => {
  // Reset store state between tests
  useProjektStore.setState({ projekte: [], aktiverPlan: null, aktiveMaterialien: [] });
});

// ─── erstelleProjekt ──────────────────────────────────────────────────────────

describe('erstelleProjekt', () => {
  test('gibt eine ID zurück', () => {
    const id = erstelleTestProjekt();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('projekt wird in Liste gespeichert', () => {
    const id = erstelleTestProjekt();
    expect(getState().projekte).toHaveLength(1);
    expect(getState().projekte[0].id).toBe(id);
  });

  test('neue Projekte haben Status "entwurf"', () => {
    erstelleTestProjekt();
    expect(getState().projekte[0].status).toBe('entwurf');
  });

  test('Pflichtfelder werden übernommen', () => {
    erstelleTestProjekt('Mein Bau');
    const p = getState().projekte[0];
    expect(p.name).toBe('Mein Bau');
    expect(p.systemId).toBe('layher-allround');
    expect(p.zweck).toBe('fassade');
    expect(p.gesamthoehe).toBe(8);
    expect(p.arbeitshoehe).toBe(8);
  });

  test('erstelltAm ist ein ISO-String', () => {
    erstelleTestProjekt();
    const p = getState().projekte[0];
    expect(() => new Date(p.erstelltAm)).not.toThrow();
    expect(new Date(p.erstelltAm).getTime()).not.toBeNaN();
  });

  test('mehrere Projekte erhalten eindeutige IDs', () => {
    const id1 = erstelleTestProjekt('P1');
    const id2 = erstelleTestProjekt('P2');
    expect(id1).not.toBe(id2);
    expect(getState().projekte).toHaveLength(2);
  });
});

// ─── aktualisierteProjekt ─────────────────────────────────────────────────────

describe('aktualisierteProjekt', () => {
  test('aktualisiert Name', () => {
    const id = erstelleTestProjekt();
    getState().aktualisierteProjekt(id, { name: 'Neuer Name' });
    expect(getState().projekte[0].name).toBe('Neuer Name');
  });

  test('aktualisiert mehrere Felder gleichzeitig', () => {
    const id = erstelleTestProjekt();
    getState().aktualisierteProjekt(id, { adresse: 'Hauptstr. 1', auftraggeber: 'Müller GmbH' });
    const p = getState().projekte[0];
    expect(p.adresse).toBe('Hauptstr. 1');
    expect(p.auftraggeber).toBe('Müller GmbH');
  });

  test('unbekannte ID hat keine Auswirkung', () => {
    erstelleTestProjekt();
    getState().aktualisierteProjekt('nicht-vorhanden', { name: 'Crash' });
    expect(getState().projekte[0].name).toBe('Testprojekt');
  });
});

// ─── loescheProjekt ───────────────────────────────────────────────────────────

describe('loescheProjekt', () => {
  test('entfernt das Projekt', () => {
    const id = erstelleTestProjekt();
    getState().loescheProjekt(id);
    expect(getState().projekte).toHaveLength(0);
  });

  test('löscht nur das angegebene Projekt', () => {
    const id1 = erstelleTestProjekt('P1');
    erstelleTestProjekt('P2');
    getState().loescheProjekt(id1);
    expect(getState().projekte).toHaveLength(1);
    expect(getState().projekte[0].name).toBe('P2');
  });

  test('unbekannte ID wirft keinen Fehler', () => {
    expect(() => getState().loescheProjekt('nicht-vorhanden')).not.toThrow();
  });
});

// ─── fuegeSeiteHinzu ──────────────────────────────────────────────────────────

describe('fuegeSeiteHinzu', () => {
  test('fügt Seite hinzu und gibt ID zurück', () => {
    const pId = erstelleTestProjekt();
    const sId = getState().fuegeSeiteHinzu(pId, 'nord', 'Nord');
    expect(typeof sId).toBe('string');
    const projekt = getState().projekte[0];
    expect(projekt.seiten).toHaveLength(1);
    expect(projekt.seiten[0].label).toBe('nord');
    expect(projekt.seiten[0].anzeigename).toBe('Nord');
  });

  test('neue Seite hat messungStatus "fehlend"', () => {
    const pId = erstelleTestProjekt();
    getState().fuegeSeiteHinzu(pId, 'nord', 'Nord');
    expect(getState().projekte[0].seiten[0].messungStatus).toBe('fehlend');
  });

  test('erste Seite wechselt Status von "entwurf" → "aufnahme"', () => {
    const pId = erstelleTestProjekt();
    expect(getState().projekte[0].status).toBe('entwurf');
    getState().fuegeSeiteHinzu(pId, 'nord', 'Nord');
    expect(getState().projekte[0].status).toBe('aufnahme');
  });

  test('mehrere Seiten können hinzugefügt werden', () => {
    const pId = erstelleTestProjekt();
    getState().fuegeSeiteHinzu(pId, 'nord', 'Nord');
    getState().fuegeSeiteHinzu(pId, 'sued', 'Süd');
    expect(getState().projekte[0].seiten).toHaveLength(2);
  });
});

// ─── fuegeMessungHinzu & MessungsStatus ──────────────────────────────────────

describe('fuegeMessungHinzu & MessungsStatus', () => {
  let pId: string;
  let sId: string;

  beforeEach(() => {
    pId = erstelleTestProjekt();
    sId = getState().fuegeSeiteHinzu(pId, 'nord', 'Nord');
  });

  test('fügt Messung hinzu', () => {
    getState().fuegeMessungHinzu(pId, sId, { typ: 'breite', wert: 10, quelle: 'manuell', genauigkeit: 'gemessen' });
    const seite = getState().projekte[0].seiten[0];
    expect(seite.messungen).toHaveLength(1);
    expect(seite.messungen[0].wert).toBe(10);
  });

  test('nur eine Messung pro Typ (letzte überschreibt)', () => {
    getState().fuegeMessungHinzu(pId, sId, { typ: 'breite', wert: 10, quelle: 'manuell', genauigkeit: 'gemessen' });
    getState().fuegeMessungHinzu(pId, sId, { typ: 'breite', wert: 12, quelle: 'manuell', genauigkeit: 'gemessen' });
    const seite = getState().projekte[0].seiten[0];
    expect(seite.messungen).toHaveLength(1);
    expect(seite.messungen[0].wert).toBe(12);
  });

  test('Status → "unvollstaendig" wenn nur Breite vorhanden', () => {
    getState().fuegeMessungHinzu(pId, sId, { typ: 'breite', wert: 10, quelle: 'manuell', genauigkeit: 'gemessen' });
    expect(getState().projekte[0].seiten[0].messungStatus).toBe('unvollstaendig');
  });

  test('Status → "vollstaendig" wenn Breite + Höhe + Wandabstand', () => {
    getState().fuegeMessungHinzu(pId, sId, { typ: 'breite', wert: 10, quelle: 'manuell', genauigkeit: 'gemessen' });
    getState().fuegeMessungHinzu(pId, sId, { typ: 'hoehe', wert: 8, quelle: 'manuell', genauigkeit: 'gemessen' });
    getState().fuegeMessungHinzu(pId, sId, { typ: 'wandabstand', wert: 0.25, quelle: 'manuell', genauigkeit: 'gemessen' });
    expect(getState().projekte[0].seiten[0].messungStatus).toBe('vollstaendig');
  });

  test('Projekt wechselt zu "berechnung" wenn alle Seiten vollständig', () => {
    getState().fuegeMessungHinzu(pId, sId, { typ: 'breite', wert: 10, quelle: 'manuell', genauigkeit: 'gemessen' });
    getState().fuegeMessungHinzu(pId, sId, { typ: 'hoehe', wert: 8, quelle: 'manuell', genauigkeit: 'gemessen' });
    getState().fuegeMessungHinzu(pId, sId, { typ: 'wandabstand', wert: 0.25, quelle: 'manuell', genauigkeit: 'gemessen' });
    expect(getState().projekte[0].status).toBe('berechnung');
  });
});

// ─── fuegeOeffnungHinzu & loescheOeffnung ────────────────────────────────────

describe('Öffnungen', () => {
  let pId: string;
  let sId: string;

  beforeEach(() => {
    pId = erstelleTestProjekt();
    sId = getState().fuegeSeiteHinzu(pId, 'nord', 'Nord');
  });

  test('fügt Öffnung hinzu', () => {
    getState().fuegeOeffnungHinzu(pId, sId, { typ: 'tuer', breite: 1.0, hoehe: 2.2, bruestungHoehe: 0, horizontalOffset: 1.0 });
    expect(getState().projekte[0].seiten[0].oeffnungen).toHaveLength(1);
  });

  test('Öffnung hat eindeutige ID', () => {
    getState().fuegeOeffnungHinzu(pId, sId, { typ: 'tuer', breite: 1.0, hoehe: 2.2, bruestungHoehe: 0, horizontalOffset: 1.0 });
    const oe = getState().projekte[0].seiten[0].oeffnungen[0];
    expect(oe.id).toBeTruthy();
  });

  test('löscht Öffnung', () => {
    getState().fuegeOeffnungHinzu(pId, sId, { typ: 'tuer', breite: 1.0, hoehe: 2.2, bruestungHoehe: 0, horizontalOffset: 1.0 });
    const oeId = getState().projekte[0].seiten[0].oeffnungen[0].id;
    getState().loescheOeffnung(pId, sId, oeId);
    expect(getState().projekte[0].seiten[0].oeffnungen).toHaveLength(0);
  });
});

// ─── Zeiteinträge ─────────────────────────────────────────────────────────────

describe('Zeiteinträge', () => {
  let pId: string;

  beforeEach(() => {
    pId = erstelleTestProjekt();
  });

  test('fügt Zeiteintrag hinzu', () => {
    getState().fuegeZeitEintragHinzu(pId, { datum: '2026-03-20', stunden: 8, beschreibung: 'Aufbau' });
    expect(getState().projekte[0].zeiteintraege).toHaveLength(1);
    expect(getState().projekte[0].zeiteintraege![0].stunden).toBe(8);
  });

  test('löscht Zeiteintrag', () => {
    getState().fuegeZeitEintragHinzu(pId, { datum: '2026-03-20', stunden: 8, beschreibung: 'Aufbau' });
    const eId = getState().projekte[0].zeiteintraege![0].id;
    getState().loescheZeitEintrag(pId, eId);
    expect(getState().projekte[0].zeiteintraege).toHaveLength(0);
  });

  test('mehrere Einträge akkumulieren', () => {
    getState().fuegeZeitEintragHinzu(pId, { datum: '2026-03-20', stunden: 4, beschreibung: 'Tag 1' });
    getState().fuegeZeitEintragHinzu(pId, { datum: '2026-03-21', stunden: 6, beschreibung: 'Tag 2' });
    expect(getState().projekte[0].zeiteintraege).toHaveLength(2);
  });
});

// ─── Prüfpunkte ───────────────────────────────────────────────────────────────

describe('Prüfpunkte', () => {
  let pId: string;

  beforeEach(() => {
    pId = erstelleTestProjekt();
  });

  test('initialisierePruefpunkte legt 26 Punkte an', () => {
    getState().initialisierePruefpunkte(pId);
    expect(getState().projekte[0].pruefpunkte).toHaveLength(26);
  });

  test('alle initialisierten Punkte haben erledigt=false', () => {
    getState().initialisierePruefpunkte(pId);
    for (const p of getState().projekte[0].pruefpunkte!) {
      expect(p.erledigt).toBe(false);
    }
  });

  test('initialisierePruefpunkte wird nicht erneut ausgeführt wenn schon vorhanden', () => {
    getState().initialisierePruefpunkte(pId);
    const erstePunkte = getState().projekte[0].pruefpunkte!;
    getState().initialisierePruefpunkte(pId); // second call
    expect(getState().projekte[0].pruefpunkte).toBe(erstePunkte); // same reference
  });

  test('aktualisierePruefpunkt setzt erledigt=true', () => {
    getState().initialisierePruefpunkte(pId);
    const punktId = getState().projekte[0].pruefpunkte![0].id;
    getState().aktualisierePruefpunkt(pId, punktId, true);
    expect(getState().projekte[0].pruefpunkte![0].erledigt).toBe(true);
  });

  test('aktualisierePruefpunkt setzt erledigtAm-Datum', () => {
    getState().initialisierePruefpunkte(pId);
    const punktId = getState().projekte[0].pruefpunkte![0].id;
    getState().aktualisierePruefpunkt(pId, punktId, true);
    expect(getState().projekte[0].pruefpunkte![0].erledigtAm).toBeTruthy();
  });

  test('aktualisierePruefpunkt speichert Bemerkung', () => {
    getState().initialisierePruefpunkte(pId);
    const punktId = getState().projekte[0].pruefpunkte![0].id;
    getState().aktualisierePruefpunkt(pId, punktId, false, 'Nacharbeit nötig');
    expect(getState().projekte[0].pruefpunkte![0].bemerkung).toBe('Nacharbeit nötig');
  });
});

// ─── setzePlan ────────────────────────────────────────────────────────────────

describe('setzePlan', () => {
  test('speichert aktiverPlan und aktiveMaterialien', () => {
    const plan: GeruestPlan = {
      id: 'plan-1', projektId: 'proj-x', erstelltAm: new Date().toISOString(),
      systemId: 'layher-allround', seiten: [], verankerungen: [], gesamtgewicht: 1200, lastklasse: '3',
    };
    getState().setzePlan(plan, []);
    expect(getState().aktiverPlan?.id).toBe('plan-1');
  });

  test('wechselt Projektstatus "berechnung" → "fertig"', () => {
    const pId = erstelleTestProjekt();
    // Manually set to 'berechnung'
    useProjektStore.setState(state => ({
      projekte: state.projekte.map(p => p.id === pId ? { ...p, status: 'berechnung' as const } : p),
    }));
    const plan: GeruestPlan = {
      id: 'plan-1', projektId: pId, erstelltAm: new Date().toISOString(),
      systemId: 'layher-allround', seiten: [], verankerungen: [], gesamtgewicht: 0, lastklasse: '3',
    };
    getState().setzePlan(plan, []);
    expect(getState().projekte[0].status).toBe('fertig');
  });
});

// ─── exportiereAlsJson / importiereAusJson ───────────────────────────────────

describe('JSON Export/Import', () => {
  test('exportiereAlsJson gibt gültigen JSON zurück', () => {
    erstelleTestProjekt();
    const json = getState().exportiereAlsJson();
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.projekte)).toBe(true);
  });

  test('Import lädt neue Projekte', () => {
    const json = JSON.stringify({
      version: 1,
      exportiertAm: new Date().toISOString(),
      projekte: [{
        id: 'import-1', name: 'Importiert', systemId: 'tobler',
        status: 'entwurf', zweck: 'fassade', gesamthoehe: 4, etagen: 1, arbeitshoehe: 4,
        seiten: [], erstelltAm: new Date().toISOString(), aktualisiertAm: new Date().toISOString(),
      }],
    });
    const ergebnis = getState().importiereAusJson(json);
    expect(ergebnis.erfolg).toBe(true);
    expect(ergebnis.anzahl).toBe(1);
    expect(getState().projekte).toHaveLength(1);
  });

  test('Import ignoriert Duplikate (gleiche ID)', () => {
    erstelleTestProjekt();
    const existierendeId = getState().projekte[0].id;
    const json = JSON.stringify({
      version: 1,
      projekte: [{ id: existierendeId, name: 'Doppelt', systemId: 'tobler', status: 'entwurf', zweck: 'fassade', gesamthoehe: 4, etagen: 1, arbeitshoehe: 4, seiten: [] }],
    });
    getState().importiereAusJson(json);
    expect(getState().projekte).toHaveLength(1); // no duplicate added
  });

  test('Import mit ungültigem JSON → Fehler', () => {
    const ergebnis = getState().importiereAusJson('das ist kein json {{{');
    expect(ergebnis.erfolg).toBe(false);
    expect(ergebnis.fehler).toBeTruthy();
  });

  test('Import mit fehlendem projekte-Array → Fehler', () => {
    const ergebnis = getState().importiereAusJson('{"version":1}');
    expect(ergebnis.erfolg).toBe(false);
    expect(ergebnis.fehler).toMatch(/projekte/i);
  });

  test('Import filtert Einträge ohne Pflichtfelder', () => {
    const json = JSON.stringify({
      version: 1,
      projekte: [
        { id: 'ok-1', name: 'OK', systemId: 'tobler', status: 'entwurf', zweck: 'fassade', gesamthoehe: 4, etagen: 1, arbeitshoehe: 4, seiten: [] },
        { name: 'Kein ID' }, // missing id → filtered
      ],
    });
    const ergebnis = getState().importiereAusJson(json);
    expect(ergebnis.anzahl).toBe(1);
  });
});

// ─── dupliziereProjekt ────────────────────────────────────────────────────────

describe('dupliziereProjekt', () => {
  test('erstellt eine Kopie mit neuer ID', () => {
    const pId = erstelleTestProjekt();
    const kopieId = getState().dupliziereProjekt(pId);
    expect(kopieId).not.toBe(pId);
    expect(getState().projekte).toHaveLength(2);
  });

  test('Kopie bekommt "– Kopie" im Namen', () => {
    const pId = erstelleTestProjekt('Original');
    getState().dupliziereProjekt(pId);
    const kopie = getState().projekte.find(p => p.id !== pId);
    expect(kopie?.name).toBe('Original – Kopie');
  });

  test('Kopie hat Status "entwurf" und leere Seiten', () => {
    const pId = erstelleTestProjekt();
    getState().fuegeSeiteHinzu(pId, 'nord', 'Nord');
    const kopieId = getState().dupliziereProjekt(pId);
    const kopie = getState().projekte.find(p => p.id === kopieId);
    expect(kopie?.status).toBe('entwurf');
    expect(kopie?.seiten).toHaveLength(0);
  });

  test('Kopie übernimmt systemId und arbeitshoehe', () => {
    const pId = erstelleTestProjekt();
    const kopieId = getState().dupliziereProjekt(pId);
    const kopie = getState().projekte.find(p => p.id === kopieId);
    expect(kopie?.systemId).toBe('layher-allround');
    expect(kopie?.arbeitshoehe).toBe(8);
  });

  test('unbekannte ID gibt leeren String zurück', () => {
    const result = getState().dupliziereProjekt('nicht-vorhanden');
    expect(result).toBe('');
  });
});
