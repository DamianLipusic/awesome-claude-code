import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  PanResponder,
  StyleSheet,
  Alert,
} from 'react-native';
import Svg, { Line, Circle, Text as SvgText, G } from 'react-native-svg';
import { Text, Button, TextInput, SegmentedButtons, Portal, Dialog } from 'react-native-paper';
import type { Annotation, MessungsTyp } from '../../models/Project';
import { generiereId, konvertiereZuMetern } from '../../utils/formatters';

const TYP_FARBEN: Record<MessungsTyp, string> = {
  breite: '#1565C0',
  hoehe: '#D32F2F',
  'oeffnung-breite': '#F57F17',
  'oeffnung-hoehe': '#E65100',
  'oeffnung-bruestung': '#6A1B9A',
  'feld-breite': '#00838F',
  wandabstand: '#2E7D32',
  'freistand-hoehe': '#558B2F',
};

const TYP_LABELS: Record<MessungsTyp, string> = {
  breite: 'Breite',
  hoehe: 'Höhe',
  'oeffnung-breite': 'Öffng. Breite',
  'oeffnung-hoehe': 'Öffng. Höhe',
  'oeffnung-bruestung': 'Brüstung',
  'feld-breite': 'Feldbreite',
  wandabstand: 'Wandabstand',
  'freistand-hoehe': 'Freistands-H.',
};

interface Props {
  fotoUri: string;
  fotoBreite: number;
  fotoHoehe: number;
  annotationen: Annotation[];
  fotoId: string;
  onAnnotationHinzugefuegt: (annotation: Annotation) => void;
  onAnnotationGeloescht: (annotationId: string) => void;
  onAnnotationGeaendert?: (annotation: Annotation) => void;
  aktuellerTyp: MessungsTyp;
}

type Punkt = { x: number; y: number };

