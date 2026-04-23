import type { GeruestSystem } from './index';

export const LAYHER_ALLROUND_SYSTEM: GeruestSystem = {
  id: 'layher-allround',
  name: 'Layher Allround',
  hersteller: 'Layher',
  standardFeldBreiten: [0.73, 1.09, 1.40, 1.57, 2.07, 2.57, 3.07],
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
      beschreibung: 'Messen Sie die Höhe von der Geländeroberkante bis zur Traufkante oder dem höchsten einzurüstenden Punkt.',
      pflicht: true,
      proSeite: false,
      proOeffnung: false,
    },
    {
      typ: 'wandabstand',
      bezeichnung: 'Wandabstand',
      beschreibung: 'Mindestabstand des Gerüsts zur Wand (mind. 0,25 m gemäß DGUV).',
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
    // Rahmen (Frames)
    { id: 'la-rahmen-073-200', systemId: 'layher-allround', name: 'Rahmen O 0,73/2,00', artikelNummer: '0.731', hoehe: 2.00, breite: 0.73, gewicht: 10.1, einheit: 'stk', kategorie: 'rahmen', standardLagHoehen: [2.0] },
    { id: 'la-rahmen-073-150', systemId: 'layher-allround', name: 'Rahmen O 0,73/1,50', artikelNummer: '0.732', hoehe: 1.50, breite: 0.73, gewicht: 8.2, einheit: 'stk', kategorie: 'rahmen', standardLagHoehen: [1.5] },
    { id: 'la-rahmen-073-100', systemId: 'layher-allround', name: 'Rahmen O 0,73/1,00', artikelNummer: '0.733', hoehe: 1.00, breite: 0.73, gewicht: 6.4, einheit: 'stk', kategorie: 'rahmen', standardLagHoehen: [1.0] },
    // Riegel (Ledgers)
    { id: 'la-riegel-307', systemId: 'layher-allround', name: 'Riegel 3,07 m', artikelNummer: '0.609', laenge: 3.07, gewicht: 8.6, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [3.07] },
    { id: 'la-riegel-257', systemId: 'layher-allround', name: 'Riegel 2,57 m', artikelNummer: '0.611', laenge: 2.57, gewicht: 7.1, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [2.57] },
    { id: 'la-riegel-207', systemId: 'layher-allround', name: 'Riegel 2,07 m', artikelNummer: '0.612', laenge: 2.07, gewicht: 5.8, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [2.07] },
    { id: 'la-riegel-157', systemId: 'layher-allround', name: 'Riegel 1,57 m', artikelNummer: '0.613', laenge: 1.57, gewicht: 4.4, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [1.57] },
    { id: 'la-riegel-140', systemId: 'layher-allround', name: 'Riegel 1,40 m', artikelNummer: '0.614', laenge: 1.40, gewicht: 3.9, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [1.40] },
    { id: 'la-riegel-109', systemId: 'layher-allround', name: 'Riegel 1,09 m', artikelNummer: '0.615', laenge: 1.09, gewicht: 3.1, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [1.09] },
    { id: 'la-riegel-073', systemId: 'layher-allround', name: 'Riegel 0,73 m', artikelNummer: '0.616', laenge: 0.73, gewicht: 2.1, einheit: 'stk', kategorie: 'riegel', standardFeldBreiten: [0.73] },
    // Diagonalen (Diagonal braces)
    { id: 'la-diag-257-200', systemId: 'layher-allround', name: 'Diagonale 2,57/2,00', gewicht: 5.9, einheit: 'stk', kategorie: 'diagonale' },
    { id: 'la-diag-207-200', systemId: 'layher-allround', name: 'Diagonale 2,07/2,00', gewicht: 4.9, einheit: 'stk', kategorie: 'diagonale' },
    // Beläge (Steel decks)
    { id: 'la-belag-307-032', systemId: 'layher-allround', name: 'Stahlbelag 3,07/0,32', artikelNummer: '0.449', laenge: 3.07, breite: 0.32, gewicht: 15.2, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [3.07] },
    { id: 'la-belag-257-032', systemId: 'layher-allround', name: 'Stahlbelag 2,57/0,32', artikelNummer: '0.451', laenge: 2.57, breite: 0.32, gewicht: 12.8, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [2.57] },
    { id: 'la-belag-207-032', systemId: 'layher-allround', name: 'Stahlbelag 2,07/0,32', laenge: 2.07, breite: 0.32, gewicht: 10.4, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [2.07] },
    { id: 'la-belag-157-032', systemId: 'layher-allround', name: 'Stahlbelag 1,57/0,32', laenge: 1.57, breite: 0.32, gewicht: 7.9, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [1.57] },
    { id: 'la-belag-109-032', systemId: 'layher-allround', name: 'Stahlbelag 1,09/0,32', laenge: 1.09, breite: 0.32, gewicht: 5.5, einheit: 'stk', kategorie: 'belag', standardFeldBreiten: [1.09] },
    // Geländer (Guardrails)
    { id: 'la-gelaender-307', systemId: 'layher-allround', name: 'Geländerholm 3,07 m', laenge: 3.07, gewicht: 4.6, einheit: 'stk', kategorie: 'gelaender', standardFeldBreiten: [3.07] },
    { id: 'la-gelaender-257', systemId: 'layher-allround', name: 'Geländerholm 2,57 m', laenge: 2.57, gewicht: 3.8, einheit: 'stk', kategorie: 'gelaender', standardFeldBreiten: [2.57] },
    { id: 'la-gelaender-207', systemId: 'layher-allround', name: 'Geländerholm 2,07 m', laenge: 2.07, gewicht: 3.1, einheit: 'stk', kategorie: 'gelaender', standardFeldBreiten: [2.07] },
    { id: 'la-gelaender-157', systemId: 'layher-allround', name: 'Geländerholm 1,57 m', laenge: 1.57, gewicht: 2.4, einheit: 'stk', kategorie: 'gelaender', standardFeldBreiten: [1.57] },
    // Bordbretter (Toeboards)
    { id: 'la-bordbrett-257', systemId: 'layher-allround', name: 'Bordbrett 2,57 m', laenge: 2.57, gewicht: 2.1, einheit: 'stk', kategorie: 'bordbrett' },
    { id: 'la-bordbrett-207', systemId: 'layher-allround', name: 'Bordbrett 2,07 m', laenge: 2.07, gewicht: 1.7, einheit: 'stk', kategorie: 'bordbrett' },
    // Fußspindeln / Fußplatten
    { id: 'la-spindel-038', systemId: 'layher-allround', name: 'Fußspindel 0,38 m', artikelNummer: '0.201', gewicht: 3.2, einheit: 'stk', kategorie: 'spindel' },
    { id: 'la-fussplatte', systemId: 'layher-allround', name: 'Fußplatte 150x150 mm', gewicht: 1.1, einheit: 'stk', kategorie: 'fussplatte' },
    // Verankerung (Anchors)
    { id: 'la-flexanker', systemId: 'layher-allround', name: 'Flexanker', gewicht: 0.8, einheit: 'stk', kategorie: 'anker' },
    { id: 'la-oesenanker', systemId: 'layher-allround', name: 'Ösenanker M12', gewicht: 0.4, einheit: 'stk', kategorie: 'anker' },
  ],
};
