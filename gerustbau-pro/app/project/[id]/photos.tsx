import { useState } from 'react';
import { View, FlatList, Image, StyleSheet, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { Text, FAB, Button, Chip } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useProjektStore } from '../../../src/store/projectStore';
import { formatiereDatum } from '../../../src/utils/formatters';
import type { Foto } from '../../../src/models/Project';

const SPALTEN = 2;
const BREITE = (Dimensions.get('window').width - 48) / SPALTEN;

function FotoKarte({
  foto,
  onAnnotieren,
  onLoeschen,
}: {
  foto: Foto;
  onAnnotieren: () => void;
  onLoeschen: () => void;
}) {
  return (
    <TouchableOpacity style={styles.fotoKarte} onPress={onAnnotieren} activeOpacity={0.85}>
      <Image source={{ uri: foto.localUri }} style={styles.fotoVorschau} resizeMode="cover" />
      <View style={styles.fotoInfo}>
        <Chip compact icon="pencil-ruler" style={styles.annotationsChip}>
          {foto.annotationen.length} Maße
        </Chip>
      </View>
      {/* Large, easy-to-tap delete button */}
      <Button
        mode="contained"
        buttonColor="#D32F2F"
        icon="delete"
        onPress={onLoeschen}
        style={styles.loeschenButton}
        contentStyle={styles.loeschenInhalt}
        labelStyle={styles.loeschenLabel}
        compact
      >
        Löschen
      </Button>
    </TouchableOpacity>
  );
}

export default function FotoGalerie() {
  const { id: projektId, seitenId } = useLocalSearchParams<{ id: string; seitenId: string }>();

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const loescheFoto = useProjektStore(s => s.loescheFoto);

  if (!projekt) return null;
  const seite = projekt.seiten.find(s => s.id === seitenId);
  if (!seite) return null;

  function fotoLoeschen(foto: Foto) {
    Alert.alert(
      'Foto löschen',
      'Dieses Foto und alle eingezeichneten Maße werden dauerhaft gelöscht.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: () => loescheFoto(projektId, seitenId, foto.id),
        },
      ],
    );
  }

  function fotoAnnotieren(foto: Foto) {
    router.push({
      pathname: '/project/[id]/annotate/[photoId]',
      params: { id: projektId, photoId: foto.id, seitenId },
    });
  }

  return (
    <View style={styles.container}>
      {/* Side label */}
      <View style={styles.seitenHeader}>
        <Text variant="titleMedium" style={styles.seitenTitel}>{seite.anzeigename}</Text>
        <Text variant="bodySmall" style={styles.seitenHinweis}>
          Tippen Sie auf ein Foto um Maße einzuzeichnen · + für neues Foto
        </Text>
      </View>

      {seite.fotos.length === 0 ? (
        <View style={styles.leer}>
          <Text style={styles.leerIcon}>📷</Text>
          <Text variant="headlineSmall" style={styles.leerTitel}>Noch keine Fotos</Text>
          <Text variant="bodyLarge" style={styles.leerText}>
            Tippen Sie auf den blauen{'\n'}Kamera-Knopf unten rechts{'\n'}um ein Foto aufzunehmen.
          </Text>
        </View>
      ) : (
        <FlatList
          data={seite.fotos}
          keyExtractor={f => f.id}
          numColumns={SPALTEN}
          contentContainerStyle={styles.liste}
          renderItem={({ item }) => (
            <FotoKarte
              foto={item}
              onAnnotieren={() => fotoAnnotieren(item)}
              onLoeschen={() => fotoLoeschen(item)}
            />
          )}
        />
      )}

      <FAB
        icon="camera"
        label="Foto aufnehmen"
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: '/project/[id]/capture',
            params: { id: projektId, seitenId },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  seitenHeader: { backgroundColor: '#1565C0', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  seitenTitel: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  seitenHinweis: { color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  liste: { padding: 12, paddingBottom: 120 },
  fotoKarte: {
    width: BREITE,
    margin: 4,
    backgroundColor: 'white',
    borderRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  fotoVorschau: { width: '100%', height: BREITE, backgroundColor: '#E0E0E0' },
  fotoInfo: { padding: 8 },
  annotationsChip: { backgroundColor: '#E3F2FD', alignSelf: 'flex-start' },
  loeschenButton: { margin: 8, borderRadius: 6 },
  loeschenInhalt: { height: 36 },
  loeschenLabel: { fontSize: 13 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#1565C0' },
  leer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  leerIcon: { fontSize: 64, marginBottom: 16 },
  leerTitel: { color: '#555', marginBottom: 12, textAlign: 'center' },
  leerText: { color: '#777', textAlign: 'center', lineHeight: 26 },
});
