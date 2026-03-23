export type ScaffoldSystemId =
  | 'layher-allround'
  | 'layher-blitz'
  | 'tobler';

export type ScaffoldPurpose =
  | 'fassade'
  | 'innen'
  | 'industrie';

export type ProjectStatus =
  | 'entwurf'
  | 'aufnahme'
  | 'berechnung'
  | 'fertig';

export interface ZeitEintrag {
  id: string;
  datum: string;             // ISO date string YYYY-MM-DD
  stunden: number;           // decimal hours e.g. 2.5
  beschreibung: string;
  mitarbeiter?: string;
}

export interface Project {
  id: string;
  name: string;
  adresse?: string;
  auftraggeber?: string;
  systemId: ScaffoldSystemId;
  zweck: ScaffoldPurpose;
  gesamthoehe: number;       // meters
  etagen: number;
  arbeitshoehe: number;      // meters (scaffold working height)
  status: ProjectStatus;
  seiten: BausteinSeite[];
  erstelltAm: string;        // ISO date string
  aktualisiertAm: string;
  notizen?: string;
  termin?: string;           // ISO date string – project deadline
  zeiteintraege?: ZeitEintrag[];
}

export type SeitenLabel =
  | 'nord'
  | 'sued'
  | 'ost'
  | 'west'
  | 'seite-a'
  | 'seite-b'
  | 'seite-c'
  | 'seite-d';

export type MessungStatus = 'fehlend' | 'unvollstaendig' | 'vollstaendig';

export interface BausteinSeite {
  id: string;
  projektId: string;
  label: SeitenLabel;
  anzeigename: string;
  fotos: Foto[];
  messungen: Messung[];
  messungStatus: MessungStatus;
  gesamtbreite?: number;     // meters
  gesamthoehe?: number;      // meters
  oeffnungen: Oeffnung[];
}

export interface Oeffnung {
  id: string;
  typ: 'fenster' | 'tuer' | 'tor' | 'sonstiges';
  breite: number;
  hoehe: number;
  brustuengHoehe: number;    // sill height from ground
  horizontalOffset: number;  // offset from left edge of side
}

export interface Foto {
  id: string;
  seitenId: string;
  localUri: string;
  breite: number;            // pixels
  hoehe: number;             // pixels
  aufgenommenAm: string;
  annotationen: Annotation[];
  kompassRichtung?: number;
}

export type MessungsTyp =
  | 'breite'
  | 'hoehe'
  | 'oeffnung-breite'
  | 'oeffnung-hoehe'
  | 'oeffnung-bruestung'
  | 'feld-breite'
  | 'wandabstand'
  | 'freistand-hoehe';

export interface Annotation {
  id: string;
  fotoId: string;
  typ: MessungsTyp;
  startPunkt: { x: number; y: number };
  endPunkt: { x: number; y: number };
  realweltWert: number;      // always stored in meters
  einheit: 'mm' | 'cm' | 'm';
  beschriftung?: string;
  farbe: string;             // hex
}

export interface Messung {
  id: string;
  seitenId: string;
  typ: MessungsTyp;
  wert: number;              // meters
  quelle: 'annotiert' | 'manuell' | 'abgeleitet';
  genauigkeit: 'gemessen' | 'geschaetzt';
  annotationId?: string;
}

export interface GeruestPlan {
  id: string;
  projektId: string;
  erstelltAm: string;
  systemId: ScaffoldSystemId;
  seiten: SeitenPlan[];
  verankerungen: AnkerPunkt[];
  gesamtgewicht: number;     // kg
  lastklasse: '2' | '3' | '4' | '5' | '6';
}

export interface SeitenPlan {
  seitenId: string;
  felder: Feld[];
  lagen: Lage[];
  oberesGelaender: boolean;
  treppenturmPosition?: number;
}

export interface Feld {
  index: number;
  breite: number;
  startX: number;
}

export interface Lage {
  index: number;
  hoehe: number;
  startY: number;
  hatBelag: boolean;
  hatGelaender: boolean;
  hatBordbrett: boolean;
}

export interface AnkerPunkt {
  seitenId: string;
  x: number;
  y: number;
  typ: 'flex-anker' | 'oesen-anker' | 'rahmen-anker';
}

export interface MaterialPosition {
  id: string;
  planId: string;
  komponenteId: string;
  menge: number;
  einheit: 'stk' | 'm' | 'kg';
  mengeManuell?: number;
  notizen?: string;
}
