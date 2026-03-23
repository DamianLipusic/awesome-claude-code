import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import {
  Text, Card, Button, FAB, TextInput, Dialog, Portal,
  List, Divider, Chip, SegmentedButtons, IconButton,
} from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import { useProjektStore } from '../../../src/store/projectStore';
import type { Oeffnung } from '../../../src/models/Project';

type OeffnungsTyp = Oeffnung['typ'];

const TYP_LABELS: Record<OeffnungsTyp, string> = {
  fenster: 'Fenster',
  tuer: 'Tür',
  tor: 'Tor',
  sonstiges: 'Sonstiges',
};

const TYP_ICONS: Record<OeffnungsTyp, string> = {
  fenster: 'window-open',
  tuer: 'door',
  tor: 'garage',
  sonstiges: 'shape-outline',
};

const LEERE_EINGABE = {
  typ: 'fenster' as OeffnungsTyp,
  breite: '',
  hoehe: '',
  bruestungHoehe: '',
  horizontalOffset: '',
};

export default function OeffnungenScreen() {
  const { id: projektId, seitenId } = useLocalSearchParams<{ id: string; seitenId: string }>();
  const [dialogOffen, setDialogOffen] = useState(false);
  const [eingabe, setEingabe] = useState(LEERE_EINGABE);

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const fuegeOeffnungHinzu = useProjektStore(s => s.fuegeOeffnungHinzu);
  const loescheOeffnung = useProjektStore(s => s.loescheOeffnung);

  if (!projekt) return null;
  const seite = projekt.seiten.find(s => s.id === seitenId);
  if (!seite) return null;

  function oeffneDialog() {
    setEingabe(LEERE_EINGABE);
    setDialogOffen(true);
  }

  function speichereOeffnung() {
    const breite = parseFloat(eingabe.breite.replace(',', '.'));
    const hoehe = parseFloat(eingabe.hoehe.replace(',', '.'));
    const bruestung = parseFloat(eingabe.bruestungHoehe.replace(',', '.'));
    const offset = parseFloat(eingabe.horizontalOffset.replace(',', '.') || '0');

    if (isNaN(breite) || breite <= 0 || isNaN(hoehe) || hoehe <= 0) return;

    fuegeOeffnungHinzu(projektId, seitenId, {
      typ: eingabe.typ,
      breite,
      hoehe,
      brustuengHoehe: isNaN(bruestung) ? 0 : bruestung,
      horizontalOffset: isNaN(offset) ? 0 : offset,
    });
    setDialogOffen(false);
  }

  function oeffnungLoeschen(oeffnung: Oeffnung) {
    Alert.alert(
      'Öffnung löschen',
      `${TYP_LABELS[oeffnung.typ]} (${oeffnung.breite.toFixed(2)} × ${oeffnung.hoehe.toFixed(2)} m) wirklich löschen?`,
      [
        { text: 'Abbrechen', style: 'cancel' },
        { text: 'Löschen', style: 'destructive', onPress: () => loescheOeffnung(projektId, seitenId, oeffnung.id) },
      ],
    );
  }

  const kannSpeichern =
    eingabe.breite !== '' && eingabe.hoehe !== '' &&
    !isNaN(parseFloat(eingabe.breite)) && !isNaN(parseFloat(eingabe.hoehe));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.inhalt}>
        <Card style={styles.kopfKarte}>
          <Card.Content>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>{seite.anzeigename}</Text>
            <Text variant="bodySmall" style={styles.hinweis}>
              Erfassen Sie Fenster, Türen und andere Öffnungen für eine präzise Materialberechnung.
            </Text>
          </Card.Content>
        </Card>

        {seite.oeffnungen.length === 0 ? (
          <View style={styles.leer}>
            <Text variant="bodyLarge" style={styles.leerText}>Keine Öffnungen erfasst</Text>
            <Text variant="bodyMedium" style={styles.leerSubtext}>
              Tippen Sie auf + um Fenster, Türen oder Tore hinzuzufügen.
            </Text>
          </View>
        ) : (
          seite.oeffnungen.map((o, idx) => (
            <Card key={o.id} style={styles.oeffnungsKarte}>
              <List.Item
                title={`${TYP_LABELS[o.typ]} ${idx + 1}`}
                description={`${o.breite.toFixed(2)} × ${o.hoehe.toFixed(2)} m · Brüstung ${o.brustuengHoehe.toFixed(2)} m · Offset ${o.horizontalOffset.toFixed(2)} m`}
                left={props => <List.Icon {...props} icon={TYP_ICONS[o.typ]} color="#1565C0" />}
                right={() => (
                  <IconButton icon="delete" iconColor="#D32F2F" onPress={() => oeffnungLoeschen(o)} />
                )}
              />
            </Card>
          ))
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={oeffneDialog}
        label="Öffnung hinzufügen"
      />

      <Portal>
        <Dialog visible={dialogOffen} onDismiss={() => setDialogOffen(false)}>
          <Dialog.Title>Öffnung erfassen</Dialog.Title>
          <Dialog.ScrollArea style={styles.dialogScroll}>
            <ScrollView>
              <Text variant="labelMedium" style={styles.feldLabel}>Typ</Text>
              <SegmentedButtons
                value={eingabe.typ}
                onValueChange={v => setEingabe(e => ({ ...e, typ: v as OeffnungsTyp }))}
                buttons={[
                  { value: 'fenster', label: 'Fenster' },
                  { value: 'tuer', label: 'Tür' },
                  { value: 'tor', label: 'Tor' },
                  { value: 'sonstiges', label: 'Sonst.' },
                ]}
                style={styles.typButtons}
              />

              <View style={styles.zweispaltig}>
                <TextInput
                  label="Breite (m) *"
                  value={eingabe.breite}
                  onChangeText={v => setEingabe(e => ({ ...e, breite: v }))}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={[styles.feld, styles.halbBreit]}
                />
                <TextInput
                  label="Höhe (m) *"
                  value={eingabe.hoehe}
                  onChangeText={v => setEingabe(e => ({ ...e, hoehe: v }))}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={[styles.feld, styles.halbBreit]}
                />
              </View>

              <View style={styles.zweispaltig}>
                <TextInput
                  label="Brüstungshöhe (m)"
                  value={eingabe.bruestungHoehe}
                  onChangeText={v => setEingabe(e => ({ ...e, bruestungHoehe: v }))}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={[styles.feld, styles.halbBreit]}
                  placeholder="z.B. 0.90"
                />
                <TextInput
                  label="Abstand links (m)"
                  value={eingabe.horizontalOffset}
                  onChangeText={v => setEingabe(e => ({ ...e, horizontalOffset: v }))}
                  mode="outlined"
                  keyboardType="decimal-pad"
                  style={[styles.feld, styles.halbBreit]}
                  placeholder="z.B. 1.50"
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setDialogOffen(false)}>Abbrechen</Button>
            <Button mode="contained" onPress={speichereOeffnung} disabled={!kannSpeichern}>
              Speichern
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 16, paddingBottom: 120 },
  kopfKarte: { marginBottom: 16, elevation: 2 },
  hinweis: { color: '#666', marginTop: 6 },
  oeffnungsKarte: { marginBottom: 8, elevation: 1 },
  leer: { alignItems: 'center', paddingTop: 48, paddingBottom: 32 },
  leerText: { color: '#666', marginBottom: 8 },
  leerSubtext: { color: '#999', textAlign: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#1565C0' },
  dialogScroll: { maxHeight: 420 },
  feldLabel: { color: '#666', marginBottom: 6, marginTop: 4 },
  typButtons: { marginBottom: 12 },
  zweispaltig: { flexDirection: 'row', gap: 8 },
  feld: { marginBottom: 8, backgroundColor: 'white' },
  halbBreit: { flex: 1 },
});
