import { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Text, Card, Checkbox, Chip, Button, ProgressBar,
  Portal, Dialog, TextInput, Divider, IconButton,
} from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useProjektStore } from '../../../src/store/projectStore';
import {
  KATEGORIE_LABELS,
  KATEGORIE_ICONS,
  STANDARD_PRUEFPUNKTE,
  type KategorieKey,
} from '../../../src/data/checklistData';
import type { PruefPunkt } from '../../../src/models/Project';

const KATEGORIEN: KategorieKey[] = ['aufbau', 'sicherheit', 'dokumentation', 'abnahme'];

const KATEGORIE_FARBEN: Record<KategorieKey, string> = {
  aufbau: '#1565C0',
  sicherheit: '#D32F2F',
  dokumentation: '#6A1B9A',
  abnahme: '#2E7D32',
};

export default function ChecklistScreen() {
  const { id: projektId } = useLocalSearchParams<{ id: string }>();
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const initialisierePruefpunkte = useProjektStore(s => s.initialisierePruefpunkte);
  const aktualisierePruefpunkt = useProjektStore(s => s.aktualisierePruefpunkt);

  const [bemerkungPunkt, setBemerkungPunkt] = useState<PruefPunkt | null>(null);
  const [bemerkungText, setBemerkungText] = useState('');

  useEffect(() => {
    initialisierePruefpunkte(projektId);
  }, [projektId]);

  if (!projekt) return null;

  const punkte = projekt.pruefpunkte ?? [];
  const gesamt = punkte.length;
  const erledigt = punkte.filter(p => p.erledigt).length;
  const fortschritt = gesamt > 0 ? erledigt / gesamt : 0;
  const alleErledigt = gesamt > 0 && erledigt === gesamt;

  function togglePunkt(punkt: PruefPunkt) {
    aktualisierePruefpunkt(projektId, punkt.id, !punkt.erledigt, punkt.bemerkung);
  }

  function oeffneBemerkung(punkt: PruefPunkt) {
    setBemerkungPunkt(punkt);
    setBemerkungText(punkt.bemerkung ?? '');
  }

  function speichereBemerkung() {
    if (!bemerkungPunkt) return;
    aktualisierePruefpunkt(projektId, bemerkungPunkt.id, bemerkungPunkt.erledigt, bemerkungText.trim() || undefined);
    setBemerkungPunkt(null);
  }

  function alleKategoriePunkteToggle(kat: KategorieKey, erledigen: boolean) {
    const kategoriePunkte = punkte.filter(p => p.kategorie === kat);
    for (const p of kategoriePunkte) {
      aktualisierePruefpunkt(projektId, p.id, erledigen, p.bemerkung);
    }
  }

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>

        {/* Overall progress */}
        <Card style={[styles.summaryCard, { backgroundColor: alleErledigt ? '#2E7D32' : '#1565C0' }]}>
          <Card.Content>
            <View style={styles.summaryRow}>
              <View>
                <Text variant="bodySmall" style={styles.summaryLabel}>Prüffortschritt</Text>
                <Text variant="headlineMedium" style={styles.summaryWert}>
                  {erledigt} / {gesamt}
                </Text>
                <Text variant="bodySmall" style={styles.summaryUnter}>
                  {alleErledigt ? 'Alle Punkte erfüllt ✓' : `${gesamt - erledigt} Punkte offen`}
                </Text>
              </View>
              <Text style={styles.summaryIcon}>{alleErledigt ? '✅' : '📋'}</Text>
            </View>
            <ProgressBar progress={fortschritt} color="rgba(255,255,255,0.9)" style={styles.summaryBar} />
          </Card.Content>
        </Card>

        {/* Hint */}
        <Text variant="bodySmall" style={styles.hinweis}>
          Checkliste gemäß DGUV R 100-001 und TRBS 2121. Tippen Sie auf einen Punkt zum Abhaken,
          auf das Notiz-Symbol für eine Bemerkung.
        </Text>

        {/* Category sections */}
        {KATEGORIEN.map(kat => {
          const kategoriePunkte = punkte.filter(p => p.kategorie === kat);
          if (kategoriePunkte.length === 0) return null;
          const katErledigt = kategoriePunkte.filter(p => p.erledigt).length;
          const katAlle = katErledigt === kategoriePunkte.length;

          return (
            <View key={kat}>
              <View style={styles.kategorieKopf}>
                <View style={[styles.kategorieDot, { backgroundColor: KATEGORIE_FARBEN[kat] }]} />
                <Text variant="titleSmall" style={[styles.kategorieLabel, { color: KATEGORIE_FARBEN[kat] }]}>
                  {KATEGORIE_LABELS[kat]}
                </Text>
                <Chip
                  compact
                  style={[styles.kategorieChip, katAlle && { backgroundColor: '#E8F5E9' }]}
                  textStyle={{ fontSize: 11 }}
                >
                  {katErledigt}/{kategoriePunkte.length}
                </Chip>
                <Button
                  compact
                  mode="text"
                  onPress={() => alleKategoriePunkteToggle(kat, !katAlle)}
                  textColor={KATEGORIE_FARBEN[kat]}
                  style={styles.alleButton}
                >
                  {katAlle ? 'Alle ab' : 'Alle ✓'}
                </Button>
              </View>

              <Card style={styles.kategorieCard}>
                {kategoriePunkte.map((punkt, idx) => (
                  <View key={punkt.id}>
                    <View style={styles.punktRow}>
                      <Checkbox
                        status={punkt.erledigt ? 'checked' : 'unchecked'}
                        onPress={() => togglePunkt(punkt)}
                        color={KATEGORIE_FARBEN[kat]}
                      />
                      <View style={styles.punktText}>
                        <Text
                          variant="bodyMedium"
                          style={[styles.punktLabel, punkt.erledigt && styles.punktErledigt]}
                          onPress={() => togglePunkt(punkt)}
                        >
                          {punkt.text}
                        </Text>
                        {punkt.bemerkung && (
                          <Text variant="bodySmall" style={styles.punktBemerkung}>
                            💬 {punkt.bemerkung}
                          </Text>
                        )}
                        {punkt.erledigt && punkt.erledigtAm && (
                          <Text variant="bodySmall" style={styles.punktDatum}>
                            ✓ {new Date(punkt.erledigtAm + 'T00:00:00').toLocaleDateString('de-DE')}
                          </Text>
                        )}
                      </View>
                      <IconButton
                        icon={punkt.bemerkung ? 'comment-text' : 'comment-plus-outline'}
                        size={18}
                        iconColor={punkt.bemerkung ? KATEGORIE_FARBEN[kat] : '#BDBDBD'}
                        onPress={() => oeffneBemerkung(punkt)}
                        style={styles.bemerkungButton}
                      />
                    </View>
                    {idx < kategoriePunkte.length - 1 && <Divider style={styles.divider} />}
                  </View>
                ))}
              </Card>
            </View>
          );
        })}

        {/* Reset button */}
        <Button
          mode="outlined"
          icon="refresh"
          onPress={() => Alert.alert(
            'Checkliste zurücksetzen',
            'Alle Haken entfernen und Bemerkungen löschen?',
            [
              { text: 'Abbrechen', style: 'cancel' },
              {
                text: 'Zurücksetzen',
                style: 'destructive',
                onPress: () => {
                  for (const p of punkte) {
                    aktualisierePruefpunkt(projektId, p.id, false, undefined);
                  }
                },
              },
            ],
          )}
          style={styles.resetButton}
          textColor="#D32F2F"
        >
          Checkliste zurücksetzen
        </Button>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Portal>
        <Dialog visible={!!bemerkungPunkt} onDismiss={() => setBemerkungPunkt(null)}>
          <Dialog.Title>Bemerkung hinzufügen</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={styles.dialogPunktText} numberOfLines={3}>
              {bemerkungPunkt?.text}
            </Text>
            <TextInput
              label="Bemerkung / Mangelbeschreibung"
              value={bemerkungText}
              onChangeText={setBemerkungText}
              mode="outlined"
              multiline
              numberOfLines={3}
              autoFocus
              style={styles.bemerkungInput}
              placeholder="z.B. Anker an Achse 3 fehlt, muss nachgesetzt werden"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBemerkungPunkt(null)}>Abbrechen</Button>
            <Button mode="contained" onPress={speichereBemerkung}>Speichern</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 14, paddingBottom: 40 },

  summaryCard: { marginBottom: 14, elevation: 3 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  summaryLabel: { color: 'rgba(255,255,255,0.8)', marginBottom: 4 },
  summaryWert: { color: 'white', fontWeight: 'bold' },
  summaryUnter: { color: 'rgba(255,255,255,0.7)' },
  summaryIcon: { fontSize: 44 },
  summaryBar: { height: 8, borderRadius: 4 },

  hinweis: { color: '#888', marginBottom: 16, lineHeight: 18 },

  kategorieKopf: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, marginBottom: 6,
  },
  kategorieDot: { width: 10, height: 10, borderRadius: 5 },
  kategorieLabel: { flex: 1, fontWeight: 'bold' },
  kategorieChip: { backgroundColor: '#E0E0E0' },
  alleButton: { marginLeft: 'auto' },

  kategorieCard: { marginBottom: 4, elevation: 1 },
  punktRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6, paddingRight: 4 },
  punktText: { flex: 1, paddingTop: 6 },
  punktLabel: { fontSize: 13, lineHeight: 19, color: '#333' },
  punktErledigt: { color: '#9E9E9E', textDecorationLine: 'line-through' },
  punktBemerkung: { color: '#E65100', marginTop: 2, fontStyle: 'italic' },
  punktDatum: { color: '#9E9E9E', marginTop: 1, fontSize: 11 },
  bemerkungButton: { margin: 0, marginTop: 2 },
  divider: { marginHorizontal: 12 },

  resetButton: { marginTop: 16, borderColor: '#D32F2F' },

  dialogPunktText: { color: '#666', marginBottom: 12, fontStyle: 'italic' },
  bemerkungInput: { backgroundColor: 'white' },
});
