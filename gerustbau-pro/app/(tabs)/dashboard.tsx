import { ScrollView, View, StyleSheet } from 'react-native';
import { Text, Card, Chip, ProgressBar, Divider } from 'react-native-paper';
import { router } from 'expo-router';
import { useProjektStore } from '../../src/store/projectStore';
import type { Project } from '../../src/models/Project';

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

function formatiereStunden(h: number): string {
  if (h === 0) return '0 Std.';
  const std = Math.floor(h);
  const min = Math.round((h - std) * 60);
  if (min === 0) return `${std} Std.`;
  return `${std}:${min.toString().padStart(2, '0')} Std.`;
}

function termin_tage(iso: string): number {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 0;
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const t = new Date(iso + 'T00:00:00');
  if (isNaN(t.getTime())) return 0;
  return Math.round((t.getTime() - heute.getTime()) / 86400000);
}

function StatCard({
  label, wert, sub, farbe,
}: { label: string; wert: string; sub?: string; farbe?: string }) {
  return (
    <Card style={[styles.statCard, farbe ? { backgroundColor: farbe } : undefined]}>
      <Card.Content style={styles.statContent}>
        <Text variant="bodySmall" style={farbe ? styles.statLabelHell : styles.statLabelDunkel}>{label}</Text>
        <Text variant="headlineMedium" style={[styles.statWert, farbe ? { color: 'white' } : { color: '#1565C0' }]}>
          {wert}
        </Text>
        {sub && <Text variant="bodySmall" style={farbe ? styles.statSubHell : styles.statSubDunkel}>{sub}</Text>}
      </Card.Content>
    </Card>
  );
}

function TerminBadge({ tage }: { tage: number }) {
  let bg = '#2E7D32';
  let text = `${tage} Tage`;
  if (tage < 0) { bg = '#B71C1C'; text = `${Math.abs(tage)}T überfällig`; }
  else if (tage === 0) { bg = '#D32F2F'; text = 'Heute!'; }
  else if (tage <= 3) { bg = '#E65100'; text = `${tage}T`; }
  else if (tage <= 7) { bg = '#F57F17'; text = `${tage}T`; }
  return (
    <View style={[styles.terminBadge, { backgroundColor: bg }]}>
      <Text style={styles.terminText}>{text}</Text>
    </View>
  );
}

