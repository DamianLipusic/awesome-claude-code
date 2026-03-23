import { useState } from 'react';
import { View, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { Text, SegmentedButtons, Chip, ActivityIndicator } from 'react-native-paper';
import { SvgXml } from 'react-native-svg';
import { useLocalSearchParams } from 'expo-router';
import { useProjektStore } from '../../../src/store/projectStore';
import { berechneMaterialien } from '../../../src/algorithms/materialCalculator';
import { generiereSeitenElevationSVG } from '../../../src/algorithms/planGenerator';
import type { BausteinSeite, SeitenPlan } from '../../../src/models/Project';

export default function PlanView() {
  const { id: projektId } = useLocalSearchParams<{ id: string }>();
  const [aktiveSeite, setAktiveSeite] = useState(0);
  const [showRahmen, setShowRahmen] = useState(true);
  const [showBelag, setShowBelag] = useState(true);
  const [showGelaender, setShowGelaender] = useState(true);
  const [showAnker, setShowAnker] = useState(true);
  const [showMasse, setShowMasse] = useState(true);

  const projekt = useProjektStore(s => s.projekte.find(p => p.id === projektId));
  const aktiverPlan = useProjektStore(s => s.aktiverPlan);
  const setzePlan = useProjektStore(s => s.setzePlan);

  if (!projekt) return null;

  // Compute plan if not yet done
  let plan = aktiverPlan;
  if (!plan) {
    const ergebnis = berechneMaterialien({
      seiten: projekt.seiten,
      systemId: projekt.systemId,
      arbeitshoehe: projekt.arbeitshoehe,
    });
    plan = { ...ergebnis.plan, projektId: projekt.id };
    setzePlan(plan, ergebnis.materialien);
  }

  if (plan.seiten.length === 0) {
    return (
      <View style={styles.leer}>
        <Text variant="bodyLarge">Keine vollständigen Seiten vorhanden.</Text>
        <Text variant="bodyMedium" style={styles.leerSub}>
          Bitte erfassen Sie zuerst Breite und Höhe jeder Gebäudeseite.
        </Text>
      </View>
    );
  }

  const seite = projekt.seiten.find(s => s.id === plan!.seiten[aktiveSeite]?.seitenId);
  const seitenPlan = plan.seiten[aktiveSeite];

  const screenWidth = Dimensions.get('window').width;

  let svgXml: string | null = null;
  if (seite && seitenPlan) {
    svgXml = generiereSeitenElevationSVG(seitenPlan, seite, plan, {
      showRahmen,
      showBelag,
      showGelaender,
      showAnker,
      showMasse,
    });
  }

  return (
    <View style={styles.container}>
      {/* Side selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seitenLeiste}>
        {plan.seiten.map((sp, idx) => {
          const s = projekt.seiten.find(x => x.id === sp.seitenId);
          return (
            <Chip
              key={sp.seitenId}
              selected={aktiveSeite === idx}
              onPress={() => setAktiveSeite(idx)}
              style={[styles.seitenChip, aktiveSeite === idx && styles.seitenChipAktiv]}
            >
              {s?.anzeigename ?? `Seite ${idx + 1}`}
            </Chip>
          );
        })}
      </ScrollView>

      {/* Layer toggles */}
      <View style={styles.ebenenLeiste}>
        {[
          { label: 'Rahmen', wert: showRahmen, setWert: setShowRahmen },
          { label: 'Belag', wert: showBelag, setWert: setShowBelag },
          { label: 'Geländer', wert: showGelaender, setWert: setShowGelaender },
          { label: 'Anker', wert: showAnker, setWert: setShowAnker },
          { label: 'Maße', wert: showMasse, setWert: setShowMasse },
        ].map(({ label, wert, setWert }) => (
          <Chip
            key={label}
            selected={wert}
            onPress={() => setWert(!wert)}
            compact
            style={styles.ebeneChip}
          >
            {label}
          </Chip>
        ))}
      </View>

      {/* Plan view */}
      <ScrollView style={styles.planContainer} contentContainerStyle={styles.planInhalt}>
        {svgXml ? (
          <SvgXml xml={svgXml} width={screenWidth - 16} height={undefined} />
        ) : (
          <ActivityIndicator style={styles.loading} />
        )}
      </ScrollView>

      {/* Stats */}
      {seitenPlan && (
        <View style={styles.stats}>
          <Text variant="bodySmall" style={styles.statText}>
            {seitenPlan.felder.length} Felder · {seitenPlan.lagen.length} Lagen
          </Text>
          <Text variant="bodySmall" style={styles.statText}>
            {seite?.anzeigename} – Maßstab 1:50
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  seitenLeiste: { maxHeight: 52, backgroundColor: '#1565C0', paddingVertical: 6, paddingHorizontal: 8 },
  seitenChip: { marginRight: 6, backgroundColor: 'rgba(255,255,255,0.2)' },
  seitenChipAktiv: { backgroundColor: 'white' },
  ebenenLeiste: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 4, backgroundColor: '#E3F2FD' },
  ebeneChip: { backgroundColor: '#BBDEFB' },
  planContainer: { flex: 1, backgroundColor: 'white' },
  planInhalt: { padding: 8 },
  loading: { flex: 1, margin: 40 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#E3F2FD' },
  statText: { color: '#1565C0' },
  leer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  leerSub: { color: '#666', textAlign: 'center', marginTop: 8 },
});
