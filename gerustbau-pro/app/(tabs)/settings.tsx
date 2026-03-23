import { useEffect } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, List, Divider, Switch, TextInput, Button, Snackbar } from 'react-native-paper';
import { useState } from 'react';
import { useEinstellungenStore } from '../../src/store/settingsStore';

export default function Einstellungen() {
  const firmenname = useEinstellungenStore(s => s.firmenname);
  const standardEinheit = useEinstellungenStore(s => s.standardEinheit);
  const setzeFiremenname = useEinstellungenStore(s => s.setzeFiremenname);
  const setzeStandardEinheit = useEinstellungenStore(s => s.setzeStandardEinheit);
  const speichereEinstellungen = useEinstellungenStore(s => s.speichereEinstellungen);

  const [gespeichert, setGespeichert] = useState(false);

  async function speichern() {
    await speichereEinstellungen();
    setGespeichert(true);
  }

  return (
    <>
      <ScrollView style={styles.container}>
        <List.Section title="Firmendaten">
          <View style={styles.inputContainer}>
            <TextInput
              label="Firmenname (für PDF-Kopfzeile)"
              value={firmenname}
              onChangeText={setzeFiremenname}
              mode="outlined"
              style={styles.input}
            />
          </View>
        </List.Section>
        <Divider />
        <List.Section title="Einheiten">
          <List.Item
            title="Meter (m)"
            right={() => (
              <Switch
                value={standardEinheit === 'm'}
                onValueChange={() => setzeStandardEinheit('m')}
              />
            )}
          />
          <List.Item
            title="Zentimeter (cm)"
            right={() => (
              <Switch
                value={standardEinheit === 'cm'}
                onValueChange={() => setzeStandardEinheit('cm')}
              />
            )}
          />
        </List.Section>
        <Divider />
        <List.Section title="App-Info">
          <List.Item title="Version" description="1.0.0" />
          <List.Item title="Gerüstbau Pro" description="Für professionelle Gerüstbauer" />
        </List.Section>
        <View style={styles.saveButton}>
          <Button mode="contained" onPress={speichern} icon="content-save">
            Einstellungen speichern
          </Button>
        </View>
      </ScrollView>
      <Snackbar
        visible={gespeichert}
        onDismiss={() => setGespeichert(false)}
        duration={2000}
      >
        Einstellungen gespeichert
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inputContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  input: { backgroundColor: 'white' },
  saveButton: { padding: 16 },
});
