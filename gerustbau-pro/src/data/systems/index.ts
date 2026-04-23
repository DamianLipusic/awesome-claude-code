import type { ScaffoldSystemId, MessungsTyp } from '../../models/Project';

export type KomponentenKategorie =
  | 'rahmen'
  | 'riegel'
  | 'diagonale'
  | 'belag'
  | 'gelaender'
  | 'bordbrett'
  | 'fussplatte'
  | 'spindel'
  | 'anker'
  | 'treppe'
  | 'rohr'
  | 'kupplung'
  | 'sonstiges';

export interface GeruestKomponente {
  id: string;
  systemId: ScaffoldSystemId;
  name: string;
  artikelNummer?: string;
  laenge?: number;    // meters
  breite?: number;    // meters
  hoehe?: number;     // meters
  gewicht: number;    // kg per unit
  einheit: 'stk' | 'm' | 'kg';
  kategorie: KomponentenKategorie;
  standardFeldBreiten?: number[];
  standardLagHoehen?: number[];
}

export interface MessungsAnforderung {
  typ: MessungsTyp;
  bezeichnung: string;
  beschreibung: string;
  pflicht: boolean;
  proSeite: boolean;
  proOeffnung: boolean;
  illustration?: string;
}

export interface GeruestSystem {
  id: ScaffoldSystemId;
  name: string;
  hersteller: string;
  standardFeldBreiten: number[];    // meters
  standardLagHoehen: number[];      // meters
  komponenten: GeruestKomponente[];
  messungsAnforderungen: MessungsAnforderung[];
}

export { LAYHER_ALLROUND_SYSTEM } from './layher-allround';
export { LAYHER_BLITZ_SYSTEM } from './layher-blitz';
export { TOBLER_SYSTEM } from './tobler';

import { LAYHER_ALLROUND_SYSTEM } from './layher-allround';
import { LAYHER_BLITZ_SYSTEM } from './layher-blitz';
import { TOBLER_SYSTEM } from './tobler';

export const ALLE_SYSTEME: GeruestSystem[] = [
  LAYHER_ALLROUND_SYSTEM,
  LAYHER_BLITZ_SYSTEM,
  TOBLER_SYSTEM,
];

export function getSystem(id: ScaffoldSystemId): GeruestSystem {
  const system = ALLE_SYSTEME.find(s => s.id === id);
  if (!system) throw new Error(`Unbekanntes System: ${id}`);
  return system;
}
