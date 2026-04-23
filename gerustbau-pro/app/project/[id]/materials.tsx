import { useState, useEffect } from 'react';
import { View, SectionList, StyleSheet, Alert } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Button, Divider, Dialog, Portal, List, IconButton, TextInput } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useProjektStore } from '../../../src/store/projectStore';
import { berechneMaterialien } from '../../../src/algorithms/materialCalculator';
import { getSystem } from '../../../src/data/systems';
import type { MaterialPosition } from '../../../src/models/Project';
import type { KomponentenKategorie } from '../../../src/data/systems';
import { formatiereGewicht, formatiereZahl } from '../../../src/utils/formatters';

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

const KATEGORIE_REIHENFOLGE: KomponentenKategorie[] = [
  'rahmen', 'riegel', 'diagonale', 'belag', 'gelaender', 'bordbrett',
  'spindel', 'fussplatte', 'anker', 'treppe', 'rohr', 'kupplung', 'sonstiges',
];

type Lastklasse = '2' | '3' | '4' | '5' | '6';

const LASTKLASSEN: { value: Lastklasse; label: string; beschreibung: string }[] = [
  { value: '2', label: 'LK 2', beschreibung: '1,5 kN/m² · Inspektionsgerüst' },
  { value: '3', label: 'LK 3', beschreibung: '2,0 kN/m² · Arbeitsgerüst leicht' },
  { value: '4', label: 'LK 4', beschreibung: '3,0 kN/m² · Arbeitsgerüst schwer' },
  { value: '5', label: 'LK 5', beschreibung: '4,5 kN/m² · Schwerlastgerüst' },
  { value: '6', label: 'LK 6', beschreibung: '6,0 kN/m² · Sonderlastgerüst' },
];

