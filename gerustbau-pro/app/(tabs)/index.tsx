import { useCallback, useMemo, useState } from 'react';
import { FlatList, View, StyleSheet } from 'react-native';
import { FAB, Card, Text, Chip, Searchbar, Menu, IconButton, ProgressBar } from 'react-native-paper';
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
  aufnahme: '#1565C0',
  berechnung: '#F57F17',
  fertig: '#2E7D32',
};

const STATUS_LABELS: Record<string, string> = {
  entwurf: 'Entwurf',
  aufnahme: 'In Aufnahme',
  berechnung: 'In Berechnung',
  fertig: 'Fertig',
};

const STATUS_ICONS: Record<string, string> = {
  entwurf: '📋',
  aufnahme: '📷',
  berechnung: '📐',
  fertig: '✅',
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
  const fortschritt = projekt.seiten.length > 0 ? vollstaendigeSeiten / projekt.seiten.length : 0;

  return (
    <Card
      style={styles.karte}
      onPress={() => router.push(`/project/${projekt.id}`)}
    >
      <Card.Content>
        {/* Status badge row */}
        <View style={styles.karteKopf}>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_FARBEN[projekt.status] }]}>
            <Text style={styles.statusIcon}>{STATUS_ICONS[projekt.status]}</Text>
            <Text style={styles.statusText}>{STATUS_LABELS[projekt.status]}</Text>
          </View>
          <Text variant="bodySmall" style={styles.datum}>{formatiereDatum(projekt.erstelltAm)}</Text>
        </View>

        {/* Project name - large and bold */}
        <Text variant="titleLarge" style={styles.projektName}>{projekt.name}</Text>

        {/* Address */}
        {projekt.adresse && (
          <Text variant="bodyMedium" style={styles.adresse}>{projekt.adresse}</Text>
        )}

        {/* System + purpose */}
        <View style={styles.chips}>
          <Chip compact style={styles.chip}>{SYSTEM_LABELS[projekt.systemId]}</Chip>
          <Chip compact style={styles.chip}>{ZWECK_LABELS[projekt.zweck]}</Chip>
          <Chip compact style={styles.chip}>{projekt.gesamthoehe} m</Chip>
        </View>

        {/* Progress bar */}
        {projekt.seiten.length > 0 && (
          <View style={styles.fortschrittContainer}>
            <Text variant="bodySmall" style={styles.fortschrittText}>
              {vollstaendigeSeiten}/{projekt.seiten.length} Seiten vollständig
            </Text>
            <ProgressBar
              progress={fortschritt}
              color={STATUS_FARBEN[projekt.status]}
              style={styles.fortschritt}
            />
          </View>
        )}
      </Card.Content>

      {/* Large tap-to-open hint */}
      <View style={styles.oeffnenLeiste}>
        <Text style={styles.oeffnenText}>Antippen zum Öffnen →</Text>
      </View>
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

    const q = suche.toLowerCase().trim();
    if (q) {
      liste = liste.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.adresse?.toLowerCase().includes(q) ?? false) ||
        (p.auftraggeber?.toLowerCase().includes(q) ?? false),
      );
    }

    if (statusFilter) {
      liste = liste.filter(p => p.status === statusFilter);
    }

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
      {/* Search + sort toolbar */}
      <View style={styles.toolbar}>
        <Searchbar
          placeholder="Projekt suchen…"
          value={suche}
          onChangeText={setSuche}
          style={styles.suchleiste}
          inputStyle={{ fontSize: 15 }}
        />
        <Menu
          visible={sortMenuOffen}
          onDismiss={() => setSortMenuOffen(false)}
          anchor={
            <IconButton
              icon="sort"
              size={26}
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

      {/* Status filter chips */}
      <View style={styles.filterLeiste}>
        {(['aufnahme', 'berechnung', 'entwurf', 'fertig'] as ProjectStatus[]).map(s => (
          <Chip
            key={s}
            compact
            selected={statusFilter === s}
            onPress={() => setStatusFilter(prev => prev === s ? null : s)}
            style={[styles.filterChip, statusFilter === s && { backgroundColor: STATUS_FARBEN[s] }]}
            textStyle={statusFilter === s ? { color: 'white', fontSize: 13 } : { fontSize: 13 }}
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
                <Text style={styles.leerIcon}>🏗️</Text>
                <Text variant="headlineMedium" style={styles.leerTitel}>Noch keine Projekte</Text>
                <Text variant="bodyLarge" style={styles.leerText}>
                  Tippen Sie unten auf{'\n'}„+ Neues Projekt"{'\n'}um zu beginnen.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.leerIcon}>🔍</Text>
                <Text variant="headlineSmall" style={styles.leerTitel}>Keine Treffer</Text>
                <Text variant="bodyLarge" style={styles.leerText}>
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
  suchleiste: { flex: 1, elevation: 0, backgroundColor: 'white', height: 48 },
  sortButton: { margin: 0 },
  filterLeiste: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, flexWrap: 'wrap' },
  filterChip: { backgroundColor: '#E0E0E0' },
  liste: { padding: 16, paddingTop: 4, paddingBottom: 120 },

  karte: { marginBottom: 14, elevation: 3, borderRadius: 12 },
  karteKopf: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusIcon: { fontSize: 14 },
  statusText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  datum: { color: '#888' },
  projektName: { fontWeight: 'bold', fontSize: 20, marginBottom: 4, color: '#1A1A1A' },
  adresse: { color: '#555', marginBottom: 8, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { backgroundColor: '#E3F2FD' },
  fortschrittContainer: { marginTop: 4 },
  fortschrittText: { color: '#666', marginBottom: 4 },
  fortschritt: { height: 6, borderRadius: 3 },
  oeffnenLeiste: {
    backgroundColor: '#F0F7FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    alignItems: 'flex-end',
  },
  oeffnenText: { color: '#1565C0', fontWeight: 'bold', fontSize: 13 },

  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#1565C0' },

  leer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  leerIcon: { fontSize: 72, marginBottom: 16 },
  leerTitel: { color: '#555', marginBottom: 12, textAlign: 'center' },
  leerText: { color: '#777', textAlign: 'center', lineHeight: 28, fontSize: 16 },
});
