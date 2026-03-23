import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, FAB, Chip, ProgressBar, IconButton } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useProjektStore } from '../../../src/store/projectStore';
import type { BausteinSeite } from '../../../src/models/Project';

const SEITEN_LABELS = ['Nord', 'Süd', 'Ost', 'West', 'Seite A', 'Seite B', 'Seite C', 'Seite D'];
const SEITEN_WERTE = ['nord', 'sued', 'ost', 'west', 'seite-a', 'seite-b', 'seite-c', 'seite-d'] as const;

function MessungsStatusChip({ status }: { status: BausteinSeite['messungStatus'] }) {
  const config = {
    fehlend: { label: 'Fehlend', color: '#D32F2F' },
    unvollstaendig: { label: 'Unvollständig', color: '#F57F17' },
    vollstaendig: { label: 'Vollständig', color: '#2E7D32' },
  }[status];
  return <Chip compact style={{ backgroundColor: config.color }} textStyle={{ color: 'white', fontSize: 11 }}>{config.label}</Chip>;
}

function SeitenKarte({ seite, projektId }: { seite: BausteinSeite; projektId: string }) {
  return (
    <Card style={styles.seitenKarte}>
      <Card.Content>
        <View style={styles.seitenKopf}>
          <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{seite.anzeigename}</Text>
          <MessungsStatusChip status={seite.messungStatus} />
        </View>
        <Text variant="bodySmall" style={styles.seitenInfo}>
          {seite.fotos.length} Foto(s) · {seite.messungen.length} Messung(en) · {seite.oeffnungen.length} Öffnung(en)
        </Text>
      </Card.Content>
      <Card.Actions>
        <Button
          compact
          mode="outlined"
          icon="camera"
          onPress={() => router.push({ pathname: `/project/${projektId}/capture`, params: { seitenId: seite.id } })}
        >
          Foto
        </Button>
        {seite.fotos.length > 0 && (
          <Button
            compact
            mode="outlined"
            icon="pencil-ruler"
            onPress={() => router.push({ pathname: `/project/${projektId}/annotate/${seite.fotos[0].id}`, params: { seitenId: seite.id } })}
          >
            Maße
          </Button>
        )}
        <Button
          compact
          mode="outlined"
          icon="check-circle"
          onPress={() => router.push({ pathname: `/project/${projektId}/measurements`, params: { seitenId: seite.id } })}
        >
          Prüfen
        </Button>
      </Card.Actions>
    </Card>
  );
}

export default function ProjektUebersicht() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === id));
  const fuegeSeiteHinzu = useProjektStore(s => s.fuegeSeiteHinzu);

  if (!projekt) {
    return (
      <View style={styles.fehler}>
        <Text>Projekt nicht gefunden.</Text>
      </View>
    );
  }

  const vollstaendig = projekt.seiten.filter(s => s.messungStatus === 'vollstaendig').length;
  const fortschritt = projekt.seiten.length > 0 ? vollstaendig / projekt.seiten.length : 0;

  function neueSeite() {
    const naechsteIndex = projekt!.seiten.length;
    if (naechsteIndex >= SEITEN_WERTE.length) {
      Alert.alert('Maximale Anzahl', 'Es können maximal 8 Seiten erfasst werden.');
      return;
    }
    const label = SEITEN_WERTE[naechsteIndex];
    const anzeigename = SEITEN_LABELS[naechsteIndex];
    fuegeSeiteHinzu(id, label, anzeigename);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inhalt}>
        <Card style={styles.kopfKarte}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.projektName}>{projekt.name}</Text>
            {projekt.adresse && <Text variant="bodyMedium" style={styles.adresse}>{projekt.adresse}</Text>}
            {projekt.auftraggeber && <Text variant="bodySmall" style={styles.auftraggeber}>AG: {projekt.auftraggeber}</Text>}
            <View style={styles.infoCips}>
              <Chip compact icon="cog">{projekt.systemId.replace('-', ' ')}</Chip>
              <Chip compact icon="arrow-expand-up">{projekt.gesamthoehe} m</Chip>
              <Chip compact icon="layers">{projekt.etagen} Etagen</Chip>
            </View>
            <View style={styles.fortschrittRow}>
              <Text variant="bodySmall">{vollstaendig}/{projekt.seiten.length} Seiten vollständig</Text>
              <Text variant="bodySmall">{Math.round(fortschritt * 100)} %</Text>
            </View>
            <ProgressBar progress={fortschritt} color="#1565C0" style={styles.fortschritt} />
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.abschnittTitel}>Gebäudeseiten</Text>
        {projekt.seiten.map(seite => (
          <SeitenKarte key={seite.id} seite={seite} projektId={id} />
        ))}
        <Button
          mode="outlined"
          icon="plus"
          onPress={neueSeite}
          style={styles.seiteHinzufuegen}
        >
          Seite hinzufügen
        </Button>

        {projekt.seiten.length > 0 && (
          <>
            <Text variant="titleMedium" style={styles.abschnittTitel}>Auswertung</Text>
            <View style={styles.aktionenGrid}>
              <Button
                mode="contained"
                icon="calculator"
                onPress={() => router.push(`/project/${id}/materials`)}
                style={styles.aktionButton}
              >
                Materialliste berechnen
              </Button>
              <Button
                mode="contained-tonal"
                icon="floor-plan"
                onPress={() => router.push(`/project/${id}/plan`)}
                style={styles.aktionButton}
              >
                Gerüstplan ansehen
              </Button>
              <Button
                mode="contained-tonal"
                icon="file-pdf-box"
                onPress={() => router.push(`/project/${id}/export`)}
                style={styles.aktionButton}
              >
                PDF exportieren
              </Button>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 16, paddingBottom: 100 },
  fehler: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  kopfKarte: { marginBottom: 16, elevation: 2 },
  projektName: { fontWeight: 'bold', marginBottom: 4 },
  adresse: { color: '#666', marginBottom: 2 },
  auftraggeber: { color: '#888', marginBottom: 8 },
  infoCips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  fortschrittRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  fortschritt: { height: 8, borderRadius: 4 },
  abschnittTitel: { fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: '#1565C0' },
  seitenKarte: { marginBottom: 8, elevation: 1 },
  seitenKopf: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  seitenInfo: { color: '#666' },
  seiteHinzufuegen: { marginTop: 8, borderStyle: 'dashed' },
  aktionenGrid: { gap: 8 },
  aktionButton: { marginBottom: 4 },
});
