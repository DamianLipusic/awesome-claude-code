import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert,
} from 'react-native';
import { CompareEntry } from '../types';
import { validateSequence, calculateAll } from '../lib/calculations';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../constants/theme';

interface Props {
  entries: CompareEntry[];
  dark: boolean;
  onAdd: (entry: CompareEntry) => void;
  onRemove: (id: string) => void;
}

const PROPS: { key: keyof ReturnType<typeof calculateAll>; label: string; unit?: string; decimals?: number }[] = [
  { key: 'length',          label: 'Length',          unit: 'aa',          decimals: 0 },
  { key: 'mwAvg',           label: 'MW (avg)',         unit: 'Da',          decimals: 2 },
  { key: 'pI',              label: 'pI',               decimals: 2 },
  { key: 'netCharge',       label: 'Net Charge pH7.4', decimals: 2 },
  { key: 'extinctionCoeff', label: 'ε₂₈₀',            unit: 'M⁻¹cm⁻¹',   decimals: 0 },
  { key: 'gravy',           label: 'GRAVY',            decimals: 3 },
  { key: 'instabilityIndex',label: 'Instability',      decimals: 2 },
  { key: 'aliphaticIndex',  label: 'Aliphatic',        decimals: 2 },
  { key: 'halfLife',        label: 'Half-Life' },
  { key: 'retentionTime',   label: 'HPLC RT',          decimals: 1 },
  { key: 'solubilityScore', label: 'Solubility',       unit: '/100',        decimals: 0 },
];

export default function CompareScreen({ entries, dark, onAdd, onRemove }: Props) {
  const [inputSeq, setInputSeq] = React.useState('');
  const [inputName, setInputName] = React.useState('');

  const bg     = dark ? COLORS.bgDark    : COLORS.bgLight;
  const card   = dark ? COLORS.cardDark  : COLORS.cardLight;
  const text   = dark ? COLORS.textDark  : COLORS.textLight;
  const muted  = dark ? COLORS.mutedDark : COLORS.mutedLight;
  const border = dark ? COLORS.borderDark: COLORS.borderLight;
  const surface= dark ? COLORS.surfaceDark: COLORS.surfaceLight;

  const addEntry = () => {
    const { valid, sequence, errors } = validateSequence(inputSeq);
    if (!valid) { Alert.alert('Invalid Sequence', errors.join('\n')); return; }
    const results = calculateAll(sequence, { nAcetyl: false, cAmide: false, disulfide: 0 });
    const id = Math.random().toString(36).slice(2);
    onAdd({ id, sequence, name: inputName || `Peptide ${entries.length + 1}`, results });
    setInputSeq('');
    setInputName('');
  };

  const getVal = (entry: CompareEntry, key: string): string => {
    if (!entry.results) return '—';
    const v = (entry.results as any)[key];
    return v === undefined ? '—' : String(v);
  };

  return (
    <ScrollView style={[styles.screen, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
      {/* Add entry */}
      <View style={[styles.card, SHADOW.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={[styles.title, { color: text }]}>Add Peptide</Text>
        <TextInput
          style={[styles.input, { backgroundColor: surface, color: text, borderColor: border }]}
          value={inputName}
          onChangeText={setInputName}
          placeholder="Name (optional)"
          placeholderTextColor={muted}
        />
        <TextInput
          style={[styles.input, styles.seqInput, { backgroundColor: surface, color: text, borderColor: border }]}
          value={inputSeq}
          onChangeText={setInputSeq}
          placeholder="Sequence (e.g. ACDEFG)"
          placeholderTextColor={muted}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
        />
        <TouchableOpacity
          style={[styles.addBtn, { opacity: inputSeq.length < 2 ? 0.5 : 1 }]}
          onPress={addEntry}
          disabled={inputSeq.length < 2}
        >
          <Text style={styles.addBtnText}>+ Add to Comparison</Text>
        </TouchableOpacity>
      </View>

      {entries.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>⚗️</Text>
          <Text style={[styles.emptyTitle, { color: text }]}>No Peptides Yet</Text>
          <Text style={[styles.emptyText, { color: muted }]}>Add up to 5 peptides to compare side by side.</Text>
        </View>
      )}

      {entries.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {/* Header row */}
            <View style={styles.tableRow}>
              <View style={[styles.labelCell, { backgroundColor: card }]}>
                <Text style={[styles.colHeader, { color: muted }]}>Property</Text>
              </View>
              {entries.map(e => (
                <View key={e.id} style={[styles.valueCell, { backgroundColor: card, borderColor: border }]}>
                  <Text style={[styles.colHeader, { color: COLORS.primary }]} numberOfLines={1}>{e.name}</Text>
                  <TouchableOpacity onPress={() => onRemove(e.id)}>
                    <Text style={{ color: COLORS.danger, fontSize: 10, textAlign: 'center' }}>✕ remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Data rows */}
            {PROPS.map((prop, ri) => {
              const rowBg = ri % 2 === 0
                ? (dark ? COLORS.surfaceDark : COLORS.surfaceLight)
                : card;
              return (
                <View key={prop.key} style={[styles.tableRow, { backgroundColor: rowBg }]}>
                  <View style={[styles.labelCell, { backgroundColor: rowBg }]}>
                    <Text style={[styles.propLabel, { color: muted }]}>{prop.label}</Text>
                    {prop.unit && <Text style={[styles.unit, { color: muted }]}>{prop.unit}</Text>}
                  </View>
                  {entries.map(e => (
                    <View key={e.id} style={[styles.valueCell, { backgroundColor: rowBg, borderColor: border }]}>
                      <Text style={[styles.value, { color: text }]}>{getVal(e, prop.key)}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.md, paddingBottom: 80 },
  card: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, marginBottom: SPACING.md },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700', marginBottom: SPACING.sm },
  input: { borderRadius: RADIUS.md, borderWidth: 1, padding: SPACING.sm, fontSize: FONT_SIZE.md, marginBottom: SPACING.sm },
  seqInput: { fontFamily: 'monospace' },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: SPACING.sm + 2, alignItems: 'center' },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FONT_SIZE.md },
  empty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyIcon: { fontSize: 48, marginBottom: SPACING.md },
  emptyTitle: { fontSize: FONT_SIZE.xl, fontWeight: '700', marginBottom: SPACING.sm },
  emptyText: { fontSize: FONT_SIZE.sm, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  tableRow: { flexDirection: 'row', minHeight: 44 },
  labelCell: { width: 130, justifyContent: 'center', paddingHorizontal: SPACING.sm },
  valueCell: { width: 110, justifyContent: 'center', alignItems: 'center', borderLeftWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACING.sm },
  colHeader: { fontSize: FONT_SIZE.xs, fontWeight: '700', textAlign: 'center' },
  propLabel: { fontSize: FONT_SIZE.xs, fontWeight: '600' },
  unit: { fontSize: 9 },
  value: { fontSize: FONT_SIZE.sm, fontWeight: '600', textAlign: 'center' },
});
