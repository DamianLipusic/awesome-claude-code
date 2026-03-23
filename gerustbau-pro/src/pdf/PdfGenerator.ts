import type { Project, GeruestPlan, MaterialPosition, BausteinSeite } from '../models/Project';
import { getSystem } from '../data/systems';
import type { GeruestKomponente, KomponentenKategorie } from '../data/systems';
import { formatiereGewicht, formatiereZahl, formatiereDatum } from '../utils/formatters';
import { generiereSeitenElevationSVG } from '../algorithms/planGenerator';

const KATEGORIE_LABELS: Record<KomponentenKategorie, string> = {
  rahmen: 'Rahmen',
  riegel: 'Riegel',
  diagonale: 'Diagonalen',
  belag: 'Beläge',
  gelaender: 'Geländer',
  bordbrett: 'Bordbretter',
  fussplatte: 'Fußplatten',
  spindel: 'Spindeln',
  anker: 'Verankerung',
  treppe: 'Treppen',
  rohr: 'Rohre',
  kupplung: 'Kupplungen',
  sonstiges: 'Sonstiges',
};

function deckblattHtml(projekt: Project, plan: GeruestPlan, firmenname?: string): string {
  return `
    <div class="seite deckblatt">
      ${firmenname ? `<div class="firma">${firmenname}</div>` : ''}
      <h1>Gerüstplanung</h1>
      <h2>${projekt.name}</h2>
      <table class="info-tabelle">
        ${projekt.adresse ? `<tr><th>Adresse</th><td>${projekt.adresse}</td></tr>` : ''}
        ${projekt.auftraggeber ? `<tr><th>Auftraggeber</th><td>${projekt.auftraggeber}</td></tr>` : ''}
        <tr><th>Gerüstsystem</th><td>${projekt.systemId.replace('-', ' ').toUpperCase()}</td></tr>
        <tr><th>Verwendungszweck</th><td>${projekt.zweck.charAt(0).toUpperCase() + projekt.zweck.slice(1)}</td></tr>
        <tr><th>Gebäudehöhe</th><td>${projekt.gesamthoehe.toFixed(2)} m</td></tr>
        <tr><th>Etagen</th><td>${projekt.etagen}</td></tr>
        <tr><th>Arbeitshöhe</th><td>${projekt.arbeitshoehe.toFixed(2)} m</td></tr>
        <tr><th>Lastklasse</th><td>LK ${plan.lastklasse} (gem. DIN EN 12811)</td></tr>
        <tr><th>Gesamtgewicht</th><td>${formatiereGewicht(plan.gesamtgewicht)}</td></tr>
        <tr><th>Erstellt am</th><td>${formatiereDatum(new Date())}</td></tr>
      </table>
      <div class="hinweis">
        Dieses Dokument wurde mit Gerüstbau Pro erstellt. Die Mengenangaben sind Schätzwerte
        und müssen vom zuständigen Bauleiter vor Ort geprüft und bestätigt werden.
        Maßgeblich sind die anerkannten Regeln der Technik (DIN EN 12810, DGUV R 100-001).
      </div>
    </div>`;
}

function planSeiteHtml(seite: BausteinSeite, seitenSvg: string): string {
  return `
    <div class="seite plan-seite">
      <h3>${seite.anzeigename} – Ansicht</h3>
      <div class="plan-svg">${seitenSvg}</div>
      <div class="plan-legende">
        <span class="legende-item blau">Rahmen/Rohre</span>
        <span class="legende-item hellblau">Belag</span>
        <span class="legende-item orange">Geländer</span>
        <span class="legende-item rot">Verankerung</span>
      </div>
    </div>`;
}

