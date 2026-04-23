import { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, HelperText } from 'react-native-paper';
import { router } from 'expo-router';
import { useProjektStore } from '../../src/store/projectStore';
import { useIapStore, FREE_PROJEKT_LIMIT } from '../../src/store/iapStore';
import type { ScaffoldSystemId, ScaffoldPurpose } from '../../src/models/Project';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const SYSTEME: { label: string; value: ScaffoldSystemId; beschreibung: string; icon: string }[] = [
  { label: 'Layher Allround', value: 'layher-allround', beschreibung: 'Modulgerüst mit Allround-Rosette — am häufigsten verwendet', icon: 'star' },
  { label: 'Layher Blitz', value: 'layher-blitz', beschreibung: 'Stahlrohrgerüst Blitz-System', icon: 'lightning-bolt' },
  { label: 'Tobler', value: 'tobler', beschreibung: 'Tobler Gerüste AG', icon: 'grid' },
];

const ZWECKE: { label: string; value: ScaffoldPurpose; beschreibung: string; icon: string }[] = [
  { label: '🏠  Fassade', value: 'fassade', beschreibung: 'Außenfassade, Putz, Anstrich — am häufigsten', icon: 'home' },
  { label: '🏭  Innen', value: 'innen', beschreibung: 'Innengerüst, Deckenarbeiten', icon: 'home-floor-b' },
  { label: '⚙️  Industrie', value: 'industrie', beschreibung: 'Industrieanlagen, Tanks, Brücken', icon: 'factory' },
];

type Schritt = 1 | 2 | 3;

