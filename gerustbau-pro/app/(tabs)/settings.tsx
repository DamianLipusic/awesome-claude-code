import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, List, Divider, Switch, TextInput, Button } from 'react-native-paper';
import { useState } from 'react';

export default function Einstellungen() {
  const [firmenname, setFirmenname] = useState('');
  const [standardEinheit, setStandardEinheit] = useState<'m' | 'cm'>('m');

  return (
    <ScrollView style={styles.container}>
      <List.Section title="Firmendaten">
        <View style={styles.inputContainer}>
          <TextInput
            label="Firmenname (für PDF-Kopfzeile)"
            value={firmenname}
            onChangeText={setFirmenname}
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
              onValueChange={() => setStandardEinheit('m')}
            />
          )}
        />
        <List.Item
          title="Zentimeter (cm)"
          right={() => (
            <Switch
              value={standardEinheit === 'cm'}
              onValueChange={() => setStandardEinheit('cm')}
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
        <Button mode="contained" onPress={() => {}}>Einstellungen speichern</Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inputContainer: { paddingHorizontal: 16, paddingBottom: 8 },
  input: { backgroundColor: 'white' },
  saveButton: { padding: 16 },
});
