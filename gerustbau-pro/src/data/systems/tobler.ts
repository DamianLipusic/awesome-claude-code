import type { GeruestSystem } from './index';

// Tobler Gerüste AG (Switzerland) - modular frame scaffold system
// Standard frame widths similar to Allround but with Swiss-market specific components
export const TOBLER_SYSTEM: GeruestSystem = {
  id: 'tobler',
  name: 'Tobler Gerüst',
  hersteller: 'Tobler Gerüste AG',
  standardFeldBreiten: [0.73, 1.09, 1.57, 2.07, 2.57, 3.07],
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
      beschreibung: 'Messen Sie die Höhe von der Geländeroberkante bis zur Traufkante.',
      pflicht: true,
      proSeite: false,
      proOeffnung: false,
    },
    {
      typ: 'wandabstand',
      bezeichnung: 'Wandabstand',
      beschreibung: 'Abstand des Gerüsts zur Wand (mind. 0,25 m gemäß SUVA-Richtlinien).',
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
    // Rahmen
    { id: 'tb-rahmen-073-200', systemId: 'tobler', name: 'Tobler Rahmen 0,73/2,00', hoehe: 2.00, breite: 0.73, gewicht: 10.3, einheit: 'stk', kategorie: 'rahmen', standardLagHoehen: [2.0] },
    { id: 'tb-rahmen-073-150', systemId: 'tobler', name: 'Tobler Rahmen 0,73/1,50', hoehe: 1.50, breite: 0.73, gewicht: 8.4, einheit: 'stk', kategorie: 'rahmen', standardLagHoehen: [1.5] },
    { id: 'tb-rahmen-073-100', systemId: 'tobler', name: 'Tobler Rahmen 0,73/1,00', hoehe: 1.00, breite: 0.73, gewicht: 6.6, einheit: 'stk', kategorie: 'rahmen', standardLagHoehen: [1.0] },
    // Riegel
    { id: 'tb-riegel-307', systemId: 'tobler', name: 'Tobler Riegel 3,07 m', laenge: 3.07, gewicht: 8.8, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [3.07] },
    { id: 'tb-riegel-257', systemId: 'tobler', name: 'Tobler Riegel 2,57 m', laenge: 2.57, gewicht: 7.3, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [2.57] },
    { id: 'tb-riegel-207', systemId: 'tobler', name: 'Tobler Riegel 2,07 m', laenge: 2.07, gewicht: 5.9, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [2.07] },
    { id: 'tb-riegel-157', systemId: 'tobler', name: 'Tobler Riegel 1,57 m', laenge: 1.57, gewicht: 4.5, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [1.57] },
    { id: 'tb-riegel-109', systemId: 'tobler', name: 'Tobler Riegel 1,09 m', laenge: 1.09, gewicht: 3.2, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [1.09] },
    { id: 'tb-riegel-073', systemId: 'tobler', name: 'Tobler Riegel 0,73 m', laenge: 0.73, gewicht: 2.1, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [0.73] },
    // Diagonalen
    { id: 'tb-diag-257-200', systemId: 'tobler', name: 'Tobler Diagonale 2,57/2,00', gewicht: 6.1, einheit: 'stk', kategorie: 'diagonale' },
    { id: 'tb-diag-207-200', systemId: 'tobler', name: 'Tobler Diagonale 2,07/2,00', gewicht: 5.1, einheit: 'stk', kategorie: 'diagonale' },
    // Beläge (Aluminium planks - common in Swiss market)
    { id: 'tb-alubelag-257-032', systemId: 'tobler', name: 'Alu-Belag 2,57/0,32', laenge: 2.57, breite: 0.32, gewicht: 8.2, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [2.57] },
    { id: 'tb-alubelag-207-032', systemId: 'tobler', name: 'Alu-Belag 2,07/0,32', laenge: 2.07, breite: 0.32, gewicht: 6.6, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [2.07] },
    { id: 'tb-alubelag-157-032', systemId: 'tobler', name: 'Alu-Belag 1,57/0,32', laenge: 1.57, breite: 0.32, gewicht: 5.0, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [1.57] },
    { id: 'tb-stahlbelag-257-032', systemId: 'tobler', name: 'Stahlbelag 2,57/0,32', laenge: 2.57, breite: 0.32, gewicht: 12.8, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [2.57] },
    // Geländer
    { id: 'tb-gelaender-257', systemId: 'tobler', name: 'Geländerholm 2,57 m', laenge: 2.57, gewicht: 3.9, einheit: 'stk', kategorie: 'gelaender', standardFeldBreiten: [2.57] },
    { id: 'tb-gelaender-207', systemId: 'tobler', name: 'Geländerholm 2,07 m', laenge: 2.07, gewicht: 3.2, einheit: 'stk', kategorie: 'gelaender', standardFeldBreiten: [2.07] },
    { id: 'tb-gelaender-157', systemId: 'tobler', name: 'Geländerholm 1,57 m', laenge: 1.57, gewicht: 2.5, einheit: 'stk', kategorie: 'gelaender', standardFeldBreiten: [1.57] },
    // Bordbretter
    { id: 'tb-bordbrett-257', systemId: 'tobler', name: 'Bordbrett 2,57 m', laenge: 2.57, gewicht: 2.2, einheit: 'stk', kategorie: 'bordbrett' },
    // Fußteile
    { id: 'tb-spindel', systemId: 'tobler', name: 'Fußspindel 0,40 m', gewicht: 3.4, einheit: 'stk', kategorie: 'spindel' },
    { id: 'tb-fussplatte', systemId: 'tobler', name: 'Fußplatte 150x150 mm', gewicht: 1.2, einheit: 'stk', kategorie: 'fussplatte' },
    // Verankerung
    { id: 'tb-flexanker', systemId: 'tobler', name: 'Flexanker', gewicht: 0.8, einheit: 'stk', kategorie: 'anker' },
  ],
};
