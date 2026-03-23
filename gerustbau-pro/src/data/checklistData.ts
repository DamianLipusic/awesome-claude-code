import type { PruefPunkt } from '../models/Project';

export type KategorieKey = PruefPunkt['kategorie'];

export const KATEGORIE_LABELS: Record<KategorieKey, string> = {
  aufbau: 'Aufbau & Standsicherheit',
  sicherheit: 'Arbeitssicherheit',
  dokumentation: 'Dokumentation',
  abnahme: 'Abnahme & Freigabe',
};

export const KATEGORIE_ICONS: Record<KategorieKey, string> = {
  aufbau: 'crane',
  sicherheit: 'shield-check',
  dokumentation: 'file-document',
  abnahme: 'checkbox-marked-circle',
};

interface StandardPruefPunkt {
  id: string;
  kategorie: KategorieKey;
  text: string;
}

/** Standard checklist per DGUV R 100-001, TRBS 2121, DIN EN 12811 */
export const STANDARD_PRUEFPUNKTE: StandardPruefPunkt[] = [
  // Aufbau
  { id: 'a01', kategorie: 'aufbau', text: 'Gerüst nach Aufbau- und Verwendungsanleitung (AUA) des Herstellers errichtet' },
  { id: 'a02', kategorie: 'aufbau', text: 'Untergrund tragfähig, Fußplatten und Spindeln korrekt gesetzt' },
  { id: 'a03', kategorie: 'aufbau', text: 'Alle Kupplungen / Rosetten vollständig eingerastet und gesichert' },
  { id: 'a04', kategorie: 'aufbau', text: 'Verankerungen planmäßig gesetzt (vertikaler Abstand ≤ 4 m, horizontal ≤ 6 m)' },
  { id: 'a05', kategorie: 'aufbau', text: 'Belag vollständig verlegt, keine Lücken oder Fehlstellen' },
  { id: 'a06', kategorie: 'aufbau', text: 'Wandabstand eingehalten (max. 30 cm ohne zusätzliche Maßnahmen)' },
  { id: 'a07', kategorie: 'aufbau', text: 'Seitlicher Überstand der Belagelement nicht größer als 20 cm' },
  { id: 'a08', kategorie: 'aufbau', text: 'Gerüst lotrecht und fluchtgerecht aufgebaut' },

  // Sicherheit
  { id: 's01', kategorie: 'sicherheit', text: 'Dreiteiliger Seitenabsturzsicherung: Geländerholm (100 cm), Zwischengeländer (50 cm), Bordbrett (15 cm)' },
  { id: 's02', kategorie: 'sicherheit', text: 'Keine Mängel durch Überlastung, Verformung oder Beschädigung erkennbar' },
  { id: 's03', kategorie: 'sicherheit', text: 'Zugangsmöglichkeit vorhanden (Innenleiter, Treppenturm, Außentreppe)' },
  { id: 's04', kategorie: 'sicherheit', text: 'Durchstiegsluken gesichert oder geschlossen wenn nicht genutzt' },
  { id: 's05', kategorie: 'sicherheit', text: 'Keine Stolperstellen durch Leitungen, Werkzeug oder Fremdmaterial auf Belagelementen' },
  { id: 's06', kategorie: 'sicherheit', text: 'Gerüst gegen unbefugtes Betreten gesichert (z.B. Leiter entfernt oder gesichert)' },
  { id: 's07', kategorie: 'sicherheit', text: 'Schutznetze / Fanggerüste falls erforderlich angebracht' },
  { id: 's08', kategorie: 'sicherheit', text: 'Sicherheitsabstand zu elektrischen Freileitungen eingehalten (mind. 1 m bei U ≤ 1 kV)' },

  // Dokumentation
  { id: 'd01', kategorie: 'dokumentation', text: 'Aufbau- und Verwendungsanleitung (AUA) liegt auf der Baustelle vor' },
  { id: 'd02', kategorie: 'dokumentation', text: 'Gerüstausweis / Übergabeschein ausgefüllt und unterzeichnet' },
  { id: 'd03', kategorie: 'dokumentation', text: 'Lastklasse und Verwendungszweck dokumentiert und am Gerüst ausgehängt' },
  { id: 'd04', kategorie: 'dokumentation', text: 'Prüfdatum und Prüfer im Übergabeprotokoll vermerkt' },
  { id: 'd05', kategorie: 'dokumentation', text: 'Nächster Prüftermin (spätestens 4 Wochen nach Aufbau) festgelegt' },

  // Abnahme
  { id: 'n01', kategorie: 'abnahme', text: 'Gerüst ist vollständig aufgebaut und bezugsfertig' },
  { id: 'n02', kategorie: 'abnahme', text: 'Mängel aus Vorprüfung vollständig beseitigt' },
  { id: 'n03', kategorie: 'abnahme', text: 'Auftraggeber / Bauleiter über Lastklasse und Nutzungsbeschränkungen informiert' },
  { id: 'n04', kategorie: 'abnahme', text: 'Freigabe durch verantwortliche Fachkraft erfolgt' },
  { id: 'n05', kategorie: 'abnahme', text: 'Übergabe an Auftraggeber / Nutzer dokumentiert' },
];

export function erstelleStandardPruefpunkte(): PruefPunkt[] {
  return STANDARD_PRUEFPUNKTE.map(p => ({
    ...p,
    erledigt: false,
  }));
}
