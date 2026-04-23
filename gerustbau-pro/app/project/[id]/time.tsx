import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Text, Card, Button, FAB, TextInput, SegmentedButtons,
  Portal, Dialog, Divider, IconButton, Chip,
} from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useProjektStore } from '../../../src/store/projectStore';
import type { ZeitEintrag } from '../../../src/models/Project';

function formatiereStunden(h: number): string {
  const std = Math.floor(h);
  const min = Math.round((h - std) * 60);
  if (min === 0) return `${std} Std.`;
  return `${std}:${min.toString().padStart(2, '0')} Std.`;
}

function heuteDatum(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatiereDatum(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MITARBEITER_VORSCHLAEGE = ['Ich', 'Kolonne A', 'Kolonne B', 'Vorarbeiter', 'Subunternehmer'];

export default function ZeiterfassungScreen() {
  const { id: projektId } = useLocalSearchParams<{ id: string }>();
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const fuegeZeitEintragHinzu = useProjektStore(s => s.fuegeZeitEintragHinzu);
  const loescheZeitEintrag = useProjektStore(s => s.loescheZeitEintrag);

  const [dialogOffen, setDialogOffen] = useState(false);
  const [datum, setDatum] = useState(heuteDatum());
  const [stundenText, setStundenText] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [mitarbeiter, setMitarbeiter] = useState('Ich');

  if (!projekt) return null;

  const eintraege = [...(projekt.zeiteintraege ?? [])].sort(
    (a, b) => b.datum.localeCompare(a.datum),
  );

  const gesamtStunden = eintraege.reduce((s, e) => s + e.stunden, 0);

  // This month
  const jetztMonat = new Date().toISOString().slice(0, 7);
  const stundenDiesenMonat = eintraege
    .filter(e => e.datum.startsWith(jetztMonat))
    .reduce((s, e) => s + e.stunden, 0);

  function resetDialog() {
    setDatum(heuteDatum());
    setStundenText('');
    setBeschreibung('');
    setMitarbeiter('Ich');
  }

  function oeffneDialog() {
    resetDialog();
    setDialogOffen(true);
  }

  function eintragSpeichern() {
    const stunden = parseFloat(stundenText.replace(',', '.'));
    if (isNaN(stunden) || stunden < 0.5 || stunden > 24) {
      Alert.alert('Ungültige Stunden', 'Bitte eine Zahl zwischen 0,5 und 24 eingeben.');
      return;
    }
    if (!datum.match(/^\d{4}-\d{2}-\d{2}$/)) {
      Alert.alert('Ungültiges Datum', 'Format: JJJJ-MM-TT (z.B. 2025-06-15)');
      return;
    }
    fuegeZeitEintragHinzu(projektId, {
      datum,
      stunden,
      beschreibung: beschreibung.trim() || 'Arbeit',
      mitarbeiter: mitarbeiter.trim() || undefined,
    });
    setDialogOffen(false);
  }

  function eintragLoeschen(eintrag: ZeitEintrag) {
    Alert.alert(
      'Eintrag löschen',
      `„${eintrag.beschreibung}" (${formatiereDatum(eintrag.datum)}) wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => loescheZeitEintrag(projektId, eintrag.id) },
      ],
    );
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>

        {/* Summary cards */}
        <View style={styles.summaryRow}>
          <Card style={[styles.summaryCard, styles.summaryCardBlau]}>
            <Card.Content style={styles.summaryContent}>
              <Text variant="bodySmall" style={styles.summaryLabel}>Gesamt</Text>
              <Text variant="headlineMedium" style={styles.summaryWert}>
                {formatiereStunden(gesamtStunden)}
              </Text>
              <Text variant="bodySmall" style={styles.summaryUnter}>{eintraege.length} Einträge</Text>
            </Card.Content>
          </Card>
          <Card style={[styles.summaryCard, styles.summaryCardGruen]}>
            <Card.Content style={styles.summaryContent}>
              <Text variant="bodySmall" style={styles.summaryLabel}>Dieser Monat</Text>
              <Text variant="headlineMedium" style={styles.summaryWert}>
                {formatiereStunden(stundenDiesenMonat)}
              </Text>
              <Text variant="bodySmall" style={styles.summaryUnter}>
                {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
              </Text>
            </Card.Content>
          </Card>
        </View>

        {/* Entries list */}
        {eintraege.length === 0 ? (
          <View style={styles.leer}>
            <Text style={styles.leerIcon}>⏱️</Text>
            <Text variant="titleMedium" style={styles.leerTitel}>Noch keine Zeiteinträge</Text>
            <Text variant="bodyMedium" style={styles.leerText}>
              Tippen Sie auf „+ Eintrag" um Arbeitsstunden zu erfassen.
            </Text>
          </View>
        ) : (
          <>
            <Text variant="titleMedium" style={styles.abschnittTitel}>Zeitprotokoll</Text>
            {eintraege.map(e => (
              <Card key={e.id} style={styles.eintragCard}>
                <Card.Content style={styles.eintragRow}>
                  <View style={styles.eintragLinks}>
                    <Text variant="bodyMedium" style={styles.eintragBeschreibung}>{e.beschreibung}</Text>
                    <View style={styles.eintragMeta}>
                      <Text variant="bodySmall" style={styles.eintragDatum}>{formatiereDatum(e.datum)}</Text>
                      {e.mitarbeiter && (
                        <Chip compact icon="account" style={styles.mitarbeiterChip} textStyle={{ fontSize: 11 }}>
                          {e.mitarbeiter}
                        </Chip>
                      )}
                    </View>
                  </View>
                  <View style={styles.eintragRechts}>
                    <Text variant="titleMedium" style={styles.eintragStunden}>
                      {formatiereStunden(e.stunden)}
                    </Text>
                    <IconButton
                      icon="delete-outline"
                      size={20}
                      iconColor="#D32F2F"
                      onPress={() => eintragLoeschen(e)}
                      style={styles.deleteButton}
                    />
                  </View>
                </Card.Content>
              </Card>
            ))}

            <Divider style={styles.divider} />
            <View style={styles.gesamtZeile}>
              <Text variant="titleMedium" style={styles.gesamtLabel}>Gesamtstunden</Text>
              <Text variant="titleMedium" style={styles.gesamtWert}>{formatiereStunden(gesamtStunden)}</Text>
            </View>
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={oeffneDialog}
        label="Eintrag"
      />

      <Portal>
        <Dialog visible={dialogOffen} onDismiss={() => setDialogOffen(false)}>
          <Dialog.Title>Arbeitsstunden erfassen</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScrollArea}>
            <ScrollView>
              <View style={styles.dialogInhalt}>
                <TextInput
                  label="Datum (JJJJ-MM-TT)"
                  value={datum}
                  onChangeText={setDatum}
                  mode="outlined"
                  style={styles.eingabe}
                  keyboardType="numbers-and-punctuation"
                  placeholder="2025-06-15"
                />
                <TextInput
                  label="Stunden"
                  value={stundenText}
                  onChangeText={setStundenText}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={styles.eingabe}
                  placeholder="z.B. 8 oder 7,5"
                  autoFocus
                />
                <TextInput
                  label="Tätigkeit / Beschreibung"
                  value={beschreibung}
                  onChangeText={setBeschreibung}
                  mode="outlined"
                  style={styles.eingabe}
                  placeholder="z.B. Aufbau Nordseite, Anker setzen"
                />
                <Text variant="bodyMedium" style={styles.vorschlagLabel}>Mitarbeiter:</Text>
                <View style={styles.vorschlaege}>
                  {MITARBEITER_VORSCHLAEGE.map(v => (
                    <Chip
                      key={v}
                      compact
                      selected={mitarbeiter === v}
                      onPress={() => setMitarbeiter(v)}
                      style={[styles.vorschlagChip, mitarbeiter === v && styles.vorschlagChipAktiv]}
                      textStyle={{ fontSize: 13 }}
                    >
                      {v}
                    </Chip>
                  ))}
                </View>
                <TextInput
                  label="Mitarbeiter (eigene Eingabe)"
                  value={mitarbeiter}
                  onChangeText={setMitarbeiter}
                  mode="outlined"
                  style={styles.eingabe}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogOffen(false)}>Abbrechen</Button>
            <Button mode="contained" onPress={eintragSpeichern}>Speichern</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 16, paddingBottom: 40 },

  summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryCard: { flex: 1, elevation: 3 },
  summaryCardBlau: { backgroundColor: '#1565C0' },
  summaryCardGruen: { backgroundColor: '#2E7D32' },
  summaryContent: { alignItems: 'center', paddingVertical: 8 },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  summaryWert: { color: 'white', fontWeight: 'bold' },
  summaryUnter: { color: 'rgba(255,255,255,0.7)', marginTop: 4 },

  abschnittTitel: { fontWeight: 'bold', color: '#1565C0', marginBottom: 10 },

  leer: { alignItems: 'center', paddingTop: 60, paddingBottom: 40 },
  leerIcon: { fontSize: 56, marginBottom: 16 },
  leerTitel: { color: '#555', marginBottom: 8 },
  leerText: { color: '#888', textAlign: 'center', lineHeight: 22 },

  eintragCard: { marginBottom: 8, elevation: 1 },
  eintragRow: { flexDirection: 'row', alignItems: 'center' },
  eintragLinks: { flex: 1 },
  eintragBeschreibung: { fontWeight: '500', marginBottom: 4 },
  eintragMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  eintragDatum: { color: '#888' },
  mitarbeiterChip: { backgroundColor: '#E3F2FD' },
  eintragRechts: { alignItems: 'flex-end' },
  eintragStunden: { color: '#1565C0', fontWeight: 'bold' },
  deleteButton: { margin: 0 },

  divider: { marginVertical: 12 },
  gesamtZeile: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  gesamtLabel: { fontWeight: 'bold', color: '#333' },
  gesamtWert: { fontWeight: 'bold', color: '#1565C0' },

  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#1565C0' },

  dialogScrollArea: { maxHeight: 480, paddingHorizontal: 0 },
  dialogInhalt: { padding: 16 },
  eingabe: { backgroundColor: 'white', marginBottom: 12 },
  vorschlagLabel: { marginBottom: 8, color: '#555' },
  vorschlaege: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  vorschlagChip: { backgroundColor: '#E0E0E0' },
  vorschlagChipAktiv: { backgroundColor: '#BBDEFB' },
});
