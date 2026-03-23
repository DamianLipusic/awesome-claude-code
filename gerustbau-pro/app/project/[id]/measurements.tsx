import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Chip, List, Divider, Button, TextInput, Dialog, Portal, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { useProjektStore } from '../../../src/store/projectStore';
import { useEinstellungenStore } from '../../../src/store/settingsStore';
import { getSystem } from '../../../src/data/systems';
import type { MessungsTyp, Messung } from '../../../src/models/Project';
import { konvertiereZuMetern, formatiereMetric } from '../../../src/utils/formatters';

const TYP_LABELS: Record<MessungsTyp, string> = {
  breite: 'Gesamtbreite',
  hoehe: 'Gebäudehöhe',
  'oeffnung-breite': 'Öffnungsbreite',
  'oeffnung-hoehe': 'Öffnungshöhe',
  'oeffnung-bruestung': 'Brüstungshöhe',
  'feld-breite': 'Feldbreite',
  wandabstand: 'Wandabstand',
  'freistand-hoehe': 'Freistands-Höhe',
};

export default function MessungenPruefen() {
  const { id: projektId, seitenId } = useLocalSearchParams<{ id: string; seitenId: string }>();
  const [manuelleEingabeOffen, setManuelleEingabeOffen] = useState(false);
  const [aktuellerTyp, setAktuellerTyp] = useState<MessungsTyp>('breite');
  const [eingabeWert, setEingabeWert] = useState('');
  const [eingabeEinheit, setEingabeEinheit] = useState<'mm' | 'cm' | 'm'>('m');

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const fuegeMessungHinzu = useProjektStore(s => s.fuegeMessungHinzu);
  const standardEinheit = useEinstellungenStore(s => s.standardEinheit);

  if (!projekt) return null;
  const seite = projekt.seiten.find(s => s.id === seitenId) ?? projekt.seiten[0];
  if (!seite) return null;

  const system = getSystem(projekt.systemId);
  const anforderungen = system.messungsAnforderungen.filter(a => a.proSeite || !a.proOeffnung);

  function oeffneManuelleEingabe(typ: MessungsTyp) {
    setAktuellerTyp(typ);
    setEingabeWert('');
    setManuelleEingabeOffen(true);
  }

  function speichereManuelleMessung() {
    const wert = parseFloat(eingabeWert.replace(',', '.'));
    if (isNaN(wert) || wert <= 0) return;
    fuegeMessungHinzu(projektId, seite.id, {
      typ: aktuellerTyp,
      wert: konvertiereZuMetern(wert, eingabeEinheit),
      quelle: 'manuell',
      genauigkeit: 'gemessen',
    });
    setManuelleEingabeOffen(false);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inhalt}>
        <Card style={styles.kopfKarte}>
          <Card.Content>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{seite.anzeigename}</Text>
            <View style={styles.statusRow}>
              <Chip
                icon={seite.messungStatus === 'vollstaendig' ? 'check-circle' : 'alert-circle'}
                style={{ backgroundColor: seite.messungStatus === 'vollstaendig' ? '#2E7D32' : seite.messungStatus === 'unvollstaendig' ? '#F57F17' : '#D32F2F' }}
                textStyle={{ color: 'white' }}
              >
                {seite.messungStatus === 'vollstaendig' ? 'Vollständig' : seite.messungStatus === 'unvollstaendig' ? 'Unvollständig' : 'Fehlend'}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        <Text variant="titleMedium" style={styles.abschnittTitel}>Pflichtmessungen</Text>
        {anforderungen.filter(a => a.pflicht).map(anf => {
          const messung = seite.messungen.find(m => m.typ === anf.typ);
          return (
            <Card key={anf.typ} style={styles.messungsKarte}>
              <List.Item
                title={anf.bezeichnung}
                description={anf.beschreibung}
                left={props => (
                  <List.Icon
                    {...props}
                    icon={messung ? 'check-circle' : 'circle-outline'}
                    color={messung ? '#2E7D32' : '#D32F2F'}
                  />
                )}
                right={() => (
                  <View style={styles.messungsRechts}>
                    {messung && (
                      <Text variant="bodyLarge" style={styles.messungsWert}>
                        {formatiereMetric(messung.wert, standardEinheit)}
                      </Text>
                    )}
                    <Button
                      compact
                      mode="outlined"
                      onPress={() => oeffneManuelleEingabe(anf.typ)}
                      icon="pencil"
                    >
                      {messung ? 'Ändern' : 'Eingeben'}
                    </Button>
                  </View>
                )}
              />
            </Card>
          );
        })}

        <Text variant="titleMedium" style={styles.abschnittTitel}>Optionale Messungen</Text>
        {anforderungen.filter(a => !a.pflicht).map(anf => {
          const messung = seite.messungen.find(m => m.typ === anf.typ);
          return (
            <Card key={anf.typ} style={[styles.messungsKarte, styles.optionalKarte]}>
              <List.Item
                title={anf.bezeichnung}
                left={props => (
                  <List.Icon {...props} icon={messung ? 'check' : 'minus'} color={messung ? '#2E7D32' : '#9E9E9E'} />
                )}
                right={() => (
                  <View style={styles.messungsRechts}>
                    {messung && (
                      <Text variant="bodyMedium" style={styles.messungsWert}>
                        {messung.wert >= 1 ? `${messung.wert.toFixed(2)} m` : `${Math.round(messung.wert * 100)} cm`}
                      </Text>
                    )}
                    <Button compact mode="text" onPress={() => oeffneManuelleEingabe(anf.typ)} icon="pencil">
                      {messung ? 'Ändern' : 'Eingeben'}
                    </Button>
                  </View>
                )}
              />
            </Card>
          );
        })}

        <Button
          mode="contained"
          style={styles.fertigButton}
          onPress={() => router.back()}
          icon="check"
        >
          Zurück zur Übersicht
        </Button>
      </ScrollView>

      <Portal>
        <Dialog visible={manuelleEingabeOffen} onDismiss={() => setManuelleEingabeOffen(false)}>
          <Dialog.Title>{TYP_LABELS[aktuellerTyp]} eingeben</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Messwert"
              value={eingabeWert}
              onChangeText={setEingabeWert}
              mode="outlined"
              keyboardType="decimal-pad"
              autoFocus
              style={{ marginBottom: 12 }}
            />
            <SegmentedButtons
              value={eingabeEinheit}
              onValueChange={v => setEingabeEinheit(v as 'mm' | 'cm' | 'm')}
              buttons={[
                { value: 'mm', label: 'mm' },
                { value: 'cm', label: 'cm' },
                { value: 'm', label: 'm' },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setManuelleEingabeOffen(false)}>Abbrechen</Button>
            <Button mode="contained" onPress={speichereManuelleMessung}>Speichern</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 16, paddingBottom: 40 },
  kopfKarte: { marginBottom: 16, elevation: 2 },
  statusRow: { marginTop: 8 },
  abschnittTitel: { fontWeight: 'bold', marginTop: 16, marginBottom: 8, color: '#1565C0' },
  messungsKarte: { marginBottom: 6, elevation: 1 },
  optionalKarte: { opacity: 0.85 },
  messungsRechts: { alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  messungsWert: { fontWeight: 'bold', color: '#1565C0' },
  fertigButton: { marginTop: 24, backgroundColor: '#1565C0' },
});
