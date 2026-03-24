import React, { useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Switch, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PeptideResults, Modifications } from '../types';
import ResultCard from '../components/ResultCard';
import SequenceViewer from '../components/SequenceViewer';
import ChargePHChart from '../components/charts/ChargePHChart';
import HydrophobicityChart from '../components/charts/HydrophobicityChart';
import CompositionChart from '../components/charts/CompositionChart';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../constants/theme';

interface Props {
  sequence: string;
  modifications: Modifications;
  results: PeptideResults | null;
  errors: string[];
  dark: boolean;
  onSequenceChange: (s: string) => void;
  onModChange: (m: Partial<Modifications>) => void;
  onAddCompare: () => void;
  onSaveProject: () => void;
}

function instabilityBadge(ii: number): { label: string; color: string } {
  if (ii < 40) return { label: 'Stable', color: COLORS.success };
  return { label: 'Unstable', color: COLORS.danger };
}

function solubilityBadge(s: number): { label: string; color: string } {
  if (s >= 60) return { label: 'Soluble', color: COLORS.success };
  if (s >= 40) return { label: 'Moderate', color: COLORS.warning };
  return { label: 'Poor', color: COLORS.danger };
}

function gravyBadge(g: number): { label: string; color: string } {
  if (g > 0) return { label: 'Hydrophobic', color: COLORS.hydrophobic };
  return { label: 'Hydrophilic', color: COLORS.primary };
}

