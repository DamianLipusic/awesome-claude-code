import type {
  BausteinSeite,
  Messung,
  Oeffnung,
  GeruestPlan,
  SeitenPlan,
  Feld,
  Lage,
  AnkerPunkt,
  MaterialPosition,
  ScaffoldSystemId,
} from '../models/Project';
import { getSystem } from '../data/systems';
import type { GeruestKomponente } from '../data/systems';
import { generiereId } from '../utils/formatters';

interface BerechnungsEingabe {
  seiten: BausteinSeite[];
  systemId: ScaffoldSystemId;
  arbeitshoehe: number;       // total scaffold working height in meters
  lastklasse?: '2' | '3' | '4' | '5' | '6';
}

interface BerechnungsErgebnis {
  plan: GeruestPlan;
  materialien: MaterialPosition[];
  warnungen: string[];
}

// Phase 1: Snap facade width to nearest combination of standard bay widths (greedy fit)
function berechneFelder(breite: number, standardFeldBreiten: number[]): Feld[] {
  const sortiert = [...standardFeldBreiten].sort((a, b) => b - a); // largest first
  const felder: Feld[] = [];
  let verbleibend = breite;
  let startX = 0;

  while (verbleibend > 0.05) {
    let passendeBreite = sortiert.find(b => b <= verbleibend + 0.05);
    if (!passendeBreite) {
      // Use smallest available width
      passendeBreite = sortiert[sortiert.length - 1];
    }
    felder.push({ index: felder.length, breite: passendeBreite, startX });
    startX += passendeBreite;
    verbleibend -= passendeBreite;

    // Safety: prevent infinite loop
    if (felder.length > 100) break;
  }

  return felder;
}

// Phase 2: Compute lifts
function berechneLagen(arbeitshoehe: number, standardLagHoehen: number[]): Lage[] {
  const sortiert = [...standardLagHoehen].sort((a, b) => b - a);
  const lagen: Lage[] = [];
  let verbleibend = arbeitshoehe;
  let startY = 0;

  while (verbleibend > 0.1) {
    let passendeHoehe = sortiert.find(h => h <= verbleibend + 0.1);
    if (!passendeHoehe) {
      passendeHoehe = sortiert[sortiert.length - 1];
    }
    lagen.push({
      index: lagen.length,
      hoehe: passendeHoehe,
      startY,
      hatBelag: true,
      hatGelaender: true,
      hatBordbrett: true,
    });
    startY += passendeHoehe;
    verbleibend -= passendeHoehe;

    if (lagen.length > 50) break;
  }

  return lagen;
}

// Phase 3: Anchor grid per EN 12810-1 Annex B
function berechneAnker(seitenId: string, gesamtBreite: number, gesamtHoehe: number): AnkerPunkt[] {
  const anker: AnkerPunkt[] = [];
  const maxVertikalAbstand = 4.0;   // max 4m vertical
  const maxHorizontalAbstand = 6.0; // max 6m horizontal
  const ersteReiheHoehe = Math.min(4.0, gesamtHoehe);
  const letzteReiheHoehe = Math.max(ersteReiheHoehe, gesamtHoehe - 1.5);

  const anzahlReihen = Math.ceil((letzteReiheHoehe - ersteReiheHoehe) / maxVertikalAbstand) + 1;
  const anzahlSpalten = Math.ceil(gesamtBreite / maxHorizontalAbstand) + 1;

  for (let reihe = 0; reihe < anzahlReihen; reihe++) {
    const y = Math.min(ersteReiheHoehe + reihe * maxVertikalAbstand, letzteReiheHoehe);
    for (let spalte = 0; spalte < anzahlSpalten; spalte++) {
      const x = Math.min(spalte * maxHorizontalAbstand, gesamtBreite);
      anker.push({ seitenId, x, y, typ: 'flex-anker' });
    }
  }

  return anker;
}

function findKomponente(
  komponenten: GeruestKomponente[],
  kategorie: GeruestKomponente['kategorie'],
  feldBreite?: number,
  lagHoehe?: number,
): GeruestKomponente | undefined {
  return komponenten.find(k => {
    if (k.kategorie !== kategorie) return false;
    if (feldBreite !== undefined && k.standardFeldBreiten) {
      if (!k.standardFeldBreiten.some(b => Math.abs(b - feldBreite) < 0.01)) return false;
    }
    if (lagHoehe !== undefined && k.standardLagHoehen) {
      if (!k.standardLagHoehen.some(h => Math.abs(h - lagHoehe) < 0.01)) return false;
    }
    return true;
  });
}

