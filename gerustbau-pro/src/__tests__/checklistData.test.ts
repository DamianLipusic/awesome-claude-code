import {
  STANDARD_PRUEFPUNKTE,
  KATEGORIE_LABELS,
  KATEGORIE_ICONS,
  erstelleStandardPruefpunkte,
} from '../data/checklistData';

// ─── KATEGORIE_LABELS ─────────────────────────────────────────────────────────

describe('KATEGORIE_LABELS', () => {
  test('hat alle 4 Kategorien', () => {
    const keys = Object.keys(KATEGORIE_LABELS);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('aufbau');
    expect(keys).toContain('sicherheit');
    expect(keys).toContain('dokumentation');
    expect(keys).toContain('abnahme');
  });

  test('alle Labels sind nicht-leere Strings', () => {
    for (const label of Object.values(KATEGORIE_LABELS)) {
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  test('Aufbau-Label enthält "Aufbau"', () => {
    expect(KATEGORIE_LABELS.aufbau).toMatch(/aufbau/i);
  });

  test('Sicherheit-Label enthält "Sicherheit"', () => {
    expect(KATEGORIE_LABELS.sicherheit).toMatch(/sicherheit/i);
  });

  test('Dokumentation-Label enthält "Dokumentation"', () => {
    expect(KATEGORIE_LABELS.dokumentation).toMatch(/dokumentation/i);
  });

  test('Abnahme-Label enthält "Abnahme"', () => {
    expect(KATEGORIE_LABELS.abnahme).toMatch(/abnahme/i);
  });
});

// ─── KATEGORIE_ICONS ──────────────────────────────────────────────────────────

describe('KATEGORIE_ICONS', () => {
  test('hat alle 4 Kategorien', () => {
    expect(Object.keys(KATEGORIE_ICONS)).toHaveLength(4);
  });

  test('alle Icon-Strings sind nicht leer', () => {
    for (const icon of Object.values(KATEGORIE_ICONS)) {
      expect(typeof icon).toBe('string');
      expect(icon.length).toBeGreaterThan(0);
    }
  });
});

// ─── STANDARD_PRUEFPUNKTE – Datenintegrität ───────────────────────────────────

describe('STANDARD_PRUEFPUNKTE – Gesamtmenge', () => {
  test('enthält 26 Prüfpunkte (8+8+5+5)', () => {
    expect(STANDARD_PRUEFPUNKTE).toHaveLength(26);
  });

  test('alle IDs sind eindeutig', () => {
    const ids = STANDARD_PRUEFPUNKTE.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('alle Texte sind nicht leer', () => {
    for (const p of STANDARD_PRUEFPUNKTE) {
      expect(p.text.length).toBeGreaterThan(0);
    }
  });

  test('alle Kategorien sind gültig', () => {
    const gueltig = ['aufbau', 'sicherheit', 'dokumentation', 'abnahme'];
    for (const p of STANDARD_PRUEFPUNKTE) {
      expect(gueltig).toContain(p.kategorie);
    }
  });
});

describe('STANDARD_PRUEFPUNKTE – Kategorienanzahl', () => {
  const zaehle = (kat: string) => STANDARD_PRUEFPUNKTE.filter(p => p.kategorie === kat).length;

  test('aufbau hat 8 Punkte', () => {
    expect(zaehle('aufbau')).toBe(8);
  });

  test('sicherheit hat 8 Punkte', () => {
    expect(zaehle('sicherheit')).toBe(8);
  });

  test('dokumentation hat 5 Punkte', () => {
    expect(zaehle('dokumentation')).toBe(5);
  });

  test('abnahme hat 5 Punkte', () => {
    expect(zaehle('abnahme')).toBe(5);
  });
});

describe('STANDARD_PRUEFPUNKTE – ID-Format', () => {
  test('aufbau-IDs beginnen mit "a"', () => {
    for (const p of STANDARD_PRUEFPUNKTE.filter(p => p.kategorie === 'aufbau')) {
      expect(p.id).toMatch(/^a\d{2}$/);
    }
  });

  test('sicherheit-IDs beginnen mit "s"', () => {
    for (const p of STANDARD_PRUEFPUNKTE.filter(p => p.kategorie === 'sicherheit')) {
      expect(p.id).toMatch(/^s\d{2}$/);
    }
  });

  test('dokumentation-IDs beginnen mit "d"', () => {
    for (const p of STANDARD_PRUEFPUNKTE.filter(p => p.kategorie === 'dokumentation')) {
      expect(p.id).toMatch(/^d\d{2}$/);
    }
  });

  test('abnahme-IDs beginnen mit "n"', () => {
    for (const p of STANDARD_PRUEFPUNKTE.filter(p => p.kategorie === 'abnahme')) {
      expect(p.id).toMatch(/^n\d{2}$/);
    }
  });
});

describe('STANDARD_PRUEFPUNKTE – Inhalt', () => {
  test('a04 erwähnt EN-konforme Abstände (4m/6m)', () => {
    const a04 = STANDARD_PRUEFPUNKTE.find(p => p.id === 'a04');
    expect(a04).toBeDefined();
    expect(a04!.text).toMatch(/4\s*m/);
    expect(a04!.text).toMatch(/6\s*m/);
  });

  test('s01 erwähnt Geländerholm mit 100cm', () => {
    const s01 = STANDARD_PRUEFPUNKTE.find(p => p.id === 's01');
    expect(s01).toBeDefined();
    expect(s01!.text).toMatch(/100/);
  });

  test('d02 erwähnt Übergabeschein', () => {
    const d02 = STANDARD_PRUEFPUNKTE.find(p => p.id === 'd02');
    expect(d02).toBeDefined();
    expect(d02!.text).toMatch(/Übergabe/i);
  });
});

// ─── erstelleStandardPruefpunkte ──────────────────────────────────────────────

describe('erstelleStandardPruefpunkte', () => {
  test('gibt gleiche Anzahl Punkte zurück', () => {
    const punkte = erstelleStandardPruefpunkte();
    expect(punkte).toHaveLength(STANDARD_PRUEFPUNKTE.length);
  });

  test('alle Punkte haben erledigt=false', () => {
    const punkte = erstelleStandardPruefpunkte();
    for (const p of punkte) {
      expect(p.erledigt).toBe(false);
    }
  });

  test('IDs und Texte werden übernommen', () => {
    const punkte = erstelleStandardPruefpunkte();
    for (let i = 0; i < STANDARD_PRUEFPUNKTE.length; i++) {
      expect(punkte[i].id).toBe(STANDARD_PRUEFPUNKTE[i].id);
      expect(punkte[i].text).toBe(STANDARD_PRUEFPUNKTE[i].text);
      expect(punkte[i].kategorie).toBe(STANDARD_PRUEFPUNKTE[i].kategorie);
    }
  });

  test('gibt unabhängige Kopien zurück (kein Shared State)', () => {
    const kopie1 = erstelleStandardPruefpunkte();
    const kopie2 = erstelleStandardPruefpunkte();
    kopie1[0].erledigt = true;
    expect(kopie2[0].erledigt).toBe(false);
  });

  test('jeder Aufruf gibt neue Array-Instanz zurück', () => {
    const a = erstelleStandardPruefpunkte();
    const b = erstelleStandardPruefpunkte();
    expect(a).not.toBe(b);
  });
});
