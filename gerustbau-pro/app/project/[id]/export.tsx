import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
import { Text, Button, Switch, Card, Divider, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useProjektStore } from '../../../src/store/projectStore';
import { berechneMaterialien } from '../../../src/algorithms/materialCalculator';
import { generierePdfHtml } from '../../../src/pdf/PdfGenerator';
import { formatiereDatum } from '../../../src/utils/formatters';

export default function ExportScreen() {
  const { id: projektId } = useLocalSearchParams<{ id: string }>();
  const [zeigePlanSeiten, setZeigePlanSeiten] = useState(true);
  const [zeigeAnnotierteFoots, setZeigeAnnotierteFoots] = useState(true);
  const [zeigeMaterialliste, setZeigeMaterialliste] = useState(true);
  const [exportLaeuft, setExportLaeuft] = useState(false);

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const aktiverPlan = useProjektStore(s => s.aktiverPlan);

  if (!projekt) return null;

  async function exportieren() {
    if (!projekt) return;
    setExportLaeuft(true);

    try {
      // Calculate if no plan yet
      let plan = aktiverPlan;
      let materialien = useProjektStore.getState().aktiveMaterialien;

      if (!plan) {
        const ergebnis = berechneMaterialien({
          seiten: projekt.seiten,
          systemId: projekt.systemId,
          arbeitshoehe: projekt.arbeitshoehe,
        });
        plan = { ...ergebnis.plan, projektId: projekt.id };
        materialien = ergebnis.materialien;
      }

      const html = generierePdfHtml({
        projekt,
        plan,
        materialien,
        zeigePlanSeiten,
        zeigeAnnotierteFoots,
        zeigeMaterialliste,
      });

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Gerüstplanung ${projekt.name}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Gespeichert', `PDF gespeichert unter:\n${uri}`);
      }
    } catch (fehler) {
      Alert.alert('Fehler', 'PDF konnte nicht erstellt werden. Bitte versuchen Sie es erneut.');
      console.error(fehler);
    } finally {
      setExportLaeuft(false);
    }
  }

  const anzahlSeiten = 1
    + (zeigePlanSeiten ? projekt.seiten.length : 0)
    + (zeigeAnnotierteFoots ? Math.ceil(projekt.seiten.reduce((s, seite) => s + seite.fotos.length, 0) / 2) : 0)
    + (zeigeMaterialliste ? 1 : 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inhalt}>
      <Card style={styles.vorschauKarte}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.projektName}>{projekt.name}</Text>
          <Text variant="bodySmall" style={styles.datum}>Erstellt: {formatiereDatum(new Date())}</Text>
          <Text variant="bodySmall" style={styles.info}>Ca. {anzahlSeiten} Seiten · A4 · PDF</Text>
        </Card.Content>
      </Card>

      <Text variant="titleMedium" style={styles.abschnittTitel}>Inhalt auswählen</Text>
      <Card style={styles.optionenKarte}>
        <Card.Content>
          <View style={styles.option}>
            <View style={styles.optionText}>
              <Text variant="bodyMedium">Deckblatt</Text>
              <Text variant="bodySmall" style={styles.optionBeschreibung}>Projektinfos, System, Lastklasse</Text>
            </View>
            <Switch value={true} disabled />
          </View>
          <Divider style={styles.divider} />

          <View style={styles.option}>
            <View style={styles.optionText}>
              <Text variant="bodyMedium">Gerüstplan-Zeichnungen</Text>
              <Text variant="bodySmall" style={styles.optionBeschreibung}>SVG-Ansicht jeder Gebäudeseite (1:50)</Text>
            </View>
            <Switch value={zeigePlanSeiten} onValueChange={setZeigePlanSeiten} />
          </View>
          <Divider style={styles.divider} />

          <View style={styles.option}>
            <View style={styles.optionText}>
              <Text variant="bodyMedium">Annotierte Fotos</Text>
              <Text variant="bodySmall" style={styles.optionBeschreibung}>Fotos mit eingezeichneten Maßen</Text>
            </View>
            <Switch value={zeigeAnnotierteFoots} onValueChange={setZeigeAnnotierteFoots} />
          </View>
          <Divider style={styles.divider} />

          <View style={styles.option}>
            <View style={styles.optionText}>
              <Text variant="bodyMedium">Materialliste</Text>
              <Text variant="bodySmall" style={styles.optionBeschreibung}>Vollständige Stückliste mit Gewichten</Text>
            </View>
            <Switch value={zeigeMaterialliste} onValueChange={setZeigeMaterialliste} />
          </View>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={exportieren}
        disabled={exportLaeuft}
        style={styles.exportButton}
        icon={exportLaeuft ? undefined : 'file-pdf-box'}
        contentStyle={styles.exportButtonInhalt}
      >
        {exportLaeuft ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          'PDF erstellen und teilen'
        )}
      </Button>

      <Text variant="bodySmall" style={styles.hinweis}>
        Das PDF wird lokal auf Ihrem Gerät erstellt und kann per AirDrop, E-Mail oder
        WhatsApp geteilt werden. Eine Internetverbindung ist nicht erforderlich.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  inhalt: { padding: 16, paddingBottom: 40 },
  vorschauKarte: { marginBottom: 20, elevation: 2 },
  projektName: { fontWeight: 'bold', marginBottom: 4 },
  datum: { color: '#666', marginBottom: 2 },
  info: { color: '#888' },
  abschnittTitel: { fontWeight: 'bold', marginBottom: 8, color: '#1565C0' },
  optionenKarte: { elevation: 1, marginBottom: 24 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  optionText: { flex: 1 },
  optionBeschreibung: { color: '#666', marginTop: 2 },
  divider: { marginVertical: 4 },
  exportButton: { backgroundColor: '#1565C0', marginBottom: 16 },
  exportButtonInhalt: { height: 56 },
  hinweis: { color: '#888', textAlign: 'center', paddingHorizontal: 8 },
});