export default function Dashboard() {
  const projekte = useProjektStore(s => s.projekte);

  const total = projekte.length;
  const nachStatus: Record<string, number> = {
    entwurf: 0, aufnahme: 0, berechnung: 0, fertig: 0,
  };
  for (const p of projekte) nachStatus[p.status] = (nachStatus[p.status] ?? 0) + 1;

  const aktiv = nachStatus.aufnahme + nachStatus.berechnung;

  // Total hours all projects
  const gesamtStunden = projekte.reduce((s, p) =>
    s + (p.zeiteintraege ?? []).reduce((hs, e) => hs + e.stunden, 0), 0);

  // This month's hours
  const jetztMonat = new Date().toISOString().slice(0, 7);
  const stundenDiesenMonat = projekte.reduce((s, p) =>
    s + (p.zeiteintraege ?? [])
      .filter(e => e.datum.startsWith(jetztMonat))
      .reduce((hs, e) => hs + e.stunden, 0), 0);

  // Upcoming deadlines (projects with termin, sorted by soonest)
  const mitTermin = projekte
    .filter(p => p.termin && p.status !== 'fertig')
    .sort((a, b) => a.termin!.localeCompare(b.termin!))
    .slice(0, 5);

  // Recent activity: last 5 modified projects
  const zuletzt = [...projekte]
    .sort((a, b) => b.aktualisiertAm.localeCompare(a.aktualisiertAm))
    .slice(0, 5);

  const totalFotos = projekte.reduce((s, p) =>
    s + p.seiten.reduce((ss, se) => ss + se.fotos.length, 0), 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>

      {/* Greeting */}
      <Text variant="headlineSmall" style={styles.title}>Übersicht</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>
        {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      </Text>

      {/* Stats grid */}
      <View style={styles.statGrid}>
        <StatCard label="Projekte gesamt" wert={String(total)} sub={`${aktiv} aktiv`} farbe="#1565C0" />
        <StatCard label="Fertiggestellt" wert={String(nachStatus.fertig)} sub={`von ${total}`} farbe="#2E7D32" />
        <StatCard label="Stunden (Monat)" wert={formatiereStunden(stundenDiesenMonat)} sub="Zeiterfassung" />
        <StatCard label="Fotos gesamt" wert={String(totalFotos)} sub="alle Projekte" />
      </View>

      {/* Status breakdown */}
      {total > 0 && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>Status-Übersicht</Text>
          <Card style={styles.statusCard}>
            <Card.Content>
              {(['aufnahme', 'berechnung', 'entwurf', 'fertig'] as const).map(status => {
                const anzahl = nachStatus[status] ?? 0;
                const anteil = total > 0 ? anzahl / total : 0;
                return (
                  <View key={status} style={styles.statusZeile}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_FARBEN[status] }]} />
                    <Text variant="bodyMedium" style={styles.statusLabel}>{STATUS_LABELS[status]}</Text>
                    <Text variant="bodyMedium" style={styles.statusZahl}>{anzahl}</Text>
                    <ProgressBar
                      progress={anteil}
                      color={STATUS_FARBEN[status]}
                      style={styles.statusBar}
                    />
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        </>
      )}

      {/* Upcoming deadlines */}
      {mitTermin.length > 0 && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>Nächste Termine</Text>
          <Card style={styles.terminCard}>
            <Card.Content>
              {mitTermin.map((p, idx) => {
                const tage = termin_tage(p.termin!);
                return (
                  <View key={p.id}>
                    <View style={styles.terminZeile} >
                      <View style={styles.terminInfo}>
                        <Text
                          variant="bodyMedium"
                          style={styles.terminName}
                          onPress={() => router.push(`/project/${p.id}`)}
                        >
                          {p.name}
                        </Text>
                        <Text variant="bodySmall" style={styles.terminDatum}>
                          {new Date(p.termin! + 'T00:00:00').toLocaleDateString('de-DE', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <TerminBadge tage={tage} />
                    </View>
                    {idx < mitTermin.length - 1 && <Divider style={{ marginVertical: 6 }} />}
                  </View>
                );
              })}
            </Card.Content>
          </Card>
        </>
      )}

      {/* Recent projects */}
      {zuletzt.length > 0 && (
        <>
          <Text variant="titleMedium" style={styles.sectionTitle}>Zuletzt bearbeitet</Text>
          {zuletzt.map(p => {
            const vollstaendig = p.seiten.filter(s => s.messungStatus === 'vollstaendig').length;
            const fortschritt = p.seiten.length > 0 ? vollstaendig / p.seiten.length : 0;
            const stunden = (p.zeiteintraege ?? []).reduce((s, e) => s + e.stunden, 0);
            return (
              <Card key={p.id} style={styles.recentCard} onPress={() => router.push(`/project/${p.id}`)}>
                <Card.Content>
                  <View style={styles.recentKopf}>
                    <Text variant="bodyLarge" style={styles.recentName} numberOfLines={1}>{p.name}</Text>
                    <Chip
                      compact
                      style={[styles.recentStatus, { backgroundColor: STATUS_FARBEN[p.status] }]}
                      textStyle={{ color: 'white', fontSize: 11 }}
                    >
                      {STATUS_LABELS[p.status]}
                    </Chip>
                  </View>
                  {p.adresse && (
                    <Text variant="bodySmall" style={styles.recentAdresse} numberOfLines={1}>{p.adresse}</Text>
                  )}
                  <View style={styles.recentMeta}>
                    {p.seiten.length > 0 && (
                      <Text variant="bodySmall" style={styles.recentInfo}>
                        {vollstaendig}/{p.seiten.length} Seiten
                      </Text>
                    )}
                    {stunden > 0 && (
                      <Text variant="bodySmall" style={styles.recentInfo}>
                        ⏱ {formatiereStunden(stunden)}
                      </Text>
                    )}
                    <Text variant="bodySmall" style={styles.recentInfo}>
                      {new Date(p.aktualisiertAm).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </Text>
                  </View>
                  {p.seiten.length > 0 && (
                    <ProgressBar progress={fortschritt} color={STATUS_FARBEN[p.status]} style={styles.recentBar} />
                  )}
                </Card.Content>
              </Card>
            );
          })}
        </>
      )}

      {total === 0 && (
        <View style={styles.leer}>
          <Text style={styles.leerIcon}>🏗️</Text>
          <Text variant="titleLarge" style={styles.leerTitel}>Willkommen bei Gerüstbau Pro</Text>
          <Text variant="bodyLarge" style={styles.leerText}>
            Erstellen Sie Ihr erstes Projekt unter dem Tab „Projekte".
          </Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 16 },
  title: { fontWeight: 'bold', color: '#1565C0', marginBottom: 2 },
  subtitle: { color: '#888', marginBottom: 20 },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: { width: '47%', elevation: 2 },
  statContent: { alignItems: 'center', paddingVertical: 10 },
  statLabelHell: { color: 'rgba(255,255,255,0.8)', marginBottom: 4, textAlign: 'center' },
  statLabelDunkel: { color: '#888', marginBottom: 4, textAlign: 'center' },
  statWert: { fontWeight: 'bold', marginBottom: 2 },
  statSubHell: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  statSubDunkel: { color: '#999', fontSize: 11 },

  sectionTitle: { fontWeight: 'bold', color: '#1565C0', marginBottom: 10, marginTop: 4 },

  statusCard: { marginBottom: 16, elevation: 1 },
  statusZeile: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { width: 110 },
  statusZahl: { width: 24, textAlign: 'right', fontWeight: 'bold', color: '#333' },
  statusBar: { flex: 1, height: 6, borderRadius: 3 },

  terminCard: { marginBottom: 16, elevation: 1 },
  terminZeile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  terminInfo: { flex: 1 },
  terminName: { fontWeight: '500', color: '#333' },
  terminDatum: { color: '#888' },
  terminBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
  terminText: { color: 'white', fontWeight: 'bold', fontSize: 12 },

  recentCard: { marginBottom: 8, elevation: 1 },
  recentKopf: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  recentName: { fontWeight: '600', flex: 1, marginRight: 8 },
  recentStatus: { flexShrink: 0 },
  recentAdresse: { color: '#888', marginBottom: 4 },
  recentMeta: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  recentInfo: { color: '#888' },
  recentBar: { height: 4, borderRadius: 2 },

  leer: { alignItems: 'center', paddingTop: 60 },
  leerIcon: { fontSize: 72, marginBottom: 16 },
  leerTitel: { color: '#555', marginBottom: 12, textAlign: 'center' },
  leerText: { color: '#777', textAlign: 'center', lineHeight: 26 },
});
