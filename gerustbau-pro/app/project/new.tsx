import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Button, TextInput, SegmentedButtons, Divider, HelperText } from 'react-native-paper';
import { router } from 'expo-router';
import { useProjektStore } from '../../src/store/projectStore';
import type { ScaffoldSystemId, ScaffoldPurpose } from '../../src/models/Project';

const SYSTEME: { label: string; value: ScaffoldSystemId; beschreibung: string }[] = [
  { label: 'Layher Allround', value: 'layher-allround', beschreibung: 'Modulgerüst mit Allround-Rosette' },
  { label: 'Layher Blitz', value: 'layher-blitz', beschreibung: 'Stahlrohrgerüst Blitz-System' },
  { label: 'Tobler', value: 'tobler', beschreibung: 'Tobler Gerüste AG' },
];

const ZWECKE: { label: string; value: ScaffoldPurpose; beschreibung: string }[] = [
  { label: 'Fassade', value: 'fassade', beschreibung: 'Außenfassade, Putz, Anstrich' },
  { label: 'Innen', value: 'innen', beschreibung: 'Innengerüst, Deckenarbeiten' },
  { label: 'Industrie', value: 'industrie', beschreibung: 'Industrieanlagen, Tanks, Brücken' },
];

type Schritt = 1 | 2 | 3;