function fotoSeiteHtml(seite: BausteinSeite): string {
  return seite.fotos.map((foto, idx) => {
    const annotationenHtml = foto.annotationen.map(ann => `
      <tr>
        <td>${ann.typ}</td>
        <td>${ann.realweltWert >= 1 ? ann.realweltWert.toFixed(2) + ' m' : Math.round(ann.realweltWert * 100) + ' cm'}</td>
        <td>${ann.einheit}</td>
      </tr>`).join('');

    return `
      <div class="${idx % 2 === 0 ? 'seite' : ''} foto-bereich">
        <h4>${seite.anzeigename} – Foto ${idx + 1}</h4>
        <img src="${foto.localUri}" class="foto" />
        ${foto.annotationen.length > 0 ? `
        <table class="messung-tabelle">
          <tr><th>Typ</th><th>Wert</th><th>Einheit</th></tr>
          ${annotationenHtml}
        </table>` : ''}
      </div>`;
  }).join('\n');
}

function materialListeHtml(materialien: MaterialPosition[], projekt: Project): string {
  const system = getSystem(projekt.systemId);

  // Group by category
  const gruppen: Record<string, Array<{ pos: MaterialPosition; komp: GeruestKomponente }>> = {};
  for (const pos of materialien) {
    const komp = system.komponenten.find(k => k.id === pos.komponenteId);
    if (!komp) continue;
    const kat = komp.kategorie;
    if (!gruppen[kat]) gruppen[kat] = [];
    gruppen[kat].push({ pos, komp });
  }

  let posNr = 1;
  let gesamtgewicht = 0;

  const tabellenZeilen = Object.entries(gruppen).map(([kat, positionen]) => {
    const kategorieKopf = `<tr class="kategorie-kopf"><td colspan="6">${KATEGORIE_LABELS[kat as KomponentenKategorie] ?? kat}</td></tr>`;
    const zeilen = positionen.map(({ pos, komp }) => {
      const menge = pos.mengeManuell ?? pos.menge;
      const gewicht = komp.gewicht * menge;
      gesamtgewicht += gewicht;
      const zeile = `
        <tr>
          <td>${posNr++}</td>
          <td>${komp.artikelNummer ?? '–'}</td>
          <td>${komp.name}</td>
          <td class="zahl">${formatiereZahl(menge)}</td>
          <td>${pos.einheit}</td>
          <td class="zahl">${formatiereGewicht(gewicht)}</td>
        </tr>`;
      return zeile;
    }).join('');
    return kategorieKopf + zeilen;
  }).join('');

  return `
    <div class="seite material-seite">
      <h3>Materialliste</h3>
      <table class="material-tabelle">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Artikel-Nr.</th>
            <th>Bezeichnung</th>
            <th>Menge</th>
            <th>Einh.</th>
            <th>Gewicht</th>
          </tr>
        </thead>
        <tbody>
          ${tabellenZeilen}
          <tr class="summe-zeile">
            <td colspan="5"><strong>Gesamtgewicht (inkl. 5% Sicherheitszuschlag)</strong></td>
            <td class="zahl"><strong>${formatiereGewicht(gesamtgewicht)}</strong></td>
          </tr>
        </tbody>
      </table>
      <div class="unterschrift-block">
        <div class="unterschrift-feld">
          <div class="unterschrift-linie"></div>
          <div>Erstellt von: ________________________</div>
        </div>
        <div class="unterschrift-feld">
          <div class="unterschrift-linie"></div>
          <div>Geprüft von: ________________________</div>
        </div>
        <div class="unterschrift-feld">
          <div class="unterschrift-linie"></div>
          <div>Datum: ________________</div>
        </div>
      </div>
    </div>`;
}

