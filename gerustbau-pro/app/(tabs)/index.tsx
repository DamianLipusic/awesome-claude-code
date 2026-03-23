import { useCallback, useMemo, useState } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { FAB, Card, Text, Chip, Searchbar, Menu, IconButton } from 'react-native-paper';
import { router } from 'expo-router';
import { useProjektStore } from '../../src/store/projectStore';
import type { Project, ProjectStatus } from '../../src/models/Project';
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

type SortKey = 'datum-neu' | 'datum-alt' | 'name' | 'status';

const SORT_LABELS: Record<SortKey, string> = {
  'datum-neu': 'Neueste zuerst',
  'datum-alt': 'Älteste zuerst',
  name: 'Name A–Z',
  status: 'Status',
};

const STATUS_REIHENFOLGE: Record<ProjectStatus, number> = {
  aufnahme: 0,
  berechnung: 1,
  entwurf: 2,
  fertig: 3,
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
          {vollstaendigeSeiten}/{projekt.seiten.length} Seiten vollständig · {formatiereDatum(projekt.erstelltAm)}
        </Text>
      </Card.Content>
    </Card>
  );
}

export default function ProjekteListe() {
  const projekte = useProjektStore(s => s.projekte);
  const [suche, setSuche] = useState('');
  const [sortierung, setSortierung] = useState<SortKey>('datum-neu');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | null>(null);
  const [sortMenuOffen, setSortMenuOffen] = useState(false);

  const gefiltertUndSortiert = useMemo(() => {
    let liste = [...projekte];

    // Suche
    const q = suche.toLowerCase().trim();
    if (q) {
      liste = liste.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.adresse?.toLowerCase().includes(q) ?? false) ||
        (p.auftraggeber?.toLowerCase().includes(q) ?? false),
      );
    }

    // Status-Filter
    if (statusFilter) {
      liste = liste.filter(p => p.status === statusFilter);
    }

    // Sortierung
    liste.sort((a, b) => {
      switch (sortierung) {
        case 'datum-neu': return new Date(b.erstelltAm).getTime() - new Date(a.erstelltAm).getTime();
        case 'datum-alt': return new Date(a.erstelltAm).getTime() - new Date(b.erstelltAm).getTime();
        case 'name': return a.name.localeCompare(b.name, 'de');
        case 'status': return STATUS_REIHENFOLGE[a.status] - STATUS_REIHENFOLGE[b.status];
      }
    });

    return liste;
  }, [projekte, suche, sortierung, statusFilter]);

  const renderItem = useCallback(({ item }: { item: Project }) => (
    <ProjektKarte projekt={item} />
  ), []);

  return (
    <View style={styles.container}>
      {/* Toolbar: Search + Sort */}
      <View style={styles.toolbar}>
        <Searchbar
          placeholder="Suchen…"
          value={suche}
          onChangeText={setSuche}
          style={styles.suchleiste}
          inputStyle={{ fontSize: 14 }}
        />
        <Menu
          visible={sortMenuOffen}
          onDismiss={() => setSortMenuOffen(false)}
          anchor={
            <IconButton
              icon="sort"
              onPress={() => setSortMenuOffen(true)}
              style={styles.sortButton}
            />
          }
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
            <Menu.Item
              key={key}
              title={SORT_LABELS[key]}
              leadingIcon={sortierung === key ? 'check' : undefined}
              onPress={() => { setSortierung(key); setSortMenuOffen(false); }}
            />
          ))}
        </Menu>
      </View>

      {/* Status-Filter-Chips */}
      <View style={styles.filterLeiste}>
        {(['aufnahme', 'berechnung', 'entwurf', 'fertig'] as ProjectStatus[]).map(s => (
          <Chip
            key={s}
            compact
            selected={statusFilter === s}
            onPress={() => setStatusFilter(prev => prev === s ? null : s)}
            style={[styles.filterChip, statusFilter === s && { backgroundColor: STATUS_FARBEN[s] }]}
            textStyle={statusFilter === s ? { color: 'white', fontSize: 11 } : { fontSize: 11 }}
          >
            {STATUS_LABELS[s]}
          </Chip>
        ))}
      </View>

      <FlatList
        data={gefiltertUndSortiert}
        keyExtractor={p => p.id}
        renderItem={renderItem}
        contentContainerStyle={styles.liste}
        ListEmptyComponent={
          <View style={styles.leer}>
            {projekte.length === 0 ? (
              <>
                <Text variant="headlineSmall" style={styles.leerTitel}>Noch keine Projekte</Text>
                <Text variant="bodyMedium" style={styles.leerText}>
                  Tippen Sie auf + um ein neues Gerüstprojekt anzulegen.
                </Text>
              </>
            ) : (
              <>
                <Text variant="headlineSmall" style={styles.leerTitel}>Keine Treffer</Text>
                <Text variant="bodyMedium" style={styles.leerText}>
                  Suche oder Filter anpassen.
                </Text>
              </>
            )}
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
  toolbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingTop: 8, gap: 4 },
  suchleiste: { flex: 1, elevation: 0, backgroundColor: 'white', height: 44 },
  sortButton: { margin: 0 },
  filterLeiste: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 6, flexWrap: 'wrap' },
  filterChip: { backgroundColor: '#E0E0E0' },
  liste: { padding: 16, paddingTop: 4, paddingBottom: 100 },
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
