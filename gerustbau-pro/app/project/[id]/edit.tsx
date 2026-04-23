import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, HelperText, Divider } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useProjektStore } from '../../../src/store/projectStore';

export default function ProjektBearbeiten() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === id));
  const aktualisierteProjekt = useProjektStore(s => s.aktualisierteProjekt);

  const [name, setName] = useState(projekt?.name ?? '');
  const [adresse, setAdresse] = useState(projekt?.adresse ?? '');
  const [auftraggeber, setAuftraggeber] = useState(projekt?.auftraggeber ?? '');
  const [gesamthoehe, setGesamthoehe] = useState(String(projekt?.gesamthoehe ?? ''));
  const [etagen, setEtagen] = useState(String(projekt?.etagen ?? ''));
  const [arbeitshoehe, setArbeitshoehe] = useState(String(projekt?.arbeitshoehe ?? ''));
  const [termin, setTermin] = useState(projekt?.termin ?? '');
  const [gespeichert, setGespeichert] = useState(false);

  if (!projekt) return null;

  const nameGueltig = name.trim().length > 0;
  const hoeheGueltig = !isNaN(parseFloat(gesamthoehe.replace(',', '.'))) && parseFloat(gesamthoehe.replace(',', '.')) > 0;
  const etagenGueltig = !isNaN(parseInt(etagen, 10)) && parseInt(etagen, 10) > 0;
  const kannSpeichern = nameGueltig && hoeheGueltig && etagenGueltig;

  function speichern() {
    if (!kannSpeichern) return;
    const gh = parseFloat(gesamthoehe.replace(',', '.'));
    const et = parseInt(etagen, 10);
    const ah = parseFloat(arbeitshoehe.replace(',', '.'));

    const terminGueltig = !termin.trim() || /^\d{4}-\d{2}-\d{2}$/.test(termin.trim());
    if (termin.trim() && !terminGueltig) {
      Alert.alert('Ungültiges Datum', 'Bitte im Format JJJJ-MM-TT eingeben (z.B. 2026-08-31).');
      return;
    }
    aktualisierteProjekt(id, {
      name: name.trim(),
      adresse: adresse.trim() || undefined,
      auftraggeber: auftraggeber.trim() || undefined,
      gesamthoehe: gh,
      etagen: et,
      arbeitshoehe: isNaN(ah) || ah <= 0 ? gh : ah,
      termin: terminGueltig && termin.trim() ? termin.trim() : undefined,
    });
    setGespeichert(true);
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>
      <Text variant="titleMedium" style={styles.abschnitt}>Projektdaten</Text>

      <TextInput
        label="Projektname *"
        value={name}
        onChangeText={setName}
        mode="outlined"
        style={styles.feld}
        error={!nameGueltig && name.length > 0}
      />
      {!nameGueltig && name.length > 0 && (
        <HelperText type="error">Name darf nicht leer sein.</HelperText>
      )}

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
        label="Fertigstellungstermin (JJJJ-MM-TT)"
        value={termin}
        onChangeText={setTermin}
        mode="outlined"
        style={styles.feld}
        keyboardType="numbers-and-punctuation"
        placeholder="z.B. 2025-08-31"
        left={<TextInput.Icon icon="calendar" />}
      />
      <HelperText type="info" style={{ marginBottom: 4 }}>
        Leer lassen wenn kein Termin. Format: JJJJ-MM-TT
      </HelperText>

      <Divider style={styles.divider} />
      <Text variant="titleMedium" style={styles.abschnitt}>Abmessungen</Text>

      <TextInput
        label="Gebäudehöhe (m) *"
        value={gesamthoehe}
        onChangeText={setGesamthoehe}
        mode="outlined"
        style={styles.feld}
        keyboardType="decimal-pad"
        error={!hoeheGueltig && gesamthoehe.length > 0}
      />
      {!hoeheGueltig && gesamthoehe.length > 0 && (
        <HelperText type="error">Bitte eine gültige Höhe eingeben.</HelperText>
      )}

      <TextInput
        label="Anzahl Etagen *"
        value={etagen}
        onChangeText={setEtagen}
        mode="outlined"
        style={styles.feld}
        keyboardType="number-pad"
        error={!etagenGueltig && etagen.length > 0}
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

      <View style={styles.aktionen}>
        <Button mode="outlined" onPress={() => router.back()} style={styles.aktionButton}>
          Abbrechen
        </Button>
        <Button
          mode="contained"
          onPress={speichern}
          disabled={!kannSpeichern}
          style={[styles.aktionButton, styles.speichernButton]}
          icon="content-save"
        >
          Speichern
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 20, paddingBottom: 48 },
  abschnitt: { fontWeight: 'bold', color: '#1565C0', marginBottom: 12, marginTop: 8 },
  feld: { marginBottom: 8, backgroundColor: 'white' },
  divider: { marginVertical: 16 },
  aktionen: { flexDirection: 'row', gap: 12, marginTop: 24 },
  aktionButton: { flex: 1, height: 48, justifyContent: 'center' },
  speichernButton: { backgroundColor: '#1565C0' },
});