const CSS = `
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; }
  body { font-size: 10pt; color: #212121; }
  .seite { page-break-before: always; padding: 8mm 0; }
  .deckblatt { page-break-before: avoid; }
  .deckblatt .firma { font-size: 14pt; font-weight: bold; color: #1565C0; margin-bottom: 8mm; }
  h1 { font-size: 20pt; color: #1565C0; margin-bottom: 2mm; }
  h2 { font-size: 14pt; color: #424242; margin-bottom: 8mm; }
  h3 { font-size: 12pt; color: #1565C0; margin-bottom: 4mm; }
  h4 { font-size: 10pt; color: #424242; margin-bottom: 2mm; }
  .info-tabelle { width: 100%; border-collapse: collapse; margin-bottom: 8mm; }
  .info-tabelle th { text-align: left; padding: 2mm 3mm; background: #E3F2FD; font-weight: bold; width: 40%; border: 0.3mm solid #BBDEFB; }
  .info-tabelle td { padding: 2mm 3mm; border: 0.3mm solid #BBDEFB; }
  .hinweis { font-size: 8pt; color: #666; border-top: 0.3mm solid #ccc; padding-top: 4mm; margin-top: 4mm; }
  .plan-svg { width: 100%; overflow: hidden; }
  .plan-svg svg { max-width: 100%; height: auto; }
  .plan-legende { display: flex; gap: 8mm; margin-top: 4mm; font-size: 8pt; }
  .legende-item::before { content: '—'; font-weight: bold; margin-right: 1mm; }
  .legende-item.blau::before { color: #1565C0; }
  .legende-item.hellblau::before { color: #B3E5FC; }
  .legende-item.orange::before { color: #F57F17; }
  .legende-item.rot::before { color: #D32F2F; }
  .foto-bereich { margin-bottom: 8mm; }
  .foto { width: 100%; max-height: 80mm; object-fit: contain; border: 0.3mm solid #ccc; }
  .messung-tabelle { width: 100%; border-collapse: collapse; font-size: 8pt; margin-top: 2mm; }
  .messung-tabelle th { background: #E3F2FD; padding: 1mm 2mm; border: 0.3mm solid #BBDEFB; }
  .messung-tabelle td { padding: 1mm 2mm; border: 0.3mm solid #E0E0E0; }
  .material-tabelle { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .material-tabelle thead tr { background: #1565C0; color: white; }
  .material-tabelle th { padding: 2mm 3mm; text-align: left; }
  .material-tabelle td { padding: 1.5mm 3mm; border-bottom: 0.2mm solid #E0E0E0; }
  .kategorie-kopf td { background: #BBDEFB; font-weight: bold; padding: 1.5mm 3mm; }
  .summe-zeile td { background: #E3F2FD; border-top: 0.5mm solid #1565C0; }
  .zahl { text-align: right; }
  .unterschrift-block { display: flex; gap: 8mm; margin-top: 12mm; }
  .unterschrift-feld { flex: 1; font-size: 8pt; }
  .unterschrift-linie { border-top: 0.3mm solid #333; margin-bottom: 1mm; }
`;

export interface PdfEingabe {
  projekt: Project;
  plan: GeruestPlan;
  materialien: MaterialPosition[];
  firmenname?: string;
  zeigePlanSeiten?: boolean;
  zeigeAnnotierteFoots?: boolean;
  zeigeMaterialliste?: boolean;
}

export function generierePdfHtml(eingabe: PdfEingabe): string {
  const {
    projekt,
    plan,
    materialien,
    firmenname,
    zeigePlanSeiten = true,
    zeigeAnnotierteFoots = true,
    zeigeMaterialliste = true,
  } = eingabe;

  const deckblatt = deckblattHtml(projekt, plan, firmenname);

  let planSeiten = '';
  if (zeigePlanSeiten) {
    for (const seitenPlan of plan.seiten) {
      const seite = projekt.seiten.find(s => s.id === seitenPlan.seitenId);
      if (!seite) continue;
      const svg = generiereSeitenElevationSVG(seitenPlan, seite, plan);
      planSeiten += planSeiteHtml(seite, svg);
    }
  }

  let fotoSeiten = '';
  if (zeigeAnnotierteFoots) {
    for (const seite of projekt.seiten) {
      if (seite.fotos.length > 0) {
        fotoSeiten += fotoSeiteHtml(seite);
      }
    }
  }

  let materialSeite = '';
  if (zeigeMaterialliste) {
    materialSeite = materialListeHtml(materialien, projekt);
  }

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gerüstplanung – ${projekt.name}</title>
  <style>${CSS}</style>
</head>
<body>
  ${deckblatt}
  ${planSeiten}
  ${fotoSeiten}
  ${materialSeite}
</body>
</html>`;
}
