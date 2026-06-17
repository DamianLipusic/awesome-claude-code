import { generierePdfHtml } from '../pdf/PdfGenerator';
import type { PdfEingabe } from '../pdf/PdfGenerator';
import type { Project, GeruestPlan, MaterialPosition, ZeitEintrag, PruefPunkt } from '../models/Project';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeProjekt(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Testprojekt Muster',
    adresse: 'Musterstraße 1, 12345 Berlin',
    auftraggeber: 'Max Mustermann',
    systemId: 'layher-allround',
    zweck: 'fassade',
    gesamthoehe: 8.0,
    etagen: 3,
    arbeitshoehe: 7.5,
    status: 'fertig',
    seiten: [],
    erstelltAm: '2026-03-24T10:00:00.000Z',
    aktualisiertAm: '2026-03-24T10:00:00.000Z',
    zeiteintraege: [],
    pruefpunkte: [],
    ...overrides,
  };
}

function makePlan(overrides: Partial<GeruestPlan> = {}): GeruestPlan {
  return {
    id: 'plan-1',
    projektId: 'proj-1',
    erstelltAm: '2026-03-24T10:00:00.000Z',
    systemId: 'layher-allround',
    seiten: [],
    verankerungen: [],
    gesamtgewicht: 1800,
    lastklasse: '3',
    ...overrides,
  };
}

function basisEingabe(overrides: Partial<PdfEingabe> = {}): PdfEingabe {
  return {
    projekt: makeProjekt(),
    plan: makePlan(),
    materialien: [],
    zeigePlanSeiten: false,   // no SVG needed for most tests
    zeigeAnnotierteFotos: false,
    zeigeMaterialliste: false,
    zeigeZeitprotokoll: false,
    zeigeCheckliste: false,
    ...overrides,
  };
}

// ─── HTML-Grundstruktur ───────────────────────────────────────────────────────

describe('generierePdfHtml – Grundstruktur', () => {
  test('gibt einen String zurück', () => {
    expect(typeof generierePdfHtml(basisEingabe())).toBe('string');
  });

  test('beginnt mit <!DOCTYPE html>', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
  });

  test('enthält <html lang="de">', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('lang="de"');
  });

  test('enthält <head> und <body>', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  test('enthält <style> mit @page A4', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('@page');
    expect(html).toContain('A4');
  });

  test('<title> enthält Projektnamen (escaped)', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('Testprojekt Muster');
  });
});

// ─── Deckblatt ────────────────────────────────────────────────────────────────

describe('generierePdfHtml – Deckblatt', () => {
  test('enthält "Gerüstplanung" als H1', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('Gerüstplanung');
  });

  test('enthält Projektname als H2', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('Testprojekt Muster');
  });

  test('enthält Adresse', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('Musterstraße 1');
  });

  test('enthält Auftraggeber', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('Max Mustermann');
  });

  test('enthält Lastklasse', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('LK 3');
  });

  test('enthält Gesamtgewicht als t (1800kg = 1.8t)', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toContain('1.8 t');
  });

  test('enthält Hinweis auf DIN EN 12810', () => {
    const html = generierePdfHtml(basisEingabe());
    expect(html).toMatch(/DIN EN 12810/);
  });
});

// ─── Firma ────────────────────────────────────────────────────────────────────

describe('generierePdfHtml – Firmenblock', () => {
  test('kein Firmenname → kein firma-block div', () => {
    const html = generierePdfHtml(basisEingabe());
    // CSS contains ".firma-block" but there should be no <div class="firma-block">
    expect(html).not.toContain('<div class="firma-block">');
  });

  test('mit Firmenname → firma-block div vorhanden', () => {
    const html = generierePdfHtml(basisEingabe({ firmenname: 'Gerüst GmbH' }));
    expect(html).toContain('Gerüst GmbH');
    expect(html).toContain('<div class="firma-block">');
  });

  test('mit Telefon → Tel: sichtbar', () => {
    const html = generierePdfHtml(basisEingabe({
      firmenname: 'GmbH',
      firmentelefon: '+49 30 12345',
    }));
    expect(html).toContain('Tel:');
    expect(html).toContain('+49 30 12345');
  });

  test('ohne Telefon → "Tel:" nicht vorhanden', () => {
    const html = generierePdfHtml(basisEingabe({ firmenname: 'GmbH' }));
    expect(html).not.toContain('Tel:');
  });

  test('mit E-Mail → E-Mail sichtbar', () => {
    const html = generierePdfHtml(basisEingabe({
      firmenname: 'GmbH',
      firmenemail: 'info@firma.de',
    }));
    expect(html).toContain('info@firma.de');
  });
});