export default function MaterialListe() {
  const { id: projektId } = useLocalSearchParams<{ id: string }>();
  const [laden, setLaden] = useState(true);
  const [warnungen, setWarnungen] = useState<string[]>([]);
  const [lastklasse, setLastklasse] = useState<Lastklasse>('3');
  const [lkOffen, setLkOffen] = useState(false);
  const [bearbeitetePos, setBearbeitetePos] = useState<MaterialPosition | null>(null);
  const [mengeEingabe, setMengeEingabe] = useState('');

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const setzePlan = useProjektStore(s => s.setzePlan);
  const aktiverPlan = useProjektStore(s => s.aktiverPlan);
  const aktiveMaterialien = useProjektStore(s => s.aktiveMaterialien);
  const aktualisiereMaterieMenge = useProjektStore(s => s.aktualisiereMaterieMenge);

  function neuBerechnen(lk: Lastklasse) {
    if (!projekt) return;
    setLaden(true);
    const ergebnis = berechneMaterialien({
      seiten: projekt.seiten,
      systemId: projekt.systemId,
      arbeitshoehe: projekt.arbeitshoehe,
      lastklasse: lk,
    });
    ergebnis.plan.projektId = projekt.id;
    setzePlan(ergebnis.plan, ergebnis.materialien);
    setWarnungen(ergebnis.warnungen);
    setLaden(false);
  }

  function aendereLastklasse(lk: Lastklasse) {
    setLastklasse(lk);
    setLkOffen(false);
    neuBerechnen(lk);
  }

  useEffect(() => {
    if (!projekt) return;
    const ergebnis = berechneMaterialien({
      seiten: projekt.seiten,
      systemId: projekt.systemId,
      arbeitshoehe: projekt.arbeitshoehe,
      lastklasse,
    });
    ergebnis.plan.projektId = projekt.id;
    setzePlan(ergebnis.plan, ergebnis.materialien);
    setWarnungen(ergebnis.warnungen);
    setLaden(false);
  }, [projektId]);

  if (laden || !projekt) {
    return <ActivityIndicator style={styles.loading} size="large" />;
  }

  const system = getSystem(projekt.systemId);

  const gruppierteMaterialien = KATEGORIE_REIHENFOLGE
    .map(kat => {
      const pos = aktiveMaterialien.filter(m => {
        const komp = system.komponenten.find(k => k.id === m.komponenteId);
        return komp?.kategorie === kat;
      });
      return { title: KATEGORIE_LABELS[kat], kategorie: kat, data: pos };
    })
    .filter(g => g.data.length > 0);

  const effektiveMaterialien = aktiveMaterialien.map(pos => ({
    ...pos,
    effektivMenge: pos.mengeManuell ?? pos.menge,
  }));

  const gesamtgewicht = effektiveMaterialien.reduce((sum, pos) => {
    const komp = system.komponenten.find(k => k.id === pos.komponenteId);
    return sum + (komp?.gewicht ?? 0) * pos.effektivMenge;
  }, 0);
  const gesamtPositionen = aktiveMaterialien.length;
  const ueberschriebeneAnzahl = aktiveMaterialien.filter(p => p.mengeManuell !== undefined).length;

  function oeffneBearbeiten(item: MaterialPosition) {
    const effektiv = item.mengeManuell ?? item.menge;
    setMengeEingabe(String(effektiv));
    setBearbeitetePos(item);
  }

  function speichereManuellerMenge() {
    if (!bearbeitetePos) return;
    const num = parseFloat(mengeEingabe.replace(',', '.'));
    if (isNaN(num) || num < 0) {
      Alert.alert('Ungültige Eingabe', 'Bitte eine gültige Menge eingeben.');
      return;
    }
    aktualisiereMaterieMenge(bearbeitetePos.id, num);
    setBearbeitetePos(null);
  }

  function setzeZurueck() {
    if (!bearbeitetePos) return;
    aktualisiereMaterieMenge(bearbeitetePos.id, undefined);
    setBearbeitetePos(null);
  }

  async function exportiereCsv() {
    const zeilen = ['Pos.;Artikel-Nr.;Bezeichnung;Menge;Einheit;Gewicht kg'];
    aktiveMaterialien.forEach((item, idx) => {
      const komp = system.komponenten.find(k => k.id === item.komponenteId);
      if (!komp) return;
      const effektiv = item.mengeManuell ?? item.menge;
      zeilen.push([
        idx + 1,
        komp.artikelNummer ?? '',
        `"${komp.name}"`,
        effektiv,
        item.einheit,
        (komp.gewicht * effektiv).toFixed(1),
      ].join(';'));
    });
    const csvInhalt = zeilen.join('\n');
    const dateiPfad = FileSystem.documentDirectory + `materialliste_${projektId}.csv`;
    try {
      await FileSystem.writeAsStringAsync(dateiPfad, csvInhalt, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      await Sharing.shareAsync(dateiPfad, {
        mimeType: 'text/csv',
        dialogTitle: 'Materialliste exportieren',
        UTI: 'public.comma-separated-values-text',
      });
    } catch (err) {
      Alert.alert('Fehler', 'CSV-Export fehlgeschlagen.');
      console.error(err);
    }
  }

  function renderItem({ item }: { item: MaterialPosition }) {
    const komp = system.komponenten.find(k => k.id === item.komponenteId);
    if (!komp) return null;
    const effektiv = item.mengeManuell ?? item.menge;
    const hatOverride = item.mengeManuell !== undefined;
    return (
      <View style={styles.positionReihe}>
        <View style={styles.positionInfo}>
          <Text variant="bodyMedium" style={styles.positionName}>{komp.name}</Text>
          {komp.artikelNummer && (
            <Text variant="bodySmall" style={styles.artikelNummer}>Art. {komp.artikelNummer}</Text>
          )}
        </View>
        <View style={styles.positionMenge}>
          <Text
            variant="titleMedium"
            style={[styles.menge, hatOverride && styles.mengeOverride]}
          >
            {formatiereZahl(effektiv)}
          </Text>
          <Text variant="bodySmall" style={styles.einheit}>{item.einheit}</Text>
          {hatOverride && (
            <Text variant="bodySmall" style={styles.originalMenge}>
              ({formatiereZahl(item.menge)})
            </Text>
          )}
        </View>
        <View style={styles.positionGewicht}>
          <Text variant="bodySmall" style={styles.gewicht}>{formatiereGewicht(komp.gewicht * effektiv)}</Text>
        </View>
        <IconButton
          icon="pencil"
          size={16}
          onPress={() => oeffneBearbeiten(item)}
          style={styles.editIcon}
          iconColor={hatOverride ? '#F57F17' : '#9E9E9E'}
        />
      </View>
    );
  }

  function renderSectionHeader({ section }: { section: { title: string } }) {
    return (
      <View style={styles.sectionKopf}>
        <Text variant="titleSmall" style={styles.sectionTitel}>{section.title}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.summaryKarte}>
        <Card.Content>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text variant="headlineSmall" style={styles.summaryWert}>{gesamtPositionen}</Text>
              <Text variant="bodySmall" style={styles.summaryLabel}>Positionen</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text variant="headlineSmall" style={styles.summaryWert}>{formatiereGewicht(gesamtgewicht)}</Text>
              <Text variant="bodySmall" style={styles.summaryLabel}>Gesamtgewicht</Text>
            </View>
            <View style={styles.summaryItem}>
              <Button
                mode="outlined"
                compact
                onPress={() => setLkOffen(true)}
                style={styles.lkButton}
              >
                LK {lastklasse}
              </Button>
              <Text variant="bodySmall" style={styles.summaryLabel}>Lastklasse</Text>
            </View>
          </View>
          {ueberschriebeneAnzahl > 0 && (
            <Chip icon="pencil" style={styles.overrideChip} textStyle={{ color: '#F57F17', fontSize: 11 }}>
              {ueberschriebeneAnzahl} Menge(n) manuell angepasst
            </Chip>
          )}
          {warnungen.length > 0 && (
            <Chip icon="alert" style={styles.warnungChip} textStyle={{ color: '#F57F17' }}>
              {warnungen.length} Hinweis(e) – Nicht alle Seiten vollständig
            </Chip>
          )}
          <Button
            mode="outlined"
            icon="file-delimited"
            onPress={exportiereCsv}
            style={styles.csvButton}
            compact
          >
            CSV exportieren
          </Button>
        </Card.Content>
      </Card>

      <View style={styles.tabellenkopf}>
        <Text style={[styles.tabellenkopfText, { flex: 3 }]}>Bezeichnung</Text>
        <Text style={[styles.tabellenkopfText, { flex: 1, textAlign: 'right' }]}>Menge</Text>
        <Text style={[styles.tabellenkopfText, { flex: 1, textAlign: 'right' }]}>Gewicht</Text>
        <Text style={[styles.tabellenkopfText, { width: 36 }]}> </Text>
      </View>
      <Divider />

      <SectionList
        sections={gruppierteMaterialien}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.liste}
        stickySectionHeadersEnabled={false}
      />

      <Portal>
        {/* Load class dialog */}
        <Dialog visible={lkOffen} onDismiss={() => setLkOffen(false)}>
          <Dialog.Title>Lastklasse wählen</Dialog.Title>
          <Dialog.Content>
            {LASTKLASSEN.map(lk => (
              <List.Item
                key={lk.value}
                title={lk.label}
                description={lk.beschreibung}
                left={props => (
                  <List.Icon {...props} icon={lastklasse === lk.value ? 'radiobox-marked' : 'radiobox-blank'} color="#1565C0" />
                )}
                onPress={() => aendereLastklasse(lk.value)}
                style={lastklasse === lk.value ? styles.lkAktiv : undefined}
              />
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLkOffen(false)}>Schließen</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Manual quantity override dialog */}
        <Dialog visible={bearbeitetePos !== null} onDismiss={() => setBearbeitetePos(null)}>
          <Dialog.Title>Menge anpassen</Dialog.Title>
          <Dialog.Content>
            {bearbeitetePos && (() => {
              const komp = system.komponenten.find(k => k.id === bearbeitetePos.komponenteId);
              return (
                <>
                  <Text variant="bodyMedium" style={styles.editKompName}>{komp?.name}</Text>
                  <Text variant="bodySmall" style={styles.editHinweis}>
                    Berechnete Menge: {formatiereZahl(bearbeitetePos.menge)} {bearbeitetePos.einheit}
                  </Text>
                  <TextInput
                    label={`Menge (${bearbeitetePos.einheit})`}
                    value={mengeEingabe}
                    onChangeText={setMengeEingabe}
                    mode="outlined"
                    keyboardType="decimal-pad"
                    autoFocus
                    style={styles.editEingabe}
                  />
                </>
              );
            })()}
          </Dialog.Content>
          <Dialog.Actions>
            {bearbeitetePos?.mengeManuell !== undefined && (
              <Button onPress={setzeZurueck} textColor="#D32F2F">Zurücksetzen</Button>
            )}
            <Button onPress={() => setBearbeitetePos(null)}>Abbrechen</Button>
            <Button mode="contained" onPress={speichereManuellerMenge}>Übernehmen</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  loading: { flex: 1, alignSelf: 'center', marginTop: 80 },
  summaryKarte: { margin: 12, elevation: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryWert: { fontWeight: 'bold', color: '#1565C0' },
  summaryLabel: { color: '#666', marginTop: 2 },
  warnungChip: { marginTop: 8, backgroundColor: '#FFF3E0' },
  overrideChip: { marginTop: 8, backgroundColor: '#FFF8E1' },
  csvButton: { marginTop: 10, borderColor: '#1565C0' },
  tabellenkopf: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#E3F2FD' },
  tabellenkopfText: { fontSize: 12, fontWeight: 'bold', color: '#1565C0' },
  sectionKopf: { backgroundColor: '#BBDEFB', paddingHorizontal: 16, paddingVertical: 6 },
  sectionTitel: { fontWeight: 'bold', color: '#1565C0' },
  positionReihe: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, paddingVertical: 8, backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  positionInfo: { flex: 3 },
  positionName: { fontWeight: '500' },
  artikelNummer: { color: '#888', marginTop: 2 },
  positionMenge: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  menge: { fontWeight: 'bold', color: '#1565C0' },
  mengeOverride: { color: '#F57F17' },
  originalMenge: { color: '#9E9E9E', fontSize: 10 },
  einheit: { color: '#666' },
  positionGewicht: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  gewicht: { color: '#666' },
  editIcon: { margin: 0, width: 32, height: 32 },
  liste: { paddingBottom: 40 },
  lkButton: { borderColor: '#1565C0' },
  lkAktiv: { backgroundColor: '#E3F2FD' },
  editKompName: { fontWeight: 'bold', marginBottom: 4 },
  editHinweis: { color: '#666', marginBottom: 12 },
  editEingabe: { marginBottom: 4 },
});
