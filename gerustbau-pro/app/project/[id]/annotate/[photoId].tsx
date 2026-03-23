import { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Chip, Button, Portal, Dialog } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { useProjektStore } from '../../../../src/store/projectStore';
import AnnotationCanvas from '../../../../src/components/annotation/AnnotationCanvas';
import type { Annotation, MessungsTyp } from '../../../../src/models/Project';
import { getSystem } from '../../../../src/data/systems';

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

const HILFE_TEXTE: Record<MessungsTyp, string> = {
  breite: 'Zeichnen Sie eine waagerechte Linie über die gesamte Breite der Gebäudeseite.',
  hoehe: 'Zeichnen Sie eine senkrechte Linie von Boden bis Dachtraufe.',
  'oeffnung-breite': 'Zeichnen Sie eine waagerechte Linie über die Breite eines Fensters oder einer Tür.',
  'oeffnung-hoehe': 'Zeichnen Sie eine senkrechte Linie über die Höhe der Öffnung.',
  'oeffnung-bruestung': 'Zeichnen Sie vom Boden bis zur Unterkante des Fensters.',
  'feld-breite': 'Zeichnen Sie die Breite eines einzelnen Feldes (Gerüstfeld).',
  wandabstand: 'Zeichnen Sie den Abstand von der Wand zur Gerüstaussenkante.',
  'freistand-hoehe': 'Zeichnen Sie die Freistands-Höhe bis zum ersten Boden.',
};