function addMenge(
  materialMap: Map<string, MaterialPosition>,
  planId: string,
  komponente: GeruestKomponente,
  menge: number,
) {
  const existing = materialMap.get(komponente.id);
  if (existing) {
    existing.menge += menge;
  } else {
    materialMap.set(komponente.id, {
      id: generiereId(),
      planId,
      komponenteId: komponente.id,
      menge,
      einheit: komponente.einheit,
    });
  }
}

export function berechneMaterialien(eingabe: BerechnungsEingabe): BerechnungsErgebnis {
  const system = getSystem(eingabe.systemId);
  const planId = generiereId();
  const warnungen: string[] = [];
  const materialMap = new Map<string, MaterialPosition>();
  const seitenPlaene: SeitenPlan[] = [];
  const alleAnker: AnkerPunkt[] = [];

  for (const seite of eingabe.seiten) {
    // Extract measurements
    const breitenMessung = seite.messungen.find(m => m.typ === 'breite');
    const hoehenMessung = seite.messungen.find(m => m.typ === 'hoehe');

    if (!breitenMessung || !hoehenMessung) {
      warnungen.push(`Seite "${seite.anzeigename}": Fehlende Pflichtmessungen (Breite oder Höhe). Seite wird übersprungen.`);
      continue;
    }

    const fassadenBreite = breitenMessung.wert;
    const gesamtHoehe = hoehenMessung.wert;
    const scaffoldHoehe = Math.min(eingabe.arbeitshoehe, gesamtHoehe);

    // Phase 1: Geometry
    const felder = berechneFelder(fassadenBreite, system.standardFeldBreiten);
    const lagen = berechneLagen(scaffoldHoehe, system.standardLagHoehen);
    const anzahlFelder = felder.length;
    const anzahlLagen = lagen.length;
    const anzahlStuetzen = anzahlFelder + 1; // one column per field boundary

    // Phase 3: Anchors
    const anker = berechneAnker(seite.id, fassadenBreite, scaffoldHoehe);
    alleAnker.push(...anker);

    // Phase 2: Component counting
    // ---- Frame systems (Allround, Tobler) ----
    if (eingabe.systemId === 'layher-allround' || eingabe.systemId === 'tobler') {
      // Rahmen: (numStuetzen * numLagen) front + back rows
      for (const lage of lagen) {
        const rahmen = findKomponente(system.komponenten, 'rahmen', undefined, lage.hoehe);
        if (rahmen) {
          // Front and back rows of columns
          addMenge(materialMap, planId, rahmen, anzahlStuetzen * 2);
        } else {
          warnungen.push(`Kein passender Rahmen für Laghöhe ${lage.hoehe}m gefunden.`);
        }
      }

      // Riegel: per feld, per lage, front + back = 2
      for (const feld of felder) {
        const riegel = findKomponente(system.komponenten, 'riegel', feld.breite);
        if (riegel) {
          addMenge(materialMap, planId, riegel, anzahlLagen * 2);
        } else {
          warnungen.push(`Kein passender Riegel für Feldbreite ${feld.breite}m gefunden.`);
        }
      }

      // Diagonalen: one diagonal per 4 fields per lage face (front + back)
      const diagProLage = Math.ceil(anzahlFelder / 4);
      const diagonale = system.komponenten.find(k => k.kategorie === 'diagonale');
      if (diagonale) {
        addMenge(materialMap, planId, diagonale, diagProLage * anzahlLagen * 2);
      }

      // Beläge: fill bay width with planks (plank width = 0.32m)
      const belagBreite = 0.32;
      for (const feld of felder) {
        const belagProFeld = Math.ceil(feld.breite / belagBreite);
        const belag = findKomponente(system.komponenten, 'belag', feld.breite);
        const belagFallback = system.komponenten.find(k => k.kategorie === 'belag');
        const aktuellerBelag = belag ?? belagFallback;
        if (aktuellerBelag) {
          // Only board working lifts (all lifts for facade)
          addMenge(materialMap, planId, aktuellerBelag, belagProFeld * anzahlLagen);
        }
      }

      // Opening deductions for belag
      for (const oeffnung of seite.oeffnungen) {
        if (oeffnung.typ === 'tuer' && oeffnung.hoehe >= system.standardLagHoehen[0]) {
          const abzugBelaege = Math.floor(oeffnung.breite / belagBreite);
          const belagFallback = system.komponenten.find(k => k.kategorie === 'belag');
          if (belagFallback) {
            const existing = materialMap.get(belagFallback.id);
            if (existing) existing.menge = Math.max(0, existing.menge - abzugBelaege);
          }
        }
      }

      // Geländer: one per field, per lage (front face)
      for (const feld of felder) {
        const gelaender = findKomponente(system.komponenten, 'gelaender', feld.breite);
        const gelaenderFallback = system.komponenten.find(k => k.kategorie === 'gelaender');
        const aktGelaender = gelaender ?? gelaenderFallback;
        if (aktGelaender) {
          addMenge(materialMap, planId, aktGelaender, anzahlLagen);
        }
      }

      // Bordbrett: front + back per field per lage
      const bordbrett = system.komponenten.find(k => k.kategorie === 'bordbrett');
      if (bordbrett) {
        addMenge(materialMap, planId, bordbrett, anzahlFelder * anzahlLagen * 2);
      }

      // Fußspindeln + Fußplatten: one per column (front + back)
      const spindel = system.komponenten.find(k => k.kategorie === 'spindel');
      const fussplatte = system.komponenten.find(k => k.kategorie === 'fussplatte');
      if (spindel) addMenge(materialMap, planId, spindel, anzahlStuetzen * 2);
      if (fussplatte) addMenge(materialMap, planId, fussplatte, anzahlStuetzen * 2);

      // Anker
      const ankerKomponente = system.komponenten.find(k => k.kategorie === 'anker');
      if (ankerKomponente) {
        addMenge(materialMap, planId, ankerKomponente, anker.length);
      }

    // ---- Tube-and-clamp (Layher Blitz) ----
    } else if (eingabe.systemId === 'layher-blitz') {
      // Verticals: 2 rows (front + back) * (numFields + 1) columns
      // Each column goes full height
      const vertikalMeter = anzahlStuetzen * 2 * scaffoldHoehe;
      const rohr6m = system.komponenten.find(k => k.id === 'lb-rohr-600');
      if (rohr6m) {
        addMenge(materialMap, planId, rohr6m, Math.ceil(vertikalMeter / 6.0));
      }

      // Horizontals (ledgers): per lage, full width, front + back
      const horizontalMeter = fassadenBreite * 2 * anzahlLagen;
      const rohr3m = system.komponenten.find(k => k.id === 'lb-rohr-300');
      if (rohr3m) {
        addMenge(materialMap, planId, rohr3m, Math.ceil(horizontalMeter / 3.0));
      }

      // Couplers: ~4 per node (vertical x horizontal crossing)
      const winkelkupplung = system.komponenten.find(k => k.id === 'lb-winkelkupplung');
      if (winkelkupplung) {
        addMenge(materialMap, planId, winkelkupplung, anzahlStuetzen * 2 * anzahlLagen * 2);
      }

      // Beläge
      for (const feld of felder) {
        const belagProFeld = Math.ceil(feld.breite / 0.32);
        const belag = findKomponente(system.komponenten, 'belag', feld.breite);
        const belagFallback = system.komponenten.find(k => k.kategorie === 'belag');
        const aktBelag = belag ?? belagFallback;
        if (aktBelag) {
          addMenge(materialMap, planId, aktBelag, belagProFeld * anzahlLagen);
        }
      }

      // Guardrail (linear meters)
      const gelaender = system.komponenten.find(k => k.kategorie === 'gelaender');
      if (gelaender) {
        addMenge(materialMap, planId, gelaender, fassadenBreite * anzahlLagen);
      }

      // Toeboards (linear meters)
      const bordbrett = system.komponenten.find(k => k.kategorie === 'bordbrett');
      if (bordbrett) {
        addMenge(materialMap, planId, bordbrett, fassadenBreite * 2 * anzahlLagen);
      }

      // Screw jacks
      const spindel = system.komponenten.find(k => k.kategorie === 'spindel');
      if (spindel) addMenge(materialMap, planId, spindel, anzahlStuetzen * 2);

      // Anchors
      const ankerKomponente = system.komponenten.find(k => k.kategorie === 'anker');
      if (ankerKomponente) {
        addMenge(materialMap, planId, ankerKomponente, anker.length);
      }
    }

    seitenPlaene.push({
      seitenId: seite.id,
      felder,
      lagen,
      oberesGelaender: true,
    });
  }

  // Phase 4: Safety margin +5%, round up
  const materialien: MaterialPosition[] = [];
  for (const [, pos] of materialMap) {
    pos.menge = Math.ceil(pos.menge * 1.05);
    materialien.push(pos);
  }

  const gesamtgewicht = materialien.reduce((sum, pos) => {
    const komp = system.komponenten.find(k => k.id === pos.komponenteId);
    if (!komp) return sum;
    return sum + komp.gewicht * pos.menge;
  }, 0);

  const plan: GeruestPlan = {
    id: planId,
    projektId: '',
    erstelltAm: new Date().toISOString(),
    systemId: eingabe.systemId,
    seiten: seitenPlaene,
    verankerungen: alleAnker,
    gesamtgewicht,
    lastklasse: eingabe.lastklasse ?? '3',
  };

  return { plan, materialien, warnungen };
}
