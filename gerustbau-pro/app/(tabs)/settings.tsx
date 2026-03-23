import { View, ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { Text, List, Divider, TextInput, Button, Snackbar, SegmentedButtons, HelperText, Portal, Dialog, Chip } from 'react-native-paper';
import { useState } from 'react';
import { router } from 'expo-router';
import { useEinstellungenStore } from '../../src/store/settingsStore';
import { useProjektStore } from '../../src/store/projectStore';
import { useIapStore } from '../../src/store/iapStore';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

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

  const exportiereAlsJson = useProjektStore(s => s.exportiereAlsJson);
  const importiereAusJson = useProjektStore(s => s.importiereAusJson);
  const projekte = useProjektStore(s => s.projekte);

  const istPremium = useIapStore(s => s.istPremium);
  const kundenInfo = useIapStore(s => s.kundenInfo);
  const kaeufeWiederherstellen = useIapStore(s => s.kaeufeWiederherstellen);
  const [wiederherstellungLaeuft, setWiederherstellungLaeuft] = useState(false);

  async function onKaeufeWiederherstellen() {
    setWiederherstellungLaeuft(true);
    const { erfolg, fehler } = await kaeufeWiederherstellen();
    setWiederherstellungLaeuft(false);
    if (erfolg) {
      Alert.alert('Käufe wiederhergestellt', 'Ihr Abonnement wurde erfolgreich wiederhergestellt.');
    } else {
      Alert.alert('Kein Kauf gefunden', fehler ?? 'Es wurde kein aktives Abonnement für dieses Konto gefunden.');
    }
  }

  const ablaufDatum = kundenInfo?.entitlements.active['premium']?.expirationDate;

  const [gespeichert, setGespeichert] = useState(false);
  const [zuschlagText, setZuschlagText] = useState(String(sicherheitszuschlag));
  const [importDialog, setImportDialog] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportLaeuft, setExportLaeuft] = useState(false);

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

  async function exportieren() {
    setExportLaeuft(true);
    try {
      const json = exportiereAlsJson();
      const pfad = (FileSystem.cacheDirectory ?? '') + 'gerustbau-backup.json';
      await FileSystem.writeAsStringAsync(pfad, json, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pfad, { mimeType: 'application/json', dialogTitle: 'Datensicherung exportieren' });
      } else {
        Alert.alert('Gespeichert', `Backup gespeichert unter:\n${pfad}`);
      }
    } catch (e) {
      Alert.alert('Fehler', 'Export fehlgeschlagen.');
    } finally {
      setExportLaeuft(false);
    }
  }

  function importierenBestaetigen() {
    if (!importText.trim()) return;
    const ergebnis = importiereAusJson(importText.trim());
    setImportDialog(false);
    setImportText('');
    if (ergebnis.erfolg) {
      Alert.alert('Import erfolgreich', `${ergebnis.anzahl} neue Projekt(e) importiert.`);
    } else {
      Alert.alert('Fehler', ergebnis.fehler ?? 'Import fehlgeschlagen.');
    }
  }

  return (
    <>
      <Portal>
        <Dialog visible={importDialog} onDismiss={() => setImportDialog(false)}>
          <Dialog.Title>JSON-Backup einfügen</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodySmall" style={{ color: '#666', marginBottom: 8 }}>
              Fügen Sie den Inhalt einer exportierten Backup-Datei hier ein:
            </Text>
            <TextInput
              mode="outlined"
              multiline
              numberOfLines={6}
              value={importText}
              onChangeText={setImportText}
              placeholder='{ "version": 1, "projekte": [...] }'
              style={{ backgroundColor: 'white', fontSize: 11 }}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setImportDialog(false); setImportText(''); }}>Abbrechen</Button>
            <Button mode="contained" onPress={importierenBestaetigen} disabled={!importText.trim()}>Importieren</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

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

        <Divider />

        {/* Backup */}
        <List.Section title="Datensicherung">
          <View style={styles.inputContainer}>
            <Text variant="bodySmall" style={styles.hinweis}>
              Alle {projekte.length} Projekt(e) als JSON-Datei exportieren oder importieren.
              Bestehende Projekte werden beim Import nicht überschrieben.
            </Text>
            <Button
              mode="outlined"
              icon="export"
              onPress={exportieren}
              loading={exportLaeuft}
              disabled={exportLaeuft || projekte.length === 0}
              style={styles.backupButton}
            >
              Projekte exportieren (JSON)
            </Button>
            <Button
              mode="outlined"
              icon="import"
              onPress={() => setImportDialog(true)}
              style={styles.backupButton}
            >
              Projekte importieren (JSON einfügen)
            </Button>
          </View>
        </List.Section>

        <Divider />

        {/* Subscription */}
        <List.Section title="Abonnement">
          <View style={styles.aboContainer}>
            <View style={styles.aboKopf}>
              <Text variant="titleMedium" style={styles.aboTitel}>Gerüstbau Pro</Text>
              <Chip
                compact
                style={istPremium ? styles.aboChipPremium : styles.aboChipFree}
                textStyle={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}
              >
                {istPremium ? 'PRO AKTIV' : 'KOSTENLOS'}
              </Chip>
            </View>

            {istPremium ? (
              <>
                <Text variant="bodySmall" style={styles.aboInfo}>
                  Alle Funktionen sind freigeschaltet.
                  {ablaufDatum ? `\nVerlängerung am ${new Date(ablaufDatum).toLocaleDateString('de-AT')}.` : ''}
                </Text>
                <Button
                  mode="outlined"
                  compact
                  style={styles.aboButton}
                  onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
                  icon="open-in-new"
                >
                  Abo in App Store verwalten
                </Button>
              </>
            ) : (
              <>
                <Text variant="bodySmall" style={styles.aboInfo}>
                  1 Gratis-Projekt · Alle weiteren Projekte, PDF-Export und alle Auswertungen erfordern ein Pro-Abo.
                </Text>
                <Button
                  mode="contained"
                  compact
                  style={[styles.aboButton, { backgroundColor: '#1565C0' }]}
                  onPress={() => router.push('/paywall')}
                  icon="star-circle"
                >
                  Auf Pro upgraden
                </Button>
              </>
            )}

            <Button
              mode="text"
              compact
              style={styles.wiederherstellenButton}
              onPress={onKaeufeWiederherstellen}
              loading={wiederherstellungLaeuft}
              disabled={wiederherstellungLaeuft}
              textColor="#666"
            >
              Käufe wiederherstellen
            </Button>
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
  backupButton: { marginBottom: 10 },
  saveButton: { padding: 16, paddingBottom: 40 },

  aboContainer: { paddingHorizontal: 16, paddingBottom: 12 },
  aboKopf: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  aboTitel: { fontWeight: 'bold', color: '#1565C0' },
  aboChipPremium: { backgroundColor: '#2E7D32' },
  aboChipFree: { backgroundColor: '#9E9E9E' },
  aboInfo: { color: '#555', lineHeight: 18, marginBottom: 10 },
  aboButton: { marginBottom: 4 },
  wiederherstellenButton: { alignSelf: 'flex-start' },
});