export default function AnnotateScreen() {
  const { id: projektId, photoId, seitenId } = useLocalSearchParams<{ id: string; photoId: string; seitenId: string }>();
  const [aktuellerTyp, setAktuellerTyp] = useState<MessungsTyp>('breite');
  const [hilfeOffen, setHilfeOffen] = useState(false);

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const fuegeAnnotationHinzu = useProjektStore(s => s.fuegeAnnotationHinzu);
  const loescheAnnotation = useProjektStore(s => s.loescheAnnotation);
  const aktualisiereAnnotation = useProjektStore(s => s.aktualisiereAnnotation);
  const aktualisiereMessung = useProjektStore(s => s.aktualisiereMessung);
  const fuegeMessungHinzu = useProjektStore(s => s.fuegeMessungHinzu);

  if (!projekt) return null;

  const seite = projekt.seiten.find(s => s.id === seitenId);
  const foto = seite?.fotos.find(f => f.id === photoId);

  if (!seite || !foto) return null;

  const system = getSystem(projekt.systemId);
  const anforderungen = system.messungsAnforderungen;

  function onAnnotationHinzugefuegt(annotation: Annotation) {
    fuegeAnnotationHinzu(projektId, seitenId, photoId, annotation);
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

  function onAnnotationGeaendert(annotation: Annotation) {
    aktualisiereAnnotation(projektId, seitenId, photoId, annotation);
    const messung = seite.messungen.find(m => m.annotationId === annotation.id);
    if (messung) {
      aktualisiereMessung(projektId, seitenId, { ...messung, wert: annotation.realweltWert });
    }
  }

  const erledigteTypen = new Set(seite.messungen.map(m => m.typ));
  const aktuelleAnforderung = anforderungen.find(a => a.typ === aktuellerTyp);

  return (
    <View style={styles.container}>
      {/* Type selector toolbar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.toolbar}
        contentContainerStyle={styles.toolbarInhalt}
      >
        {anforderungen.map(anf => (
          <Chip
            key={anf.typ}
            selected={aktuellerTyp === anf.typ}
            onPress={() => setAktuellerTyp(anf.typ)}
            style={[styles.chip, aktuellerTyp === anf.typ && styles.chipAktiv]}
            icon={erledigteTypen.has(anf.typ) ? 'check-circle' : 'circle-outline'}
            textStyle={[styles.chipText, aktuellerTyp === anf.typ && styles.chipTextAktiv]}
          >
            {TYP_LABELS[anf.typ]}
          </Chip>
        ))}
      </ScrollView>

      {/* Annotation canvas */}
      <View style={styles.canvasContainer}>
        <AnnotationCanvas
          fotoUri={foto.localUri}
          fotoBreite={foto.breite}
          fotoHoehe={foto.hoehe}
          annotationen={foto.annotationen}
          fotoId={photoId}
          onAnnotationHinzugefuegt={onAnnotationHinzugefuegt}
          onAnnotationGeloescht={onAnnotationGeloescht}
          onAnnotationGeaendert={onAnnotationGeaendert}
          aktuellerTyp={aktuellerTyp}
        />
      </View>

      {/* Guide panel + help button */}
      <View style={styles.guide}>
        <View style={styles.guideRow}>
          <View style={styles.guideText}>
            <Text variant="labelLarge" style={styles.guideTyp}>
              Jetzt einzeichnen: {TYP_LABELS[aktuellerTyp]}
            </Text>
            <Text variant="bodySmall" style={styles.guideBeschreibung}>
              {aktuelleAnforderung?.beschreibung ?? 'Linie auf dem Foto einzeichnen'}
            </Text>
          </View>
          <Button
            icon="help-circle"
            mode="text"
            onPress={() => setHilfeOffen(true)}
            textColor="rgba(255,255,255,0.8)"
            compact
          >
            Hilfe
          </Button>
        </View>
      </View>

      <Button
        mode="contained"
        style={styles.fertigButton}
        onPress={() => router.back()}
        icon="check"
        contentStyle={styles.fertigButtonInhalt}
        labelStyle={{ fontSize: 16 }}
      >
        Fertig – zurück zur Übersicht
      </Button>

      {/* Help dialog */}
      <Portal>
        <Dialog visible={hilfeOffen} onDismiss={() => setHilfeOffen(false)}>
          <Dialog.Title>✏️ So zeichnen Sie Maße ein</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              1️⃣  Wählen Sie oben das Maß, das Sie einzeichnen möchten (z.B. „Breite").
            </Text>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              2️⃣  <Text style={{ fontWeight: 'bold' }}>{TYP_LABELS[aktuellerTyp]}:</Text>{' '}
              {HILFE_TEXTE[aktuellerTyp]}
            </Text>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              3️⃣  Tippen Sie auf den Start-Punkt und ziehen Sie zur Endposition.
            </Text>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              4️⃣  Geben Sie den tatsächlichen Wert ein (z.B. 12,5 Meter).
            </Text>
            <Text variant="bodyLarge" style={styles.hilfeSchritt}>
              5️⃣  Tippen Sie auf eine eingezeichnete Linie um sie zu löschen oder zu bearbeiten.
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
  toolbar: { maxHeight: 56, backgroundColor: '#1565C0' },
  toolbarInhalt: { paddingVertical: 8, paddingHorizontal: 8, gap: 6, alignItems: 'center' },
  chip: { backgroundColor: 'rgba(255,255,255,0.2)' },
  chipAktiv: { backgroundColor: 'rgba(255,255,255,0.95)' },
  chipText: { fontSize: 13, color: 'rgba(255,255,255,0.9)' },
  chipTextAktiv: { color: '#1565C0', fontWeight: 'bold' },
  canvasContainer: { flex: 1 },
  guide: { backgroundColor: 'rgba(0,0,0,0.88)', padding: 12 },
  guideRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  guideText: { flex: 1 },
  guideTyp: { color: '#90CAF9', marginBottom: 2, fontSize: 14 },
  guideBeschreibung: { color: '#BDBDBD', lineHeight: 18 },
  fertigButton: { margin: 12, backgroundColor: '#2E7D32', borderRadius: 10 },
  fertigButtonInhalt: { height: 52 },
  hilfeSchritt: { marginBottom: 14, lineHeight: 24 },
});
