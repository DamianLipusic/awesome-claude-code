import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, List, Divider, TextInput, Button, Snackbar, SegmentedButtons, HelperText } from 'react-native-paper';
import { useState } from 'react';
import { useEinstellungenStore } from '../../src/store/settingsStore';

const LASTKLASSEN = [
  { value: '2', label: 'LK 2' },
  { value: '3', label: 'LK 3' },
  { value: '4', label: 'LK 4' },
  { value: '5', label: 'LK 5' },
  { value: '6', label: 'LK 6' },
];

export default function Einstellungen() {
  const firmenname = useEinstellungenStore(s => s.firmenname);
  const firmenadresse = useEinstellungenStore(s => s.firmenadresse);
  const firmentelefon = useEinstellungenStore(s => s.firmentelefon);
  const firmenemail = useEinstellungenStore(s => s.firmenemail);
  const standardEinheit = useEinstellungenStore(s => s.standardEinheit);
  const standardLastklasse = useEinstellungenStore(s => s.standardLastklasse);
  const sicherheitszuschlag = useEinstellungenStore(s => s.sicherheitszuschlag);

  const setzeFiremenname = useEinstellungenStore(s => s.setzeFiremenname);
  const setzeFirmenadresse = useEinstellungenStore(s => s.setzeFirmenadresse);
  const setzeFirmentelefon = useEinstellungenStore(s => s.setzeFirmentelefon);
  const setzeFirmenemail = useEinstellungenStore(s => s.setzeFirmenemail);
  const setzeStandardEinheit = useEinstellungenStore(s => s.setzeStandardEinheit);
  const setzeStandardLastklasse = useEinstellungenStore(s => s.setzeStandardLastklasse);
  const setzeSicherheitszuschlag = useEinstellungenStore(s => s.setzeSicherheitszuschlag);
  const speichereEinstellungen = useEinstellungenStore(s => s.speichereEinstellungen);

  const [gespeichert, setGespeichert] = useState(false);
  const [zuschlagText, setZuschlagText] = useState(String(sicherheitszuschlag));

  async function speichern() {
    const zahl = parseFloat(zuschlagText.replace(',', '.'));
    if (!isNaN(zahl) && zahl >= 0 && zahl <= 30) {
      setzeSicherheitszuschlag(zahl);
    }
    await speichereEinstellungen();
    setGespeichert(true);
  }

  const zuschlagFehler = (() => {
    const z = parseFloat(zuschlagText.replace(',', '.'));
    return isNaN(z) || z < 0 || z > 30;
  })();

  return (
    <>
      <ScrollView style={styles.container}>

        {/* Company info */}
        <List.Section title="Firmendaten (erscheinen im PDF-Kopf)">
          <View style={styles.inputContainer}>
            <TextInput
              label="Firmenname *"
              value={firmenname}
              onChangeText={setzeFiremenname}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="domain" />}
            />
            <TextInput
              label="Adresse"
              value={firmenadresse}
              onChangeText={setzeFirmenadresse}
              mode="outlined"
              style={styles.input}
              placeholder="Musterstr. 12, 12345 Musterstadt"
              left={<TextInput.Icon icon="map-marker" />}
            />
            <TextInput
              label="Telefon"
              value={firmentelefon}
              onChangeText={setzeFirmentelefon}
              mode="outlined"
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="+49 123 456789"
              left={<TextInput.Icon icon="phone" />}
            />
            <TextInput
              label="E-Mail"
              value={firmenemail}
              onChangeText={setzeFirmenemail}
              mode="outlined"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="info@firma.de"
              left={<TextInput.Icon icon="email" />}
            />
          </View>
        </List.Section>

        <Divider />

        {/* Units */}
        <List.Section title="Maßeinheit">
          <View style={styles.inputContainer}>
            <SegmentedButtons
              value={standardEinheit}
              onValueChange={v => setzeStandardEinheit(v as 'm' | 'cm')}
              buttons={[
                { value: 'm', label: 'Meter (m)' },
                { value: 'cm', label: 'Zentimeter (cm)' },
              ]}
            />
          </View>
        </List.Section>

        <Divider />

        {/* Defaults */}
        <List.Section title="Berechnungsstandards">
          <View style={styles.inputContainer}>
            <Text variant="bodyMedium" style={styles.label}>Standard-Lastklasse (neue Projekte)</Text>
            <SegmentedButtons
              value={standardLastklasse}
              onValueChange={v => setzeStandardLastklasse(v as '2' | '3' | '4' | '5' | '6')}
              buttons={LASTKLASSEN}
              style={styles.segmented}
            />
            <Text variant="bodySmall" style={styles.hinweis}>
              LK 2 = leicht (Kontrolle), LK 3 = mittel (Arbeitsgerüst), LK 4–6 = schwer (Industrie)
            </Text>

            <TextInput
              label="Materialmengenzuschlag (%)"
              value={zuschlagText}
              onChangeText={setZuschlagText}
              mode="outlined"
              style={[styles.input, { marginTop: 16 }]}
              keyboardType="decimal-pad"
              error={zuschlagFehler}
              left={<TextInput.Icon icon="plus-circle-outline" />}
            />
            {zuschlagFehler && (
              <HelperText type="error">Bitte einen Wert zwischen 0 und 30 eingeben.</HelperText>
            )}
            <Text variant="bodySmall" style={styles.hinweis}>
              Sicherheitspuffer auf berechnete Materialmengen (Standard: 5 %)
            </Text>
          </View>
        </List.Section>

        <Divider />

        {/* App info */}
        <List.Section title="App-Info">
          <List.Item title="Version" description="1.0.0" left={props => <List.Icon {...props} icon="information" />} />
          <List.Item
            title="Gerüstbau Pro"
            description="Für professionelle Gerüstbauer"
            left={props => <List.Icon {...props} icon="crane" />}
          />
        </List.Section>

        <View style={styles.saveButton}>
          <Button mode="contained" onPress={speichern} icon="content-save" disabled={zuschlagFehler}>
            Einstellungen speichern
          </Button>
        </View>
      </ScrollView>

      <Snackbar visible={gespeichert} onDismiss={() => setGespeichert(false)} duration={2000}>
        Einstellungen gespeichert ✓
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inputContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  input: { backgroundColor: 'white', marginBottom: 10 },
  label: { marginBottom: 8, fontWeight: '500', color: '#333' },
  segmented: { marginBottom: 4 },
  hinweis: { color: '#888', marginTop: 4, marginBottom: 4 },
  saveButton: { padding: 16, paddingBottom: 40 },
});
