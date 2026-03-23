import type { GeruestSystem } from './index';

export const LAYHER_BLITZ_SYSTEM: GeruestSystem = {
  id: 'layher-blitz',
  name: 'Layher Blitz',
  hersteller: 'Layher',
  // Blitz is a tube-and-clamp system with standardized tubes
  standardFeldBreiten: [1.0, 1.5, 2.0, 2.5, 3.0],
  standardLagHoehen: [1.0, 1.5, 2.0],
  messungsAnforderungen: [
    {
      typ: 'breite',
      bezeichnung: 'Gesamtbreite Fassade',
      beschreibung: 'Messen Sie die Breite von Ecke zu Ecke der Fassadenseite.',
      pflicht: true,
      proSeite: true,
      proOeffnung: false,
    },
    {
      typ: 'hoehe',
      bezeichnung: 'Gebäudehöhe',
      beschreibung: 'Messen Sie die Höhe von der Geländeroberkante bis zum einzurüstenden Punkt.',
      pflicht: true,
      proSeite: false,
      proOeffnung: false,
    },
    {
      typ: 'wandabstand',
      bezeichnung: 'Wandabstand',
      beschreibung: 'Abstand des Gerüsts zur Wand (mind. 0,25 m).',
      pflicht: true,
      proSeite: true,
      proOeffnung: false,
    },
    {
      typ: 'oeffnung-breite',
      bezeichnung: 'Öffnungsbreite',
      beschreibung: 'Breite jedes Fensters oder jeder Tür.',
      pflicht: false,
      proSeite: false,
      proOeffnung: true,
    },
    {
      typ: 'oeffnung-hoehe',
      bezeichnung: 'Öffnungshöhe',
      beschreibung: 'Höhe jedes Fensters oder jeder Tür.',
      pflicht: false,
      proSeite: false,
      proOeffnung: true,
    },
    {
      typ: 'oeffnung-bruestung',
      bezeichnung: 'Brüstungshöhe',
      beschreibung: 'Höhe der Fensterbank von der Geländeroberkante.',
      pflicht: false,
      proSeite: false,
      proOeffnung: true,
    },
  ],
  komponenten: [
    // Rohre (Tubes) - Layher Blitz uses 48.3mm OD tubes
    { id: 'lb-rohr-600', systemId: 'layher-blitz', name: 'Stahlrohr 6,00 m (48,3 mm)', laenge: 6.0, gewicht: 21.0, einheit: 'm', kategorie: 'rohr' },
    { id: 'lb-rohr-400', systemId: 'layher-blitz', name: 'Stahlrohr 4,00 m (48,3 mm)', laenge: 4.0, gewicht: 14.0, einheit: 'm', kategorie: 'rohr' },
    { id: 'lb-rohr-300', systemId: 'layher-blitz', name: 'Stahlrohr 3,00 m (48,3 mm)', laenge: 3.0, gewicht: 10.5, einheit: 'm', kategorie: 'rohr' },
    { id: 'lb-rohr-250', systemId: 'layher-blitz', name: 'Stahlrohr 2,50 m (48,3 mm)', laenge: 2.5, gewicht: 8.75, einheit: 'm', kategorie: 'rohr' },
    { id: 'lb-rohr-200', systemId: 'layher-blitz', name: 'Stahlrohr 2,00 m (48,3 mm)', laenge: 2.0, gewicht: 7.0, einheit: 'm', kategorie: 'rohr' },
    { id: 'lb-rohr-150', systemId: 'layher-blitz', name: 'Stahlrohr 1,50 m (48,3 mm)', laenge: 1.5, gewicht: 5.25, einheit: 'm', kategorie: 'rohr' },
    { id: 'lb-rohr-100', systemId: 'layher-blitz', name: 'Stahlrohr 1,00 m (48,3 mm)', laenge: 1.0, gewicht: 3.5, einheit: 'm', kategorie: 'rohr' },
    // Kupplungen (Couplers)
    { id: 'lb-winkelkupplung', systemId: 'layher-blitz', name: 'Winkelkupplung (Rechtwinklig)', gewicht: 0.85, einheit: 'stk', kategorie: 'kupplung' },
    { id: 'lb-drehkupplung', systemId: 'layher-blitz', name: 'Drehkupplung', gewicht: 0.85, einheit: 'stk', kategorie: 'kupplung' },
    { id: 'lb-stosskupplung', systemId: 'layher-blitz', name: 'Stoßkupplung', gewicht: 0.55, einheit: 'stk', kategorie: 'kupplung' },
    // Beläge (Planks)
    { id: 'lb-stahlbelag-250', systemId: 'layher-blitz', name: 'Stahlbelag Blitz 2,50 m', laenge: 2.5, breite: 0.32, gewicht: 12.0, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [2.5] },
    { id: 'lb-stahlbelag-200', systemId: 'layher-blitz', name: 'Stahlbelag Blitz 2,00 m', laenge: 2.0, breite: 0.32, gewicht: 9.6, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [2.0] },
    { id: 'lb-stahlbelag-150', systemId: 'layher-blitz', name: 'Stahlbelag Blitz 1,50 m', laenge: 1.5, breite: 0.32, gewicht: 7.2, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [1.5] },
    // Fußteile
    { id: 'lb-spindel', systemId: 'layher-blitz', name: 'Fußspindel 0,40 m', gewicht: 3.5, einheit: 'stk', kategorie: 'spindel' },
    { id: 'lb-fussplatte', systemId: 'layher-blitz', name: 'Fußplatte 150x150', gewicht: 1.1, einheit: 'stk', kategorie: 'fussplatte' },
    // Geländer
    { id: 'lb-rohrgelaender', systemId: 'layher-blitz', name: 'Rohrgeländer (per Lfd.m)', gewicht: 3.5, einheit: 'm', kategorie: 'gelaender' },
    // Bordbrett
    { id: 'lb-bordbrett', systemId: 'layher-blitz', name: 'Bordbrett 38x150 mm (per m)', gewicht: 4.4, einheit: 'm', kategorie: 'bordbrett' },
    // Verankerung
    { id: 'lb-anker', systemId: 'layher-blitz', name: 'Rohrverankerung', gewicht: 0.6, einheit: 'stk', kategorie: 'anker' },
  ],
};