export default function AnnotationCanvas({
  fotoUri,
  fotoBreite,
  fotoHoehe,
  annotationen,
  fotoId,
  onAnnotationHinzugefuegt,
  onAnnotationGeloescht,
  onAnnotationGeaendert,
  aktuellerTyp,
}: Props) {
  const [zeichneLinie, setZeichneLinie] = useState<{ start: Punkt; end: Punkt } | null>(null);
  const [neuDialogOffen, setNeuDialogOffen] = useState(false);
  const [editDialogOffen, setEditDialogOffen] = useState(false);
  const [eingabeWert, setEingabeWert] = useState('');
  const [eingabeEinheit, setEingabeEinheit] = useState<'mm' | 'cm' | 'm'>('m');
  const [ausgewaehlteAnnotation, setAusgewaehlteAnnotation] = useState<string | null>(null);

  const containerRef = useRef<View>(null);
  const containerLayout = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  function normalisiereKoordinaten(screenX: number, screenY: number): Punkt {
    const layout = containerLayout.current;
    if (!layout) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (screenX - layout.x) / layout.width)),
      y: Math.max(0, Math.min(1, (screenY - layout.y) / layout.height)),
    };
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const start = normalisiereKoordinaten(pageX, pageY);
        setZeichneLinie({ start, end: start });
        setAusgewaehlteAnnotation(null);
      },
      onPanResponderMove: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const end = normalisiereKoordinaten(pageX, pageY);
        setZeichneLinie(prev => prev ? { ...prev, end } : null);
      },
      onPanResponderRelease: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const end = normalisiereKoordinaten(pageX, pageY);
        setZeichneLinie(prev => {
          if (!prev) return null;
          const dx = end.x - prev.start.x;
          const dy = end.y - prev.start.y;
          const laenge = Math.sqrt(dx * dx + dy * dy);
          if (laenge < 0.02) return null;
          return { start: prev.start, end };
        });
        setNeuDialogOffen(true);
      },
    }),
  ).current;

  function bestaetigenAnnotation() {
    if (!zeichneLinie || !eingabeWert) return;
    const wertNum = parseFloat(eingabeWert.replace(',', '.'));
    if (isNaN(wertNum) || wertNum <= 0) {
      Alert.alert('Ungültige Eingabe', 'Bitte geben Sie einen gültigen Messwert ein.');
      return;
    }
    const annotation: Annotation = {
      id: generiereId(),
      fotoId,
      typ: aktuellerTyp,
      startPunkt: zeichneLinie.start,
      endPunkt: zeichneLinie.end,
      realweltWert: konvertiereZuMetern(wertNum, eingabeEinheit),
      einheit: eingabeEinheit,
      farbe: TYP_FARBEN[aktuellerTyp],
    };
    onAnnotationHinzugefuegt(annotation);
    setNeuDialogOffen(false);
    setZeichneLinie(null);
    setEingabeWert('');
  }

  function abbrechenNeuDialog() {
    setNeuDialogOffen(false);
    setZeichneLinie(null);
    setEingabeWert('');
  }

  function loescheAusgewaehlt() {
    if (ausgewaehlteAnnotation) {
      onAnnotationGeloescht(ausgewaehlteAnnotation);
      setAusgewaehlteAnnotation(null);
    }
  }

  function oeffneEditDialog() {
    const ann = annotationen.find(a => a.id === ausgewaehlteAnnotation);
    if (!ann) return;
    // Pre-fill with value in the annotation's stored unit
    const einheit = ann.einheit ?? 'm';
    let anzeigenwert: number;
    if (einheit === 'mm') anzeigenwert = ann.realweltWert * 1000;
    else if (einheit === 'cm') anzeigenwert = ann.realweltWert * 100;
    else anzeigenwert = ann.realweltWert;
    setEingabeWert(anzeigenwert.toFixed(einheit === 'm' ? 2 : 0));
    setEingabeEinheit(einheit);
    setEditDialogOffen(true);
  }

  function bestaetigenEdit() {
    const ann = annotationen.find(a => a.id === ausgewaehlteAnnotation);
    if (!ann || !eingabeWert) return;
    const wertNum = parseFloat(eingabeWert.replace(',', '.'));
    if (isNaN(wertNum) || wertNum <= 0) {
      Alert.alert('Ungültige Eingabe', 'Bitte einen gültigen Wert eingeben.');
      return;
    }
    const geaendert: Annotation = {
      ...ann,
      realweltWert: konvertiereZuMetern(wertNum, eingabeEinheit),
      einheit: eingabeEinheit,
    };
    onAnnotationGeaendert?.(geaendert);
    setEditDialogOffen(false);
    setAusgewaehlteAnnotation(null);
    setEingabeWert('');
  }

  const ausgewaehlteAnn = annotationen.find(a => a.id === ausgewaehlteAnnotation);

  return (
    <View style={styles.container}>
      <View
        ref={containerRef}
        style={styles.bildContainer}
        onLayout={() => {
          containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
            containerLayout.current = { x: pageX, y: pageY, width, height };
          });
        }}
        {...panResponder.panHandlers}
      >
        <Image source={{ uri: fotoUri }} style={styles.bild} resizeMode="contain" />

        <Svg style={StyleSheet.absoluteFillObject}>
          {annotationen.map(ann => {
            const layout = containerLayout.current;
            if (!layout) return null;
            const x1 = ann.startPunkt.x * layout.width;
            const y1 = ann.startPunkt.y * layout.height;
            const x2 = ann.endPunkt.x * layout.width;
            const y2 = ann.endPunkt.y * layout.height;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const isSelected = ausgewaehlteAnnotation === ann.id;

            return (
              <G key={ann.id} onPress={() => setAusgewaehlteAnnotation(ann.id)}>
                <Line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={ann.farbe}
                  strokeWidth={isSelected ? 4 : 2.5}
                  strokeLinecap="round"
                />
                <Circle cx={x1} cy={y1} r={5} fill={ann.farbe} />
                <Circle cx={x2} cy={y2} r={5} fill={ann.farbe} />
                <Circle cx={mx} cy={my} r={14} fill="rgba(0,0,0,0.7)" />
                <SvgText
                  x={mx} y={my + 4}
                  fill="white" fontSize={9} fontWeight="bold"
                  textAnchor="middle"
                >
                  {ann.realweltWert >= 1
                    ? `${ann.realweltWert.toFixed(2)}m`
                    : `${Math.round(ann.realweltWert * 100)}cm`
                  }
                </SvgText>
              </G>
            );
          })}

          {zeichneLinie && containerLayout.current && (() => {
            const layout = containerLayout.current!;
            const x1 = zeichneLinie.start.x * layout.width;
            const y1 = zeichneLinie.start.y * layout.height;
            const x2 = zeichneLinie.end.x * layout.width;
            const y2 = zeichneLinie.end.y * layout.height;
            return (
              <>
                <Line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={TYP_FARBEN[aktuellerTyp]}
                  strokeWidth={3}
                  strokeDasharray="8,4"
                  strokeLinecap="round"
                />
                <Circle cx={x1} cy={y1} r={6} fill={TYP_FARBEN[aktuellerTyp]} />
                <Circle cx={x2} cy={y2} r={6} fill={TYP_FARBEN[aktuellerTyp]} />
              </>
            );
          })()}
        </Svg>
      </View>

      {ausgewaehlteAnnotation && ausgewaehlteAnn && (
        <View style={styles.auswahlLeiste}>
          <Text variant="bodyMedium" style={styles.auswahlLabel}>
            {TYP_LABELS[ausgewaehlteAnn.typ]}: {ausgewaehlteAnn.realweltWert >= 1
              ? `${ausgewaehlteAnn.realweltWert.toFixed(2)} m`
              : `${Math.round(ausgewaehlteAnn.realweltWert * 100)} cm`}
          </Text>
          <View style={styles.auswahlAktionen}>
            {onAnnotationGeaendert && (
              <Button
                mode="outlined"
                onPress={oeffneEditDialog}
                icon="pencil"
                compact
                style={styles.auswahlButton}
              >
                Wert ändern
              </Button>
            )}
            <Button mode="contained" onPress={loescheAusgewaehlt} buttonColor="#D32F2F" icon="delete" compact>
              Löschen
            </Button>
          </View>
        </View>
      )}

      <Portal>
        {/* New annotation dialog */}
        <Dialog visible={neuDialogOffen} onDismiss={abbrechenNeuDialog}>
          <Dialog.Title>Maß eingeben – {TYP_LABELS[aktuellerTyp]}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Messwert"
              value={eingabeWert}
              onChangeText={setEingabeWert}
              mode="outlined"
              keyboardType="decimal-pad"
              autoFocus
              style={styles.eingabe}
              placeholder="z.B. 3,57"
            />
            <SegmentedButtons
              value={eingabeEinheit}
              onValueChange={v => setEingabeEinheit(v as 'mm' | 'cm' | 'm')}
              buttons={[
                { value: 'mm', label: 'mm' },
                { value: 'cm', label: 'cm' },
                { value: 'm', label: 'm' },
              ]}
              style={styles.einheitButtons}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={abbrechenNeuDialog}>Abbrechen</Button>
            <Button mode="contained" onPress={bestaetigenAnnotation}>Speichern</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Edit annotation value dialog */}
        <Dialog visible={editDialogOffen} onDismiss={() => setEditDialogOffen(false)}>
          <Dialog.Title>Wert bearbeiten</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Messwert"
              value={eingabeWert}
              onChangeText={setEingabeWert}
              mode="outlined"
              keyboardType="decimal-pad"
              autoFocus
              style={styles.eingabe}
            />
            <SegmentedButtons
              value={eingabeEinheit}
              onValueChange={v => setEingabeEinheit(v as 'mm' | 'cm' | 'm')}
              buttons={[
                { value: 'mm', label: 'mm' },
                { value: 'cm', label: 'cm' },
                { value: 'm', label: 'm' },
              ]}
              style={styles.einheitButtons}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditDialogOffen(false)}>Abbrechen</Button>
            <Button mode="contained" onPress={bestaetigenEdit}>Speichern</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bildContainer: { flex: 1, backgroundColor: '#000' },
  bild: { width: '100%', height: '100%' },
  auswahlLeiste: {
    padding: 12, backgroundColor: '#FFF3E0', borderTopWidth: 1, borderTopColor: '#F57F17',
  },
  auswahlLabel: { fontWeight: '500', marginBottom: 8 },
  auswahlAktionen: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  auswahlButton: { borderColor: '#1565C0' },
  eingabe: { marginBottom: 12 },
  einheitButtons: { marginTop: 4 },
});
