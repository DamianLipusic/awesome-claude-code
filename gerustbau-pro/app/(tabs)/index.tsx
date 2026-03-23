import { useCallback } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { FAB, Card, Text, Chip, useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import { useProjektStore } from '../../src/store/projectStore';
import type { Project } from '../../src/models/Project';
import { formatiereDatum } from '../../src/utils/formatters';

const SYSTEM_LABELS: Record<string, string> = {
  'layher-allround': 'Layher Allround',
  'layher-blitz': 'Layher Blitz',
  'tobler': 'Tobler',
};

const ZWECK_LABELS: Record<string, string> = {
  fassade: 'Fassade',
  innen: 'Innen',
  industrie: 'Industrie',
};

const STATUS_FARBEN: Record<string, string> = {
  entwurf: '#9E9E9E',
  aufnahme: '#1976D2',
  berechnung: '#F57F17',
  fertig: '#2E7D32',
};

const STATUS_LABELS: Record<string, string> = {
  entwurf: 'Entwurf',
  aufnahme: 'In Aufnahme',
  berechnung: 'In Berechnung',
  fertig: 'Fertig',
};

function ProjektKarte({ projekt }: { projekt: Project }) {
  const vollstaendigeSeiten = projekt.seiten.filter(s => s.messungStatus === 'vollstaendig').length;

  return (
    <Card
      style={styles.karte}
      onPress={() => router.push(`/project/${projekt.id}`)}
    >
      <Card.Content>
        <View style={styles.karteKopf}>
          <Text variant="titleMedium" style={styles.projektName}>{projekt.name}</Text>
          <Chip
            compact
            style={{ backgroundColor: STATUS_FARBEN[projekt.status] }}
            textStyle={{ color: 'white', fontSize: 11 }}
          >
            {STATUS_LABELS[projekt.status]}
          </Chip>
        </View>
        {projekt.adresse && (
          <Text variant="bodySmall" style={styles.adresse}>{projekt.adresse}</Text>
        )}
        <View style={styles.chips}>
          <Chip compact icon="cog" style={styles.chip}>{SYSTEM_LABELS[projekt.systemId]}</Chip>
          <Chip compact icon="home-city" style={styles.chip}>{ZWECK_LABELS[projekt.zweck]}</Chip>
          <Chip compact icon="arrow-expand-up" style={styles.chip}>{projekt.gesamthoehe} m</Chip>
        </View>
        <Text variant="bodySmall" style={styles.datum}>
          {vollstaendigeSeiten}/{projekt.seiten.length} Seiten vollständig · Erstellt {formatiereDatum(projekt.erstelltAm)}
        </Text>
      </Card.Content>
    </Card>
  );
}

export default function ProjekteListe() {
  const projekte = useProjektStore(s => s.projekte);

  const renderItem = useCallback(({ item }: { item: Project }) => (
    <ProjektKarte projekt={item} />
  ), []);

  return (
    <View style={styles.container}>
      <FlatList
        data={projekte}
        keyExtractor={p => p.id}
        renderItem={renderItem}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          <View style={styles.leer}>
            <Text variant="headlineSmall" style={styles.leerTitel}>Noch keine Projekte</Text>
            <Text variant="bodyMedium" style={styles.leerText}>
              Tippen Sie auf + um ein neues Gerüstprojekt anzulegen.
            </Text>
          </View>
        }
      />
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => router.push('/project/new')}
        label="Neues Projekt"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  liste: { padding: 16, paddingBottom: 100 },
  karte: { marginBottom: 12, elevation: 2 },
  karteKopf: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  projektName: { flex: 1, fontWeight: 'bold', marginRight: 8 },
  adresse: { color: '#666', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  chip: { backgroundColor: '#E3F2FD' },
  datum: { color: '#999', marginTop: 4 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#1565C0' },
  leer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  leerTitel: { color: '#666', marginBottom: 8 },
  leerText: { color: '#999', textAlign: 'center', paddingHorizontal: 32 },
});
