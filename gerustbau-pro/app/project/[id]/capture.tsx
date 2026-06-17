import { useState, useRef } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Text, ActivityIndicator, Chip, Portal, Dialog } from 'react-native-paper';
import { router, useLocalSearchParams } from 'expo-router';
// expo-file-system v55 restructured the API; the legacy sub-path still provides
// documentDirectory / makeDirectoryAsync / moveAsync used below.
import * as FileSystem from 'expo-file-system/legacy';
import { useProjektStore } from '../../../src/store/projectStore';

export default function CaptureScreen() {
  const { id: projektId, seitenId } = useLocalSearchParams<{ id: string; seitenId: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [aufnahme, setAufnahme] = useState(false);
  const [hilfeOffen, setHilfeOffen] = useState(false);
  const kameraRef = useRef<CameraView>(null);

  const fuegeFotoHinzu = useProjektStore(s => s.fuegeFotoHinzu);
  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const seite = projekt?.seiten.find(s => s.id === seitenId);

  if (!permission) return <ActivityIndicator style={styles.loading} />;

  if (!permission.granted) {
    return (
      <View style={styles.erlaubnisContainer}>
        <Text style={styles.erlaubnisEmoji}>📷</Text>
        <Text variant="headlineSmall" style={styles.erlaubnisText}>
          Kamerazugriff benötigt
        </Text>
        <Text variant="bodyLarge" style={styles.erlaubnisSubtext}>
          Die App benötigt Zugriff auf die Kamera, um Gebäudeseiten zu fotografieren.
        </Text>
        <Button
          mode="contained"
          onPress={requestPermission}
          style={styles.erlaubnisButton}
          contentStyle={styles.erlaubnisButtonInhalt}
          labelStyle={{ fontSize: 16 }}
        >
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
        pathname: '/project/[id]/annotate/[photoId]',
        params: { id: projektId, photoId: fotoId, seitenId },
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
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top info */}
          <View style={styles.kopfInfo}>
            {seite && (
              <Chip icon="home" style={styles.seitenChip} textStyle={{ color: 'white', fontSize: 14 }}>
                {seite.anzeigename}
              </Chip>
            )}
            <Button
              icon="help-circle"
              mode="outlined"
              compact
              onPress={() => setHilfeOffen(true)}
              style={styles.hilfeButton}
              textColor="white"
            >
              Hilfe
            </Button>
          </View>

          {/* Frame corners */}
          <View style={styles.rahmenOverlay}>
            <View style={[styles.ecke, styles.eckeObenLinks]} />
            <View style={[styles.ecke, styles.eckeObenRechts]} />
            <View style={[styles.ecke, styles.eckeUntenLinks]} />
            <View style={[styles.ecke, styles.eckeUntenRechts]} />
          </View>

          {/* Instruction */}
          <View style={styles.hinweis}>
            <Text style={styles.hinweisText}>
              Die gesamte Gebäudeseite muss sichtbar sein.{'\n'}
              Kamera waagerecht halten.
            </Text>
          </View>
        </View>
      </CameraView>

      {/* Controls */}
      <View style={styles.steuerung}>
        <Button
          mode="outlined"
          onPress={() => router.back()}
          style={styles.abbrechenButton}
          contentStyle={styles.abbrechenInhalt}
          textColor="white"
          labelStyle={{ fontSize: 15 }}
        >
          Abbrechen
        </Button>

        {/* Big shutter button */}
        <Button
          mode="contained"
          onPress={fotoAufnehmen}
          loading={aufnahme}
          disabled={aufnahme}
          style={styles.ausloser}
          icon="camera"
          contentStyle={styles.ausloserInhalt}
          labelStyle={styles.ausloserLabel}
        >
          {aufnahme ? 'Aufnahme…' : 'Foto aufnehmen'}
        </Button>
      </View>

      {/* Help dialog */}
      <Portal>
        <Dialog visible={hilfeOffen} onDismiss={() => setHilfeOffen(false)}>
          <Dialog.Title>📷 So fotografieren Sie richtig</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              1️⃣  Stellen Sie sich so hin, dass die gesamte Hauswand sichtbar ist.
            </Text>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              2️⃣  Halten Sie die Kamera gerade – nicht schräg.
            </Text>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              3️⃣  Warten Sie bis das Bild scharf ist, dann tippen Sie „Foto aufnehmen".
            </Text>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              4️⃣  Danach können Sie die Maße direkt ins Foto einzeichnen.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button mode="contained" onPress={() => setHilfeOffen(false)} labelStyle={{ fontSize: 15 }}>
              Verstanden
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { flex: 1, alignSelf: 'center' },
  kamera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'space-between' },
  kopfInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
  },
  seitenChip: { backgroundColor: 'rgba(21,101,192,0.85)' },
  hilfeButton: { borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.3)' },
  rahmenOverlay: { flex: 1, margin: 32, position: 'relative' },
  ecke: { position: 'absolute', width: 36, height: 36, borderColor: 'rgba(255,255,255,0.85)', borderWidth: 3.5 },
  eckeObenLinks: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  eckeObenRechts: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  eckeUntenLinks: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  eckeUntenRechts: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  hinweis: { padding: 16, backgroundColor: 'rgba(0,0,0,0.65)' },
  hinweisText: { color: 'white', textAlign: 'center', lineHeight: 22, fontSize: 15 },

  steuerung: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 28,
    backgroundColor: '#111',
    alignItems: 'center',
    gap: 12,
  },
  abbrechenButton: { flex: 1, borderColor: 'rgba(255,255,255,0.4)' },
  abbrechenInhalt: { height: 56 },
  ausloser: { flex: 2, backgroundColor: '#1565C0', borderRadius: 12 },
  ausloserInhalt: { height: 64 },
  ausloserLabel: { fontSize: 17, fontWeight: 'bold' },

  erlaubnisContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  erlaubnisEmoji: { fontSize: 72, marginBottom: 16 },
  erlaubnisText: { fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  erlaubnisSubtext: { color: '#666', textAlign: 'center', marginBottom: 32, lineHeight: 24 },
  erlaubnisButton: {},
  erlaubnisButtonInhalt: { height: 52 },

  hilfeSchritt: { marginBottom: 12, lineHeight: 24 },
});