export default function NeueProjekt() {
  const [schritt, setSchritt] = useState<Schritt>(1);
  const [systemId, setSystemId] = useState<ScaffoldSystemId>('layher-allround');
  const [zweck, setZweck] = useState<ScaffoldPurpose>('fassade');
  const [name, setName] = useState('');
  const [adresse, setAdresse] = useState('');
  const [auftraggeber, setAuftraggeber] = useState('');
  const [gesamthoehe, setGesamthoehe] = useState('');
  const [etagen, setEtagen] = useState('');
  const [arbeitshoehe, setArbeitshoehe] = useState('');

  const erstelleProjekt = useProjektStore(s => s.erstelleProjekt);

  function weiter() {
    if (schritt < 3) setSchritt((schritt + 1) as Schritt);
  }

  function zurueck() {
    if (schritt > 1) setSchritt((schritt - 1) as Schritt);
  }

  function erstellen() {
    const gh = parseFloat(gesamthoehe.replace(',', '.'));
    const et = parseInt(etagen, 10);
    const ah = parseFloat(arbeitshoehe.replace(',', '.')) || gh;

    if (!name.trim() || isNaN(gh) || isNaN(et)) return;

    const id = erstelleProjekt({
      name: name.trim(),
      adresse: adresse.trim() || undefined,
      auftraggeber: auftraggeber.trim() || undefined,
      systemId,
      zweck,
      gesamthoehe: gh,
      etagen: et,
      arbeitshoehe: ah,
    });

    router.replace(`/project/${id}`);
  }

  const kannWeiter = schritt === 1 ? true
    : schritt === 2 ? true
    : name.trim() !== '' && gesamthoehe !== '' && etagen !== '';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>
      {/* Step indicator */}
      <View style={styles.schrittAnzeige}>
        {([1, 2, 3] as Schritt[]).map(s => (
          <View key={s} style={[styles.schrittPunkt, schritt >= s && styles.schrittPunktAktiv]}>
            <Text style={[styles.schrittNummer, schritt >= s && styles.schrittNummerAktiv]}>{s}</Text>
          </View>
        ))}
        <View style={styles.schrittLinie} />
      </View>

      {schritt === 1 && (
        <View>
          <Text variant="headlineSmall" style={styles.titel}>Gerüstsystem wählen</Text>
          {SYSTEME.map(s => (
            <View
              key={s.value}
              style={[styles.systemKarte, systemId === s.value && styles.systemKarteAktiv]}
            >
              <Button
                mode={systemId === s.value ? 'contained' : 'outlined'}
                onPress={() => setSystemId(s.value)}
                style={styles.systemButton}
                contentStyle={styles.systemButtonInhalt}
              >
                {s.label}
              </Button>
              <Text variant="bodySmall" style={styles.systemBeschreibung}>{s.beschreibung}</Text>
            </View>
          ))}
        </View>
      )}

      {schritt === 2 && (
        <View>
          <Text variant="headlineSmall" style={styles.titel}>Verwendungszweck</Text>
          {ZWECKE.map(z => (
            <View key={z.value} style={styles.systemKarte}>
              <Button
                mode={zweck === z.value ? 'contained' : 'outlined'}
                onPress={() => setZweck(z.value)}
                style={styles.systemButton}
              >
                {z.label}
              </Button>
              <Text variant="bodySmall" style={styles.systemBeschreibung}>{z.beschreibung}</Text>
            </View>
          ))}
        </View>
      )}

      {schritt === 3 && (
        <View>
          <Text variant="headlineSmall" style={styles.titel}>Projektdaten</Text>
          <TextInput
            label="Projektname *"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.feld}
            placeholder="z.B. Mustergasse 12, Wien"
          />
          <TextInput
            label="Adresse"
            value={adresse}
            onChangeText={setAdresse}
            mode="outlined"
            style={styles.feld}
          />
          <TextInput
            label="Auftraggeber"
            value={auftraggeber}
            onChangeText={setAuftraggeber}
            mode="outlined"
            style={styles.feld}
          />
          <TextInput
            label="Gebäudehöhe (m) *"
            value={gesamthoehe}
            onChangeText={setGesamthoehe}
            mode="outlined"
            style={styles.feld}
            keyboardType="decimal-pad"
            placeholder="z.B. 12,5"
          />
          <TextInput
            label="Anzahl Etagen *"
            value={etagen}
            onChangeText={setEtagen}
            mode="outlined"
            style={styles.feld}
            keyboardType="number-pad"
          />
          <TextInput
            label="Arbeitshöhe (m) — leer = Gebäudehöhe"
            value={arbeitshoehe}
            onChangeText={setArbeitshoehe}
            mode="outlined"
            style={styles.feld}
            keyboardType="decimal-pad"
          />
          <HelperText type="info">* Pflichtfelder</HelperText>
        </View>
      )}

      <View style={styles.navigation}>
        {schritt > 1 && (
          <Button mode="outlined" onPress={zurueck} style={styles.navButton}>Zurück</Button>
        )}
        {schritt < 3 ? (
          <Button
            mode="contained"
            onPress={weiter}
            disabled={!kannWeiter}
            style={[styles.navButton, styles.navButtonRechts]}
          >
            Weiter
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={erstellen}
            disabled={!kannWeiter}
            style={[styles.navButton, styles.navButtonRechts]}
            icon="check"
          >
            Projekt erstellen
          </Button>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 20, paddingBottom: 40 },
  schrittAnzeige: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, justifyContent: 'center', gap: 8 },
  schrittPunkt: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E0E0E0', alignItems: 'center', justifyContent: 'center' },
  schrittPunktAktiv: { backgroundColor: '#1565C0' },
  schrittNummer: { color: '#666', fontWeight: 'bold' },
  schrittNummerAktiv: { color: 'white' },
  schrittLinie: { position: 'absolute', height: 2, backgroundColor: '#E0E0E0', left: '20%', right: '20%', top: 17, zIndex: -1 },
  titel: { marginBottom: 20, fontWeight: 'bold', color: '#1565C0' },
  systemKarte: { marginBottom: 12 },
  systemKarteAktiv: { opacity: 1 },
  systemButton: { marginBottom: 4 },
  systemButtonInhalt: { height: 52 },
  systemBeschreibung: { color: '#666', paddingLeft: 8 },
  feld: { marginBottom: 12, backgroundColor: 'white' },
  navigation: { flexDirection: 'row', marginTop: 24, gap: 12 },
  navButton: { flex: 1, height: 48, justifyContent: 'center' },
  navButtonRechts: { backgroundColor: '#1565C0' },
});
