import { useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Text, ActivityIndicator, Chip } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
// expo-file-system v55 restructured the API; the legacy sub-path still provides
// documentDirectory / makeDirectoryAsync / moveAsync used below.
import * as FileSystem from 'expo-file-system/legacy';
import { useProjektStore } from '../../../src/store/projectStore';

export default function CaptureScreen() {
  const { id: projektId, seitenId } = useLocalSearchParams<{ id: string; seitenId: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [aufnahme, setAufnahme] = useState(false);
  const kameraRef = useRef<CameraView>(null);

  const fuegeFotoHinzu = useProjektStore(s => s.fuegeFotoHinzu);
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const seite = projekt?.seiten.find(s => s.id === seitenId);

  if (!permission) return <ActivityIndicator style={styles.loading} />;

  if (!permission.granted) {
    return (
      <View style={styles.erlaubnisContainer}>
        <Text variant="headlineSmall" style={styles.erlaubnisText}>
          Kamerazugriff benötigt
        </Text>
        <Text variant="bodyMedium" style={styles.erlaubnisSubtext}>
          Die App benötigt Kamerazugriff, um Gebäudeseiten zu fotografieren.
        </Text>
        <Button mode="contained" onPress={requestPermission} style={styles.erlaubnisButton}>
          Kamerazugriff erlauben
        </Button>
      </View>
    );
  }

  async function fotoAufnehmen() {
    if (!kameraRef.current || aufnahme) return;
    setAufnahme(true);

    try {
      const foto = await kameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: false,
      });

      if (!foto) throw new Error('Kein Foto erhalten');

      // Save to app's document directory
      const zielVerzeichnis = FileSystem.documentDirectory + 'fotos/';
      await FileSystem.makeDirectoryAsync(zielVerzeichnis, { intermediates: true });
      const dateiname = `${projektId}_${seitenId}_${Date.now()}.jpg`;
      const zielPfad = zielVerzeichnis + dateiname;
      await FileSystem.moveAsync({ from: foto.uri, to: zielPfad });

      const fotoId = fuegeFotoHinzu(projektId, seitenId, {
        localUri: zielPfad,
        breite: foto.width ?? 1920,
        hoehe: foto.height ?? 1080,
        aufgenommenAm: new Date().toISOString(),
      });

      router.push({
        pathname: `/project/${projektId}/annotate/${fotoId}`,
        params: { seitenId },
      });
    } catch (fehler) {
      Alert.alert('Fehler', 'Foto konnte nicht aufgenommen werden.');
      console.error(fehler);
    } finally {
      setAufnahme(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView ref={kameraRef} style={styles.kamera} facing="back">
        {/* Guide overlay */}
        <View style={styles.overlay}>
          <View style={styles.kopfInfo}>
            {seite && (
              <Chip icon="home" style={styles.seitenChip} textStyle={{ color: 'white' }}>
                {seite.anzeigename}
              </Chip>
            )}
          </View>

          <View style={styles.rahmenOverlay}>
            <View style={[styles.ecke, styles.eckeObenLinks]} />
            <View style={[styles.ecke, styles.eckeObenRechts]} />
            <View style={[styles.ecke, styles.eckeUntenLinks]} />
            <View style={[styles.ecke, styles.eckeUntenRechts]} />
          </View>

          <View style={styles.hinweis}>
            <Text style={styles.hinweisText}>
              Gesamte Gebäudeseite vollständig erfassen.{'\n'}
              Kamera waagerecht halten.
            </Text>
          </View>
        </View>
      </CameraView>

      <View style={styles.steuerung}>
        <Button mode="outlined" onPress={() => router.back()} style={styles.abbrechenButton}>
          Abbrechen
        </Button>
        <View style={styles.ausloserContainer}>
          <Button
            mode="contained"
            onPress={fotoAufnehmen}
            loading={aufnahme}
            disabled={aufnahme}
            style={styles.ausloser}
            icon="camera"
            contentStyle={styles.ausloserInhalt}
          >
            Foto aufnehmen
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, alignSelf: 'center' },
  kamera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  kopfInfo: { padding: 16, paddingTop: 48 },
  seitenChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(21,101,192,0.85)' },
  rahmenOverlay: { flex: 1, margin: 32, position: 'relative' },
  ecke: { position: 'absolute', width: 30, height: 30, borderColor: 'rgba(255,255,255,0.8)', borderWidth: 3 },
  eckeObenLinks: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  eckeObenRechts: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  eckeUntenLinks: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  eckeUntenRechts: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hinweis: { padding: 16, backgroundColor: 'rgba(0,0,0,0.6)' },
  hinweisText: { color: 'white', textAlign: 'center', lineHeight: 20 },
  steuerung: { flexDirection: 'row', padding: 16, backgroundColor: '#1A1A1A', alignItems: 'center', gap: 12 },
  abbrechenButton: { flex: 1 },
  ausloserContainer: { flex: 2 },
  ausloser: { backgroundColor: '#1565C0' },
  ausloserInhalt: { height: 52 },
  erlaubnisContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  erlaubnisText: { fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  erlaubnisSubtext: { color: '#666', textAlign: 'center', marginBottom: 24 },
  erlaubnisButton: {},
});
