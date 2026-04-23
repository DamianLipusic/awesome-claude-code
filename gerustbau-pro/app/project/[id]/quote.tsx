import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Text, Card, Button, TextInput, Divider,
  ActivityIndicator, HelperText,
} from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useProjektStore } from '../../../src/store/projectStore';
import { useCostsStore } from '../../../src/store/costsStore';
import { useEinstellungenStore } from '../../../src/store/settingsStore';
import { berechneMaterialien } from '../../../src/algorithms/materialCalculator';
import { getSystem } from '../../../src/data/systems';
import type { KomponentenKategorie } from '../../../src/data/systems';
import { formatiereDatum } from '../../../src/utils/formatters';

const KATEGORIE_LABELS: Record<KomponentenKategorie, string> = {
  rahmen: 'Rahmen', riegel: 'Riegel', diagonale: 'Diagonalen',
  belag: 'Beläge', gelaender: 'Geländer', bordbrett: 'Bordbretter',
  fussplatte: 'Fußplatten', spindel: 'Spindeln', anker: 'Verankerung',
  treppe: 'Treppen', rohr: 'Rohre', kupplung: 'Kupplungen', sonstiges: 'Sonstiges',
};

function formatiereEUR(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function generiereAngebotsnummer(): string {
  const d = new Date();
  return `A-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 900) + 100}`;
}

function gueltigBisDatum(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export default function AngebotScreen() {
  const { id: projektId } = useLocalSearchParams<{ id: string }>();
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const aktiverPlan = useProjektStore(s => s.aktiverPlan);
  const aktiveMaterialien = useProjektStore(s => s.aktiveMaterialien);
  const { preise } = useCostsStore();
  const einstellungen = useEinstellungenStore();

  const [angebotsnummer, setAngebotsnummer] = useState(generiereAngebotsnummer);
  const [gueltigBis, setGueltigBis] = useState(gueltigBisDatum);
  const [zahlungsbedingungen, setZahlungsbedingungen] = useState('30 Tage netto');
  const [leistungsbeschreibung, setLeistungsbeschreibung] = useState('');
  const [exportLaeuft, setExportLaeuft] = useState(false);

  if (!projekt) return null;

  // Calculate materials
  let materialien = aktiveMaterialien;
  if (!materialien || materialien.length === 0) {
    try {
      const ergebnis = berechneMaterialien({
        seiten: projekt.seiten,
        systemId: projekt.systemId,
        arbeitshoehe: projekt.arbeitshoehe,
      });
      materialien = ergebnis.materialien;
    } catch {
      materialien = [];
    }
  }

  const system = getSystem(projekt.systemId);

  // Build line items grouped by category
  interface Posten { kategorie: string; bezeichnung: string; menge: number; einheit: string; einzelpreis: number; gesamt: number }
  const posten: Posten[] = [];
  const gruppenSummen: Record<string, number> = {};

  for (const pos of materialien) {
    const komp = system.komponenten.find(k => k.id === pos.komponenteId);
    if (!komp) continue;
    const menge = pos.mengeManuell ?? pos.menge;
    const preis = preise[pos.komponenteId] ?? 0;
    const gesamt = preis * menge;
    posten.push({
      kategorie: KATEGORIE_LABELS[komp.kategorie] ?? komp.kategorie,
      bezeichnung: komp.name,
      menge,
      einheit: pos.einheit,
      einzelpreis: preis,
      gesamt,
    });
    gruppenSummen[komp.kategorie] = (gruppenSummen[komp.kategorie] ?? 0) + gesamt;
  }

  const netto = posten.reduce((s, p) => s + p.gesamt, 0);
  const mwst = netto * 0.19;
  const brutto = netto + mwst;
  const hatPreise = netto > 0;

  async function exportieren() {
    setExportLaeuft(true);
    try {
      const html = generiereAngebotHtml();
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Angebot ${angebotsnummer}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Gespeichert', `PDF: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Fehler', 'PDF konnte nicht erstellt werden.');
    } finally {
      setExportLaeuft(false);
    }
  }

  function generiereAngebotHtml(): string {
    const heut = formatiereDatum(new Date());
    const bis = gueltigBis
      ? formatiereDatum(new Date(gueltigBis + 'T00:00:00'))
      : '–';
    const firma = einstellungen.firmenname || 'Gerüstbau Pro';
    const firmaAdr = einstellungen.firmenadresse || '';
    const firmaTel = einstellungen.firmentelefon || '';
    const firmaMail = einstellungen.firmenemail || '';

    const gruppenHtml = Object.entries(
      posten.reduce<Record<string, Posten[]>>((acc, p) => {
        (acc[p.kategorie] = acc[p.kategorie] ?? []).push(p);
        return acc;
      }, {})
    ).map(([kat, items]) => {
      const zeilen = items.map(it => `
        <tr>
          <td>${it.bezeichnung}</td>
          <td class="r">${it.menge % 1 === 0 ? it.menge : it.menge.toFixed(1)}</td>
          <td>${it.einheit}</td>
          <td class="r">${formatiereEUR(it.einzelpreis)}</td>
          <td class="r">${formatiereEUR(it.gesamt)}</td>
        </tr>`).join('');
      const sum = items.reduce((s, i) => s + i.gesamt, 0);
      return `<tr class="kat"><td colspan="4">${kat}</td><td class="r">${formatiereEUR(sum)}</td></tr>${zeilen}`;
    }).join('');

    const leistungHtml = leistungsbeschreibung.trim()
      ? `<p class="leistung">${leistungsbeschreibung.replace(/\n/g, '<br>')}</p>`
      : `<p class="leistung">Lieferung und Montage von Gerüstmaterial gem. Leistungsverzeichnis, System: ${projekt!.systemId.replace('-', ' ').toUpperCase()}, Objekt: ${projekt!.adresse ?? projekt!.name}</p>`;

    return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 10pt; color: #212121; }
  .kopf { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10mm; }
  .firma-name { font-size: 16pt; font-weight: bold; color: #1565C0; }
  .firma-detail { font-size: 9pt; color: #555; margin-top: 1mm; }
  .angebots-title { font-size: 18pt; font-weight: bold; color: #1565C0; margin-bottom: 6mm; }
  .meta-tabelle { border-collapse: collapse; width: 100%; margin-bottom: 8mm; }
  .meta-tabelle td { padding: 1mm 2mm; }
  .meta-tabelle .key { color: #888; width: 40mm; font-size: 9pt; }
  .empfaenger { margin-bottom: 8mm; border: 0.3mm solid #BBDEFB; padding: 4mm; background: #F5F5F5; }
  .empfaenger-titel { font-size: 8pt; color: #888; margin-bottom: 2mm; }
  .leistung { margin: 4mm 0 6mm 0; color: #444; line-height: 1.5; }
  table.pos { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  table.pos thead tr { background: #1565C0; color: white; }
  table.pos th, table.pos td { padding: 1.5mm 2mm; border-bottom: 0.2mm solid #E0E0E0; }
  table.pos th { text-align: left; font-size: 9pt; }
  table.pos .kat td { background: #E3F2FD; font-weight: bold; color: #1565C0; font-size: 9pt; }
  .r { text-align: right; }
  .summe-block { margin-top: 4mm; margin-left: auto; width: 80mm; }
  .summe-zeile { display: flex; justify-content: space-between; padding: 1mm 0; }
  .summe-gesamt { font-weight: bold; font-size: 12pt; color: #1565C0; border-top: 0.5mm solid #1565C0; padding-top: 2mm; margin-top: 2mm; }
  .bedingungen { margin-top: 8mm; font-size: 8pt; color: #555; line-height: 1.6; }
  .bedingungen strong { color: #333; }
  .unterschrift { display: flex; gap: 10mm; margin-top: 14mm; }
  .unterschrift-feld { flex: 1; border-top: 0.3mm solid #333; padding-top: 1mm; font-size: 8pt; color: #555; }
  .hinweis { margin-top: 10mm; font-size: 7.5pt; color: #888; border-top: 0.3mm solid #ddd; padding-top: 3mm; }
</style>
</head>
<body>
<div class="kopf">
  <div>
    <div class="firma-name">${firma}</div>
    ${firmaAdr ? `<div class="firma-detail">${firmaAdr}</div>` : ''}
    ${firmaTel ? `<div class="firma-detail">Tel: ${firmaTel}</div>` : ''}
    ${firmaMail ? `<div class="firma-detail">${firmaMail}</div>` : ''}
  </div>
  <div style="text-align:right; font-size:9pt; color:#888">
    <div>${heut}</div>
    <div>Angebots-Nr.: <strong>${angebotsnummer}</strong></div>
  </div>
</div>

<div class="empfaenger">
  <div class="empfaenger-titel">AUFTRAGGEBER</div>
  <div><strong>${projekt!.auftraggeber || '–'}</strong></div>
  ${projekt!.adresse ? `<div style="font-size:9pt;color:#555">${projekt!.adresse}</div>` : ''}
</div>

<h1 class="angebots-title">Angebot</h1>

<table class="meta-tabelle">
  <tr><td class="key">Objekt / Projekt</td><td><strong>${projekt!.name}</strong></td></tr>
  ${projekt!.adresse ? `<tr><td class="key">Adresse</td><td>${projekt!.adresse}</td></tr>` : ''}
  <tr><td class="key">Gerüstsystem</td><td>${projekt!.systemId.replace('-', ' ').toUpperCase()}</td></tr>
  <tr><td class="key">Gerüsthöhe</td><td>${projekt!.gesamthoehe.toFixed(2)} m</td></tr>
  <tr><td class="key">Gültig bis</td><td>${bis}</td></tr>
  <tr><td class="key">Zahlungsbedingungen</td><td>${zahlungsbedingungen}</td></tr>
</table>

<p style="font-size:9pt;font-weight:bold;margin-bottom:2mm">Leistungsbeschreibung:</p>
${leistungHtml}

${posten.length > 0 ? `
<table class="pos">
  <thead>
    <tr>
      <th>Bezeichnung</th>
      <th class="r">Menge</th>
      <th>Einh.</th>
      <th class="r">Einzelpreis</th>
      <th class="r">Gesamt</th>
    </tr>
  </thead>
  <tbody>${gruppenHtml}</tbody>
</table>

<div class="summe-block">
  <div class="summe-zeile"><span>Nettobetrag</span><span>${formatiereEUR(netto)}</span></div>
  <div class="summe-zeile"><span>MwSt. 19 %</span><span>${formatiereEUR(mwst)}</span></div>
  <div class="summe-zeile summe-gesamt"><span>Gesamtbetrag brutto</span><span>${formatiereEUR(brutto)}</span></div>
</div>` : `<p style="color:#888;font-size:9pt;margin:4mm 0">Kein Materialpreise hinterlegt – bitte zuerst Kostenschätzung ausfüllen.</p>`}

<div class="bedingungen">
  <strong>Zahlungsbedingungen:</strong> ${zahlungsbedingungen}<br>
  <strong>Gültigkeit:</strong> Dieses Angebot ist gültig bis ${bis}.<br>
  Preise verstehen sich zzgl. gesetzlicher Mehrwertsteuer.<br>
  Lieferung und Montage nach Vereinbarung.
</div>

<div class="unterschrift">
  <div class="unterschrift-feld">Anbieter: ${firma}<br><br></div>
  <div class="unterschrift-feld">Datum: ________________</div>
  <div class="unterschrift-feld">Auftraggeber (Unterschrift): ________________</div>
</div>

<div class="hinweis">
  Erstellt mit Gerüstbau Pro · Alle Preise sind Schätzwerte auf Basis der eingegebenen Materialliste.
  Maßgeblich ist das unterzeichnete Angebot. Irrtümer vorbehalten.
</div>
</body>
</html>`;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>

      {/* Preview card */}
      <Card style={styles.previewCard}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.projektName}>{projekt.name}</Text>
          {projekt.auftraggeber && (
            <Text variant="bodySmall" style={styles.meta}>Auftraggeber: {projekt.auftraggeber}</Text>
          )}
          <Text variant="bodySmall" style={styles.meta}>Heute: {formatiereDatum(new Date())}</Text>
          {hatPreise ? (
            <Text variant="titleLarge" style={styles.brutto}>{formatiereEUR(brutto)} (brutto)</Text>
          ) : (
            <Text variant="bodySmall" style={styles.warnung}>
              ⚠️ Noch keine Preise hinterlegt — Kostenschätzung zuerst ausfüllen
            </Text>
          )}
        </Card.Content>
      </Card>

      {/* Angebot fields */}
      <Text variant="titleMedium" style={styles.sectionTitle}>Angebotsdaten</Text>
      <Card style={styles.card}>
        <Card.Content>
          <TextInput
            label="Angebots-Nr."
            value={angebotsnummer}
            onChangeText={setAngebotsnummer}
            mode="outlined"
            style={styles.input}
            left={<TextInput.Icon icon="file-document-outline" />}
          />
          <TextInput
            label="Gültig bis (JJJJ-MM-TT)"
            value={gueltigBis}
            onChangeText={setGueltigBis}
            mode="outlined"
            style={styles.input}
            keyboardType="numbers-and-punctuation"
            left={<TextInput.Icon icon="calendar" />}
          />
          <TextInput
            label="Zahlungsbedingungen"
            value={zahlungsbedingungen}
            onChangeText={setZahlungsbedingungen}
            mode="outlined"
            style={styles.input}
            placeholder="z.B. 30 Tage netto, 14 Tage 2% Skonto"
            left={<TextInput.Icon icon="bank" />}
          />
          <TextInput
            label="Leistungsbeschreibung (optional)"
            value={leistungsbeschreibung}
            onChangeText={setLeistungsbeschreibung}
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={3}
            placeholder="Leer lassen für Standardtext"
            left={<TextInput.Icon icon="text" />}
          />
          <HelperText type="info">
            Firmenname und Kontaktdaten werden aus den Einstellungen übernommen.
          </HelperText>
        </Card.Content>
      </Card>

      {/* Summary */}
      {hatPreise && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>Preisübersicht</Text>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sumRow}>
                <Text variant="bodyLarge">Netto</Text>
                <Text variant="bodyLarge">{formatiereEUR(netto)}</Text>
              </View>
              <View style={styles.sumRow}>
                <Text variant="bodyMedium" style={styles.grau}>MwSt. 19 %</Text>
                <Text variant="bodyMedium" style={styles.grau}>{formatiereEUR(mwst)}</Text>
              </View>
              <Divider style={{ marginVertical: 6 }} />
              <View style={styles.sumRow}>
                <Text variant="titleMedium" style={styles.blau}>Brutto</Text>
                <Text variant="titleMedium" style={styles.blau}>{formatiereEUR(brutto)}</Text>
              </View>
            </Card.Content>
          </Card>
        </>
      )}

      <Button
        mode="contained"
        icon={exportLaeuft ? undefined : 'file-pdf-box'}
        onPress={exportieren}
        disabled={exportLaeuft}
        style={styles.exportBtn}
        contentStyle={styles.exportBtnInhalt}
      >
        {exportLaeuft ? <ActivityIndicator color="white" size="small" /> : 'Angebot als PDF erstellen'}
      </Button>

      <Text variant="bodySmall" style={styles.hinweis}>
        Das PDF wird lokal erstellt und kann per E-Mail, WhatsApp oder AirDrop geteilt werden.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 16, paddingBottom: 40 },
  previewCard: { marginBottom: 16, elevation: 3, backgroundColor: '#1565C0' },
  projektName: { color: 'white', fontWeight: 'bold', marginBottom: 4 },
  meta: { color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  brutto: { color: 'white', fontWeight: 'bold', marginTop: 8 },
  warnung: { color: '#FFD54F', marginTop: 6 },
  sectionTitle: { fontWeight: 'bold', color: '#1565C0', marginBottom: 8, marginTop: 4 },
  card: { marginBottom: 16, elevation: 1 },
  input: { backgroundColor: 'white', marginBottom: 8 },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grau: { color: '#888' },
  blau: { fontWeight: 'bold', color: '#1565C0' },
  exportBtn: { backgroundColor: '#1565C0', marginBottom: 12 },
  exportBtnInhalt: { height: 56 },
  hinweis: { color: '#888', textAlign: 'center' },
});