export default function CalculatorScreen({
  sequence, modifications, results, errors, dark,
  onSequenceChange, onModChange, onAddCompare, onSaveProject,
}: Props) {
  const [showCharts, setShowCharts] = useState(true);
  const bg     = dark ? COLORS.bgDark    : COLORS.bgLight;
  const card   = dark ? COLORS.cardDark  : COLORS.cardLight;
  const text   = dark ? COLORS.textDark  : COLORS.textLight;
  const muted  = dark ? COLORS.mutedDark : COLORS.mutedLight;
  const border = dark ? COLORS.borderDark: COLORS.borderLight;
  const surface= dark ? COLORS.surfaceDark: COLORS.surfaceLight;

  const copyResults = async () => {
    if (!results) return;
    const txt = [
      `PeptiCalc Pro — ${new Date().toLocaleDateString()}`,
      `Sequence: ${results.sequence}`,
      `Length: ${results.length} aa`,
      `MW (avg): ${results.mwAvg.toFixed(2)} Da`,
      `MW (mono): ${results.mwMono.toFixed(4)} Da`,
      `pI: ${results.pI.toFixed(2)}`,
      `Net Charge (pH 7.4): ${results.netCharge}`,
      `Extinction Coeff: ${results.extinctionCoeff} M⁻¹cm⁻¹`,
      `GRAVY: ${results.gravy}`,
      `Instability Index: ${results.instabilityIndex}`,
      `Aliphatic Index: ${results.aliphaticIndex}`,
      `Half-Life: ${results.halfLife}`,
      `HPLC RT: ${results.retentionTime}`,
      `Solubility Score: ${results.solubilityScore}/100`,
    ].join('\n');
    await Clipboard.setStringAsync(txt);
    Alert.alert('Copied', 'Results copied to clipboard.');
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
      {/* Sequence input */}
      <View style={[styles.inputCard, SHADOW.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.sectionTitle, { color: text }]}>Peptide Sequence</Text>
        <TextInput
          style={[styles.input, { backgroundColor: surface, color: text, borderColor: border }]}
          value={sequence}
          onChangeText={onSequenceChange}
          placeholder="e.g. ACDEFGHIKLMNPQRSTVWY"
          placeholderTextColor={muted}
          multiline
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
        />
        {errors.map((e, i) => (
          <Text key={i} style={styles.error}>{e}</Text>
        ))}
        <Text style={[styles.hint, { color: muted }]}>
          {sequence.replace(/\s/g, '').length} residues · One-letter codes only
        </Text>

        {/* Modifications */}
        <Text style={[styles.modTitle, { color: muted }]}>Modifications</Text>
        <View style={styles.modRow}>
          <View style={styles.modItem}>
            <Switch
              value={modifications.nAcetyl}
              onValueChange={v => onModChange({ nAcetyl: v })}
              trackColor={{ false: border, true: COLORS.primary }}
              thumbColor="#fff"
            />
            <Text style={[styles.modLabel, { color: text }]}>N-Acetyl</Text>
          </View>
          <View style={styles.modItem}>
            <Switch
              value={modifications.cAmide}
              onValueChange={v => onModChange({ cAmide: v })}
              trackColor={{ false: border, true: COLORS.primary }}
              thumbColor="#fff"
            />
            <Text style={[styles.modLabel, { color: text }]}>C-Amide</Text>
          </View>
          <View style={styles.modItem}>
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: border }]}
              onPress={() => onModChange({ disulfide: Math.max(0, modifications.disulfide - 1) })}
            >
              <Text style={{ color: text, fontWeight: '700' }}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.modLabel, { color: text }]}>{modifications.disulfide} S-S</Text>
            <TouchableOpacity
              style={[styles.stepBtn, { borderColor: border }]}
              onPress={() => onModChange({ disulfide: modifications.disulfide + 1 })}
            >
              <Text style={{ color: text, fontWeight: '700' }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, { borderColor: border }]} onPress={copyResults}>
            <Text style={[styles.btnText, { color: text }]}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { borderColor: border }]} onPress={onAddCompare}>
            <Text style={[styles.btnText, { color: text }]}>Compare</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btnPrimary]} onPress={onSaveProject}>
            <Text style={styles.btnPrimaryText}>Save Project</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      {results && (
        <>
          <SequenceViewer sequence={results.sequence} dark={dark} />

          <Text style={[styles.sectionTitle, { color: text, marginTop: SPACING.md }]}>Properties</Text>
          <View style={styles.grid}>
            <ResultCard label="MW (avg)"  value={results.mwAvg.toFixed(2)}  unit="Da"      dark={dark} />
            <ResultCard label="MW (mono)" value={results.mwMono.toFixed(4)} unit="Da"      dark={dark} />
          </View>
          <View style={styles.grid}>
            <ResultCard label="pI"        value={results.pI.toFixed(2)}     dark={dark} />
            <ResultCard label="Net Charge pH 7.4" value={results.netCharge} dark={dark}
              badge={results.netCharge > 0 ? 'Cationic' : results.netCharge < 0 ? 'Anionic' : 'Neutral'}
              badgeColor={results.netCharge > 0 ? COLORS.basic : results.netCharge < 0 ? COLORS.acidic : COLORS.mutedLight}
            />
          </View>
          <View style={styles.grid}>
            <ResultCard label="ε₂₈₀" value={results.extinctionCoeff} unit="M⁻¹cm⁻¹" dark={dark} />
            <ResultCard label="GRAVY" value={results.gravy} dark={dark}
              badge={gravyBadge(results.gravy).label}
              badgeColor={gravyBadge(results.gravy).color}
            />
          </View>
          <View style={styles.grid}>
            <ResultCard label="Instability" value={results.instabilityIndex} dark={dark}
              badge={instabilityBadge(results.instabilityIndex).label}
              badgeColor={instabilityBadge(results.instabilityIndex).color}
            />
            <ResultCard label="Aliphatic" value={results.aliphaticIndex} dark={dark} />
          </View>
          <View style={styles.grid}>
            <ResultCard label="Half-Life" value={results.halfLife} dark={dark} />
            <ResultCard label="HPLC RT" value={results.retentionTime} dark={dark} />
          </View>
          <View style={styles.grid}>
            <ResultCard label="Solubility" value={`${results.solubilityScore}/100`} dark={dark}
              badge={solubilityBadge(results.solubilityScore).label}
              badgeColor={solubilityBadge(results.solubilityScore).color}
            />
            <ResultCard label="Length" value={results.length} unit="aa" dark={dark} />
          </View>

          {/* Charts toggle */}
          <TouchableOpacity
            style={[styles.chartToggle, { borderColor: border }]}
            onPress={() => setShowCharts(v => !v)}
          >
            <Text style={[styles.chartToggleText, { color: COLORS.primary }]}>
              {showCharts ? '▲ Hide Charts' : '▼ Show Charts'}
            </Text>
          </TouchableOpacity>

          {showCharts && (
            <>
              <ChargePHChart data={results.chargeVsPH} pI={results.pI} dark={dark} />
              <HydrophobicityChart data={results.hydrophobicityProfile} dark={dark} />
              <CompositionChart composition={results.composition} total={results.length} dark={dark} />
            </>
          )}
        </>
      )}

      {!results && !sequence && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🧬</Text>
          <Text style={[styles.emptyTitle, { color: text }]}>Enter a Peptide Sequence</Text>
          <Text style={[styles.emptyText, { color: muted }]}>
            Type or paste a one-letter amino acid sequence above to calculate properties, visualize charts, and more.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: 80 },
  inputCard: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.sm },
  sectionTitle: { fontSize: FONT_SIZE.lg, fontWeight: '700', marginBottom: SPACING.sm },
  input: {
    borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.sm,
    fontFamily: 'monospace', fontSize: FONT_SIZE.md, minHeight: 56,
    textAlignVertical: 'top',
  },
  error: { color: COLORS.danger, fontSize: FONT_SIZE.xs, marginTop: 4 },
  hint: { fontSize: FONT_SIZE.xs, marginTop: 4 },
  modTitle: { fontSize: FONT_SIZE.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: SPACING.sm },
  modRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, alignItems: 'center' },
  modItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modLabel: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  stepBtn: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  btn: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, alignItems: 'center' },
  btnText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  btnPrimary: { flex: 1.5, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.primary, alignItems: 'center' },
  btnPrimaryText: { color: '#fff', fontSize: FONT_SIZE.sm, fontWeight: '700' },
  grid: { flexDirection: 'row', marginBottom: 0 },
  chartToggle: { borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.sm, alignItems: 'center', marginVertical: SPACING.sm },
  chartToggleText: { fontSize: FONT_SIZE.sm, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
});
