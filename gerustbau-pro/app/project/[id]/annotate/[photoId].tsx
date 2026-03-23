import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, SegmentedButtons, Chip, Button } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useProjektStore } from '../../../../src/store/projectStore';
import AnnotationCanvas from '../../../../src/components/annotation/AnnotationCanvas';
import type { Annotation, MessungsTyp } from '../../../../src/models/Project';
import { getSystem } from '../../../../src/data/systems';
import { konvertiereZuMetern } from '../../../../src/utils/formatters';

const TYP_LABELS: Record<MessungsTyp, string> = {
  breite: 'Breite',
  hoehe: 'Höhe',
  'oeffnung-breite': 'Öff. Breite',
  'oeffnung-hoehe': 'Öff. Höhe',
  'oeffnung-bruestung': 'Brüstung',
  'feld-breite': 'Feld',
  wandabstand: 'Abstand',
  'freistand-hoehe': 'Freistand',
};

export default function AnnotateScreen() {
  const { id: projektId, photoId, seitenId } = useLocalSearchParams<{ id: string; photoId: string; seitenId: string }>();
  const [aktuellerTyp, setAktuellerTyp] = useState<MessungsTyp>('breite');

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const fuegeAnnotationHinzu = useProjektStore(s => s.fuegeAnnotationHinzu);
  const loescheAnnotation = useProjektStore(s => s.loescheAnnotation);
  const fuegeMessungHinzu = useProjektStore(s => s.fuegeMessungHinzu);

  if (!projekt) return null;

  const seite = projekt.seiten.find(s => s.id === seitenId);
  const foto = seite?.fotos.find(f => f.id === photoId);

  if (!seite || !foto) return null;

  const system = getSystem(projekt.systemId);
  const anforderungen = system.messungsAnforderungen;

  function onAnnotationHinzugefuegt(annotation: Annotation) {
    fuegeAnnotationHinzu(projektId, seitenId, photoId, annotation);
    // Also create a measurement from annotation
    fuegeMessungHinzu(projektId, seitenId, {
      typ: annotation.typ,
      wert: annotation.realweltWert,
      quelle: 'annotiert',
      genauigkeit: 'gemessen',
      annotationId: annotation.id,
    });
  }

  function onAnnotationGeloescht(annotationId: string) {
    loescheAnnotation(projektId, seitenId, photoId, annotationId);
  }

  const erledigteTypen = new Set(seite.messungen.map(m => m.typ));

  return (
    <View style={styles.container}>
      {/* Type selector toolbar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbar}>
        {anforderungen.map(anf => (
          <Chip
            key={anf.typ}
            selected={aktuellerTyp === anf.typ}
            onPress={() => setAktuellerTyp(anf.typ)}
            style={[styles.chip, aktuellerTyp === anf.typ && styles.chipAktiv]}
            icon={erledigteTypen.has(anf.typ) ? 'check-circle' : 'circle-outline'}
            textStyle={{ fontSize: 12 }}
          >
            {TYP_LABELS[anf.typ]}
          </Chip>
        ))}
      </ScrollView>

      <View style={styles.canvasContainer}>
        <AnnotationCanvas
          fotoUri={foto.localUri}
          fotoBreite={foto.breite}
          fotoHoehe={foto.hoehe}
          annotationen={foto.annotationen}
          fotoId={photoId}
          onAnnotationHinzugefuegt={onAnnotationHinzugefuegt}
          onAnnotationGeloescht={onAnnotationGeloescht}
          aktuellerTyp={aktuellerTyp}
        />
      </View>

      {/* Guide panel */}
      <View style={styles.guide}>
        <Text variant="labelMedium" style={styles.guideTyp}>{TYP_LABELS[aktuellerTyp]}</Text>
        <Text variant="bodySmall" style={styles.guideBeschreibung}>
          {anforderungen.find(a => a.typ === aktuellerTyp)?.beschreibung ?? 'Linie auf dem Foto einzeichnen'}
        </Text>
      </View>

      <Button
        mode="contained"
        style={styles.fertigButton}
        onPress={() => router.back()}
        icon="check"
      >
        Fertig
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  toolbar: { maxHeight: 52, backgroundColor: '#1565C0', paddingVertical: 6, paddingHorizontal: 8 },
  chip: { marginRight: 6, backgroundColor: 'rgba(255,255,255,0.2)' },
  chipAktiv: { backgroundColor: 'rgba(255,255,255,0.9)' },
  canvasContainer: { flex: 1 },
  guide: { backgroundColor: 'rgba(0,0,0,0.85)', padding: 10 },
  guideTyp: { color: '#90CAF9', marginBottom: 2 },
  guideBeschreibung: { color: '#BDBDBD' },
  fertigButton: { margin: 12, backgroundColor: '#2E7D32' },
});
