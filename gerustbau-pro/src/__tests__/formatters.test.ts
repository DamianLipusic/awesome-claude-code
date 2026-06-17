import {
  generiereId,
  formatiereMetric,
  konvertiereZuMetern,
  formatiereGewicht,
  formatiereZahl,
  formatiereDatum,
} from '../utils/formatters';

// ─── generiereId ─────────────────────────────────────────────────────────────

describe('generiereId', () => {
  test('gibt einen nicht-leeren String zurück', () => {
    expect(typeof generiereId()).toBe('string');
    expect(generiereId().length).toBeGreaterThan(0);
  });

  test('jeder Aufruf gibt eine einzigartige ID', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generiereId()));
    expect(ids.size).toBe(100);
  });

  test('ID hat UUID v4 Format', () => {
    const uuid = generiereId();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

// ─── formatiereMetric ─────────────────────────────────────────────────────────

describe('formatiereMetric', () => {
  test('1 m → "1.00 m" (Standard)', () => {
    expect(formatiereMetric(1)).toBe('1.00 m');
  });

  test('1.5 m → "1.50 m"', () => {
    expect(formatiereMetric(1.5)).toBe('1.50 m');
  });

  test('0.25 m in mm → "250 mm"', () => {
    expect(formatiereMetric(0.25, 'mm')).toBe('250 mm');
  });

  test('0.25 m in cm → "25.0 cm"', () => {
    expect(formatiereMetric(0.25, 'cm')).toBe('25.0 cm');
  });

  test('1.234 m in m → "1.23 m" (2 Nachkommastellen)', () => {
    expect(formatiereMetric(1.234)).toBe('1.23 m');
  });

  test('0 m → "0.00 m"', () => {
    expect(formatiereMetric(0)).toBe('0.00 m');
  });

  test('1.5 m in cm → "150.0 cm"', () => {
    expect(formatiereMetric(1.5, 'cm')).toBe('150.0 cm');
  });
});

// ─── konvertiereZuMetern ──────────────────────────────────────────────────────

describe('konvertiereZuMetern', () => {
  test('1000 mm → 1 m', () => {
    expect(konvertiereZuMetern(1000, 'mm')).toBeCloseTo(1.0, 5);
  });

  test('250 mm → 0.25 m', () => {
    expect(konvertiereZuMetern(250, 'mm')).toBeCloseTo(0.25, 5);
  });

  test('100 cm → 1 m', () => {
    expect(konvertiereZuMetern(100, 'cm')).toBeCloseTo(1.0, 5);
  });

  test('25 cm → 0.25 m', () => {
    expect(konvertiereZuMetern(25, 'cm')).toBeCloseTo(0.25, 5);
  });

  test('1 m → 1 m (Identität)', () => {
    expect(konvertiereZuMetern(1, 'm')).toBeCloseTo(1.0, 5);
  });

  test('5.73 m → 5.73 m', () => {
    expect(konvertiereZuMetern(5.73, 'm')).toBeCloseTo(5.73, 5);
  });

  test('0 mm → 0 m', () => {
    expect(konvertiereZuMetern(0, 'mm')).toBe(0);
  });
});

// ─── formatiereGewicht ────────────────────────────────────────────────────────

describe('formatiereGewicht', () => {
  test('500 kg → "500 kg"', () => {
    expect(formatiereGewicht(500)).toBe('500 kg');
  });

  test('999 kg → "999 kg"', () => {
    expect(formatiereGewicht(999)).toBe('999 kg');
  });

  test('1000 kg → "1.0 t"', () => {
    expect(formatiereGewicht(1000)).toBe('1.0 t');
  });

  test('1500 kg → "1.5 t"', () => {
    expect(formatiereGewicht(1500)).toBe('1.5 t');
  });

  test('2750 kg → "2.8 t" (gerundet)', () => {
    expect(formatiereGewicht(2750)).toBe('2.8 t');
  });

  test('0 kg → "0 kg"', () => {
    expect(formatiereGewicht(0)).toBe('0 kg');
  });

  test('1.7 kg → "2 kg" (gerundet)', () => {
    expect(formatiereGewicht(1.7)).toBe('2 kg');
  });
});

// ─── formatiereZahl ───────────────────────────────────────────────────────────

describe('formatiereZahl', () => {
  test('42 → "42" (0 Nachkommastellen default)', () => {
    expect(formatiereZahl(42)).toBe('42');
  });

  test('42.6789 → "43" (gerundet auf 0)', () => {
    expect(formatiereZahl(42.6789)).toBe('43');
  });

  test('3.14159 mit 2 Nachkommastellen → "3,14" (Komma)', () => {
    expect(formatiereZahl(3.14159, 2)).toBe('3,14');
  });

  test('1000.5 mit 1 Nachkommastelle → "1000,5"', () => {
    expect(formatiereZahl(1000.5, 1)).toBe('1000,5');
  });

  test('0 → "0"', () => {
    expect(formatiereZahl(0)).toBe('0');
  });

  test('Punkt wird zu Komma ersetzt', () => {
    expect(formatiereZahl(1.5, 1)).toBe('1,5');
  });
});

// ─── formatiereDatum ─────────────────────────────────────────────────────────

describe('formatiereDatum', () => {
  test('ISO-String wird zu deutschem Format', () => {
    const result = formatiereDatum('2026-01-15');
    // de-DE format: DD.MM.YYYY
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    expect(result).toContain('2026');
  });

  test('Date-Objekt wird korrekt formatiert', () => {
    const d = new Date(2026, 0, 15); // Jan 15, 2026
    const result = formatiereDatum(d);
    expect(result).toContain('2026');
    expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });

  test('Ergebnis enthält Tag, Monat, Jahr', () => {
    const result = formatiereDatum('2026-03-24');
    expect(result).toContain('2026');
    expect(result).toMatch(/24/);   // day
    expect(result).toMatch(/03|3/); // month
  });
});
