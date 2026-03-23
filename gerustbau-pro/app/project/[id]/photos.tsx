import { useState } from 'react';
import { View, FlatList, Image, StyleSheet, Dimensions, TouchableOpacity, Alert } from 'react-native';
import { Text, FAB, IconButton, Chip } from 'react-native-paper';
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
    <TouchableOpacity style={styles.fotoKarte} onPress={onAnnotieren}>
      <Image source={{ uri: foto.localUri }} style={styles.fotoVorschau} resizeMode="cover" />
      <View style={styles.fotoInfo}>
        <Text variant="bodySmall" style={styles.fotoDatum} numberOfLines={1}>
          {formatiereDatum(foto.aufgenommenAm)}
        </Text>
        <Chip compact icon="pencil-ruler" style={styles.annotationsChip}>
          {foto.annotationen.length} Maße
        </Chip>
      </View>
      <IconButton
        icon="delete"
        size={18}
        iconColor="#D32F2F"
        style={styles.loeschenButton}
        onPress={onLoeschen}
      />
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
      'Dieses Foto und alle eingezeichneten Maße werden gelöscht.',
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
      pathname: `/project/${projektId}/annotate/${foto.id}`,
      params: { seitenId },
    });
  }

  return (
    <View style={styles.container}>
      {seite.fotos.length === 0 ? (
        <View style={styles.leer}>
          <Text variant="headlineSmall" style={styles.leerTitel}>Keine Fotos</Text>
          <Text variant="bodyMedium" style={styles.leerText}>
            Tippen Sie auf + um ein Foto von {seite.anzeigename} aufzunehmen.
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
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: `/project/${projektId}/capture`,
            params: { seitenId },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  liste: { padding: 16, paddingBottom: 100 },
  fotoKarte: {
    width: BREITE,
    margin: 4,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  fotoVorschau: { width: '100%', height: BREITE, backgroundColor: '#E0E0E0' },
  fotoInfo: { padding: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fotoDatum: { color: '#666', flex: 1, marginRight: 4 },
  annotationsChip: { backgroundColor: '#E3F2FD' },
  loeschenButton: { position: 'absolute', top: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.85)', margin: 4 },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: '#1565C0' },
  leer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  leerTitel: { color: '#666', marginBottom: 8 },
  leerText: { color: '#999', textAlign: 'center' },
});