const SCHRITT_TITEL: Record<Schritt, string> = {
  1: 'Schritt 1 von 3 — Gerüstsystem',
  2: 'Schritt 2 von 3 — Verwendungszweck',
  3: 'Schritt 3 von 3 — Projektdaten',
};

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
  const projektAnzahl = useProjektStore(s => s.projekte.length);
  const istPremium = useIapStore(s => s.istPremium);

  function weiter() {
    if (schritt < 3) setSchritt((schritt + 1) as Schritt);
  }

  function zurueck() {
    if (schritt > 1) setSchritt((schritt - 1) as Schritt);
  }

  function erstellen() {
    // Paywall: free users may only create FREE_PROJEKT_LIMIT projects
    if (!istPremium && projektAnzahl >= FREE_PROJEKT_LIMIT) {
      router.replace('/paywall');
      return;
    }

    const gh = parseFloat(gesamthoehe.replace(',', '.'));
    const et = parseInt(etagen, 10);
    const ah = parseFloat(arbeitshoehe.replace(',', '.')) || gh;

    if (!name.trim() || isNaN(gh) || gh <= 0 || isNaN(et) || et <= 0) return;

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

  const kannWeiter = schritt === 3
    ? name.trim() !== '' &&
      parseFloat(gesamthoehe.replace(',', '.')) > 0 &&
      parseInt(etagen, 10) > 0
    : true;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>
      {/* Step indicator */}
      <View style={styles.schrittAnzeige}>
        {([1, 2, 3] as Schritt[]).map(s => (
          <View key={s} style={styles.schrittItem}>
            <View style={[styles.schrittKreis, schritt >= s && styles.schrittKreisAktiv]}>
              {schritt > s
                ? <Text style={styles.schrittCheck}>✓</Text>
                : <Text style={[styles.schrittNummer, schritt >= s && styles.schrittNummerAktiv]}>{s}</Text>
              }
            </View>
            {s < 3 && <View style={[styles.schrittVerbindung, schritt > s && styles.schrittVerbindungAktiv]} />}
          </View>
        ))}
      </View>
      <Text variant="titleMedium" style={styles.schrittTitel}>{SCHRITT_TITEL[schritt]}</Text>

      {/* Step 1: System selection */}
      {schritt === 1 && (
        <View>
          <Text variant="bodyLarge" style={styles.hinweis}>
            Welches Gerüstsystem verwenden Sie? Bei Unsicherheit wählen Sie Layher Allround.
          </Text>
          {SYSTEME.map(s => (
            <TouchableOpacity
              key={s.value}
              style={[styles.auswahlKarte, systemId === s.value && styles.auswahlKarteAktiv]}
              onPress={() => setSystemId(s.value)}
              activeOpacity={0.8}
            >
              <View style={[styles.auswahlKarteLinks, systemId === s.value && styles.auswahlKarteLinksAktiv]}>
                <MaterialCommunityIcons
                  name={s.icon as any}
                  size={28}
                  color={systemId === s.value ? 'white' : '#1565C0'}
                />
              </View>
              <View style={styles.auswahlKarteText}>
                <Text variant="titleMedium" style={systemId === s.value ? styles.auswahlTitelAktiv : styles.auswahlTitel}>
                  {s.label}
                </Text>
                <Text variant="bodyMedium" style={styles.auswahlBeschreibung}>{s.beschreibung}</Text>
              </View>
              {systemId === s.value && (
                <Text style={styles.auswahlHaken}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Step 2: Purpose */}
      {schritt === 2 && (
        <View>
          <Text variant="bodyLarge" style={styles.hinweis}>
            Wofür wird das Gerüst verwendet?
          </Text>
          {ZWECKE.map(z => (
            <TouchableOpacity
              key={z.value}
              style={[styles.auswahlKarte, zweck === z.value && styles.auswahlKarteAktiv]}
              onPress={() => setZweck(z.value)}
              activeOpacity={0.8}
            >
              <View style={styles.auswahlKarteText}>
                <Text variant="titleMedium" style={zweck === z.value ? styles.auswahlTitelAktiv : styles.auswahlTitel}>
                  {z.label}
                </Text>
                <Text variant="bodyMedium" style={styles.auswahlBeschreibung}>{z.beschreibung}</Text>
              </View>
              {zweck === z.value && (
                <Text style={styles.auswahlHaken}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Step 3: Project details */}
      {schritt === 3 && (
        <View>
          <Text variant="bodyLarge" style={styles.hinweis}>
            Geben Sie die wichtigsten Projektdaten ein. Felder mit * sind Pflicht.
          </Text>

          <Text variant="labelLarge" style={styles.feldLabel}>Projektname *</Text>
          <TextInput
            label="z.B. Mustergasse 12, Wien"
            value={name}
            onChangeText={setName}
            mode="outlined"
            style={styles.feld}
          />

          <Text variant="labelLarge" style={styles.feldLabel}>Adresse</Text>
          <TextInput
            label="Straße, Ort"
            value={adresse}
            onChangeText={setAdresse}
            mode="outlined"
            style={styles.feld}
          />

          <Text variant="labelLarge" style={styles.feldLabel}>Auftraggeber</Text>
          <TextInput
            label="Name des Auftraggebers"
            value={auftraggeber}
            onChangeText={setAuftraggeber}
            mode="outlined"
            style={styles.feld}
          />

          <Text variant="labelLarge" style={styles.feldLabel}>Gebäudehöhe in Meter *</Text>
          <TextInput
            label="z.B. 12,5"
            value={gesamthoehe}
            onChangeText={setGesamthoehe}
            mode="outlined"
            style={styles.feld}
            keyboardType="decimal-pad"
          />
          <HelperText type="info" style={styles.hilfeText}>
            Gesamthöhe des Gebäudes vom Boden bis zur Traufe
          </HelperText>

          <Text variant="labelLarge" style={styles.feldLabel}>Anzahl Stockwerke *</Text>
          <TextInput
            label="z.B. 3"
            value={etagen}
            onChangeText={setEtagen}
            mode="outlined"
            style={styles.feld}
            keyboardType="number-pad"
          />

          <Text variant="labelLarge" style={styles.feldLabel}>Arbeitshöhe in Meter</Text>
          <TextInput
            label="Leer lassen = Gebäudehöhe"
            value={arbeitshoehe}
            onChangeText={setArbeitshoehe}
            mode="outlined"
            style={styles.feld}
            keyboardType="decimal-pad"
          />
          <HelperText type="info" style={styles.hilfeText}>
            Höhe bis zum höchsten Arbeitsbelag. Meist = Gebäudehöhe.
          </HelperText>
        </View>
      )}

      {/* Navigation buttons */}
      <View style={styles.navigation}>
        {schritt > 1 && (
          <Button
            mode="outlined"
            onPress={zurueck}
            style={styles.navButton}
            contentStyle={styles.navButtonInhalt}
            labelStyle={{ fontSize: 16 }}
          >
            ← Zurück
          </Button>
        )}
        {schritt < 3 ? (
          <Button
            mode="contained"
            onPress={weiter}
            style={[styles.navButton, styles.navButtonRechts]}
            contentStyle={styles.navButtonInhalt}
            labelStyle={{ fontSize: 16 }}
          >
            Weiter →
          </Button>
        ) : (
          <Button
            mode="contained"
            onPress={erstellen}
            disabled={!kannWeiter}
            style={[styles.navButton, styles.navButtonRechts]}
            contentStyle={styles.navButtonInhalt}
            icon="check-circle"
            labelStyle={{ fontSize: 16 }}
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
  inhalt: { padding: 20, paddingBottom: 48 },

  schrittAnzeige: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  schrittItem: { flexDirection: 'row', alignItems: 'center' },
  schrittKreis: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schrittKreisAktiv: { backgroundColor: '#1565C0' },
  schrittNummer: { color: '#666', fontWeight: 'bold', fontSize: 18 },
  schrittNummerAktiv: { color: 'white' },
  schrittCheck: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  schrittVerbindung: { width: 32, height: 3, backgroundColor: '#E0E0E0', marginHorizontal: 4 },
  schrittVerbindungAktiv: { backgroundColor: '#1565C0' },
  schrittTitel: { textAlign: 'center', color: '#1565C0', fontWeight: 'bold', marginBottom: 20, fontSize: 16 },

  hinweis: { color: '#555', marginBottom: 16, lineHeight: 22 },

  auswahlKarte: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    elevation: 1,
    minHeight: 72,
  },
  auswahlKarteAktiv: { borderColor: '#1565C0', elevation: 3 },
  auswahlKarteLinks: {
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#E3F2FD',
  },
  auswahlKarteLinksAktiv: { backgroundColor: '#1565C0' },
  auswahlKarteText: { flex: 1, padding: 14 },
  auswahlTitel: { fontWeight: 'bold', color: '#333', fontSize: 15 },
  auswahlTitelAktiv: { fontWeight: 'bold', color: '#1565C0', fontSize: 15 },
  auswahlBeschreibung: { color: '#666', marginTop: 2, lineHeight: 20 },
  auswahlHaken: { fontSize: 22, color: '#1565C0', paddingRight: 16, fontWeight: 'bold' },

  feldLabel: { color: '#1565C0', marginBottom: 4, marginTop: 8, fontWeight: 'bold' },
  feld: { marginBottom: 2, backgroundColor: 'white' },
  hilfeText: { marginBottom: 4 },

  navigation: { flexDirection: 'row', marginTop: 28, gap: 12 },
  navButton: { flex: 1, borderRadius: 10 },
  navButtonInhalt: { height: 56 },
  navButtonRechts: { backgroundColor: '#1565C0' },
});