// ─── XSS-Escaping ─────────────────────────────────────────────────────────────

describe('generierePdfHtml – XSS-Schutz', () => {
  test('< und > in Projektname werden escaped', () => {
    const html = generierePdfHtml(basisEingabe({
      projekt: makeProjekt({ name: '<script>alert(1)</script>' }),
    }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  test('" in Auftraggeber wird escaped', () => {
    const html = generierePdfHtml(basisEingabe({
      projekt: makeProjekt({ auftraggeber: 'Hans "der Chef"' }),
    }));
    expect(html).not.toContain('"der Chef"');
    expect(html).toContain('&quot;');
  });

  test('& in Firmenname wird escaped', () => {
    const html = generierePdfHtml(basisEingabe({
      firmenname: 'Müller & Söhne GmbH',
    }));
    expect(html).not.toContain('Müller & Söhne');
    expect(html).toContain('&amp;');
  });

  test("' in Adresse wird escaped", () => {
    const html = generierePdfHtml(basisEingabe({
      projekt: makeProjekt({ adresse: "O'Haras Bauplatz 1" }),
    }));
    expect(html).toContain('&#039;');
  });

  test('></script> in Firmenadresse erzeugt keine Injection', () => {
    const html = generierePdfHtml(basisEingabe({
      firmenname: 'Test',
      firmenadresse: '</style><script>window.pwned=1</script>',
    }));
    expect(html).not.toContain('</style><script>');
    expect(html).toContain('&lt;/style&gt;');
  });
});

// ─── Bedingte Sektionen ───────────────────────────────────────────────────────

describe('generierePdfHtml – Bedingte Sektionen', () => {
  test('zeigeMaterialliste=false → kein Materiallisten-Abschnitt', () => {
    const html = generierePdfHtml(basisEingabe({ zeigeMaterialliste: false }));
    expect(html).not.toContain('material-seite');
  });

  test('zeigeMaterialliste=true mit Materialien → Materialliste vorhanden', () => {
    const mat: MaterialPosition[] = [
      { id: 'mp-1', planId: 'plan-1', komponenteId: 'la-rahmen-073-200', menge: 10, einheit: 'stk' },
    ];
    const html = generierePdfHtml(basisEingabe({
      zeigeMaterialliste: true,
      materialien: mat,
    }));
    expect(html).toContain('material-seite');
    expect(html).toContain('Materialliste');
  });

  test('zeigeZeitprotokoll=false → kein Zeitprotokoll', () => {
    const html = generierePdfHtml(basisEingabe({ zeigeZeitprotokoll: false }));
    expect(html).not.toContain('Zeitprotokoll');
  });

  test('zeigeZeitprotokoll=true aber keine Einträge → kein Zeitprotokoll', () => {
    const html = generierePdfHtml(basisEingabe({
      zeigeZeitprotokoll: true,
      projekt: makeProjekt({ zeiteintraege: [] }),
    }));
    expect(html).not.toContain('Zeitprotokoll');
  });

  test('zeigeZeitprotokoll=true mit Einträgen → Zeitprotokoll sichtbar', () => {
    const eintrag: ZeitEintrag = {
      id: 'z1', datum: '2026-03-20', stunden: 8, beschreibung: 'Aufbau', mitarbeiter: 'Klaus',
    };
    const html = generierePdfHtml(basisEingabe({
      zeigeZeitprotokoll: true,
      projekt: makeProjekt({ zeiteintraege: [eintrag] }),
    }));
    expect(html).toContain('Zeitprotokoll');
    expect(html).toContain('Aufbau');
    expect(html).toContain('Klaus');
  });

  test('zeigeCheckliste=false → keine Checkliste', () => {
    const html = generierePdfHtml(basisEingabe({ zeigeCheckliste: false }));
    expect(html).not.toContain('Abnahme-Checkliste');
  });

  test('zeigeCheckliste=true mit Prüfpunkten → Checkliste vorhanden', () => {
    const pruef: PruefPunkt[] = [
      { id: 'a01', kategorie: 'aufbau', text: 'Gerüst AUA-konform', erledigt: true },
      { id: 'a02', kategorie: 'aufbau', text: 'Fußplatten korrekt', erledigt: false },
    ];
    const html = generierePdfHtml(basisEingabe({
      zeigeCheckliste: true,
      projekt: makeProjekt({ pruefpunkte: pruef }),
    }));
    expect(html).toContain('Abnahme-Checkliste');
    // 1 of 2 erledigt → "Prüfstand: 1 von 2 Punkten erfüllt"
    expect(html).toContain('1 von 2');
  });

  test('zeigeCheckliste=true aber keine Punkte → keine Checkliste', () => {
    const html = generierePdfHtml(basisEingabe({
      zeigeCheckliste: true,
      projekt: makeProjekt({ pruefpunkte: [] }),
    }));
    expect(html).not.toContain('Abnahme-Checkliste');
  });
});

// ─── Zeitprotokoll – Berechnungen ─────────────────────────────────────────────

describe('generierePdfHtml – Zeitprotokoll Gesamtstunden', () => {
  test('Gesamtstunden werden korrekt summiert', () => {
    const eintraege: ZeitEintrag[] = [
      { id: 'z1', datum: '2026-03-20', stunden: 4, beschreibung: 'Tag 1' },
      { id: 'z2', datum: '2026-03-21', stunden: 6, beschreibung: 'Tag 2' },
    ];
    const html = generierePdfHtml(basisEingabe({
      zeigeZeitprotokoll: true,
      projekt: makeProjekt({ zeiteintraege: eintraege }),
    }));
    expect(html).toContain('10 Std.');
  });

  test('Einträge werden nach Datum sortiert', () => {
    const eintraege: ZeitEintrag[] = [
      { id: 'z2', datum: '2026-03-22', stunden: 2, beschreibung: 'Späterer Tag' },
      { id: 'z1', datum: '2026-03-20', stunden: 2, beschreibung: 'Früherer Tag' },
    ];
    const html = generierePdfHtml(basisEingabe({
      zeigeZeitprotokoll: true,
      projekt: makeProjekt({ zeiteintraege: eintraege }),
    }));
    const pos1 = html.indexOf('Früherer Tag');
    const pos2 = html.indexOf('Späterer Tag');
    expect(pos1).toBeGreaterThan(0);
    expect(pos2).toBeGreaterThan(0);
    expect(pos1).toBeLessThan(pos2); // earlier date comes first
  });
});

// ─── Checkliste – Kategorien ──────────────────────────────────────────────────

describe('generierePdfHtml – Checkliste Kategorien', () => {
  test('erledigte Punkte zeigen ✅, nicht erledigte ☐', () => {
    const pruef: PruefPunkt[] = [
      { id: 'a01', kategorie: 'aufbau', text: 'Punkt A', erledigt: true },
      { id: 'a02', kategorie: 'aufbau', text: 'Punkt B', erledigt: false },
    ];
    const html = generierePdfHtml(basisEingabe({
      zeigeCheckliste: true,
      projekt: makeProjekt({ pruefpunkte: pruef }),
    }));
    expect(html).toContain('&#9989;');  // ✅
    expect(html).toContain('&#9744;');  // ☐
  });

  test('Prüfstand zeigt korrekte erledigte Anzahl', () => {
    const pruef: PruefPunkt[] = [
      { id: 'a01', kategorie: 'aufbau', text: 'P1', erledigt: true },
      { id: 'a02', kategorie: 'aufbau', text: 'P2', erledigt: true },
      { id: 'a03', kategorie: 'aufbau', text: 'P3', erledigt: false },
    ];
    const html = generierePdfHtml(basisEingabe({
      zeigeCheckliste: true,
      projekt: makeProjekt({ pruefpunkte: pruef }),
    }));
    expect(html).toContain('2 von 3');
  });

  test('XSS in Prüfpunkt-Bemerkung wird escaped', () => {
    const pruef: PruefPunkt[] = [
      { id: 'a01', kategorie: 'aufbau', text: 'Punkt', erledigt: false, bemerkung: '<img src=x onerror=alert(1)>' },
    ];
    const html = generierePdfHtml(basisEingabe({
      zeigeCheckliste: true,
      projekt: makeProjekt({ pruefpunkte: pruef }),
    }));
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img');
  });
});
