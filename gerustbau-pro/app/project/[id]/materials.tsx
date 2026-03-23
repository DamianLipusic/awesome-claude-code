import { useState, useEffect } from 'react';
import { View, SectionList, StyleSheet } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
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

export default function MaterialListe() {
  const { id: projektId } = useLocalSearchParams<{ id: string }>();
  const [laden, setLaden] = useState(true);
  const [warnungen, setWarnungen] = useState<string[]>([]);

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const setzePlan = useProjektStore(s => s.setzePlan);
  const aktiverPlan = useProjektStore(s => s.aktiverPlan);
  const aktiveMaterialien = useProjektStore(s => s.aktiveMaterialien);

  useEffect(() => {
    if (!projekt) return;

    const ergebnis = berechneMaterialien({
      seiten: projekt.seiten,
      systemId: projekt.systemId,
      arbeitshoehe: projekt.arbeitshoehe,
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

  // Group materials by category
  const gruppierteMaterialien = KATEGORIE_REIHENFOLGE
    .map(kat => {
      const pos = aktiveMaterialien.filter(m => {
        const komp = system.komponenten.find(k => k.id === m.komponenteId);
        return komp?.kategorie === kat;
      });
      return { title: KATEGORIE_LABELS[kat], kategorie: kat, data: pos };
    })
    .filter(g => g.data.length > 0);

  const gesamtgewicht = aktiverPlan?.gesamtgewicht ?? 0;
  const gesamtPositionen = aktiveMaterialien.length;

  function renderItem({ item }: { item: MaterialPosition }) {
    const komp = system.komponenten.find(k => k.id === item.komponenteId);
    if (!komp) return null;
    return (
      <View style={styles.positionReihe}>
        <View style={styles.positionInfo}>
          <Text variant="bodyMedium" style={styles.positionName}>{komp.name}</Text>
          {komp.artikelNummer && (
            <Text variant="bodySmall" style={styles.artikelNummer}>Art. {komp.artikelNummer}</Text>
          )}
        </View>
        <View style={styles.positionMenge}>
          <Text variant="titleMedium" style={styles.menge}>{formatiereZahl(item.menge)}</Text>
          <Text variant="bodySmall" style={styles.einheit}>{item.einheit}</Text>
        </View>
        <View style={styles.positionGewicht}>
          <Text variant="bodySmall" style={styles.gewicht}>{formatiereGewicht(komp.gewicht * item.menge)}</Text>
        </View>
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
              <Text variant="headlineSmall" style={styles.summaryWert}>LK {aktiverPlan?.lastklasse ?? '3'}</Text>
              <Text variant="bodySmall" style={styles.summaryLabel}>Lastklasse</Text>
            </View>
          </View>
          {warnungen.length > 0 && (
            <Chip icon="alert" style={styles.warnungChip} textStyle={{ color: '#F57F17' }}>
              {warnungen.length} Hinweis(e) – Nicht alle Seiten vollständig
            </Chip>
          )}
        </Card.Content>
      </Card>

      <View style={styles.tabellenkopf}>
        <Text style={[styles.tabellenkopfText, { flex: 3 }]}>Bezeichnung</Text>
        <Text style={[styles.tabellenkopfText, { flex: 1, textAlign: 'right' }]}>Menge</Text>
        <Text style={[styles.tabellenkopfText, { flex: 1, textAlign: 'right' }]}>Gewicht</Text>
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
  tabellenkopf: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#E3F2FD' },
  tabellenkopfText: { fontSize: 12, fontWeight: 'bold', color: '#1565C0' },
  sectionKopf: { backgroundColor: '#BBDEFB', paddingHorizontal: 16, paddingVertical: 6 },
  sectionTitel: { fontWeight: 'bold', color: '#1565C0' },
  positionReihe: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: 0.5, borderBottomColor: '#E0E0E0' },
  positionInfo: { flex: 3 },
  positionName: { fontWeight: '500' },
  artikelNummer: { color: '#888', marginTop: 2 },
  positionMenge: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  menge: { fontWeight: 'bold', color: '#1565C0' },
  einheit: { color: '#666' },
  positionGewicht: { flex: 1, alignItems: 'flex-end', justifyContent: 'center' },
  gewicht: { color: '#666' },
  liste: { paddingBottom: 40 },
});
