import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SynthesisStep } from '../types';
import { AA_DATA } from '../lib/aaData';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW, getAAColor, getThemeColors } from '../constants/theme';

interface Props {
  steps: SynthesisStep[];
  onToggle: (index: number) => void;
  dark?: boolean;
}

export default function SynthesisTracker({ steps, onToggle, dark }: Props) {
  const done = steps.filter(s => s.done).length;
  const pct  = steps.length ? (done / steps.length) * 100 : 0;

  const { card: bg, text, muted, border, surface: trackBg } = getThemeColors(dark);

  return (
    <View style={[styles.container, SHADOW.card, { backgroundColor: bg, borderColor: border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Synthesis Tracker</Text>
        <Text style={[styles.count, { color: COLORS.primary }]}>{done}/{steps.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.track, { backgroundColor: trackBg }]}>
        <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: pct === 100 ? COLORS.success : COLORS.primary }]} />
      </View>
      <Text style={[styles.pctText, { color: muted }]}>{pct.toFixed(0)}% complete · C→N direction</Text>

      {/* Steps */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {steps.map((step, idx) => {
          const group = AA_DATA[step.aa]?.group ?? 'special';
          const color = getAAColor(group);
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.step, { borderColor: border, opacity: step.done ? 0.7 : 1 }]}
              onPress={() => onToggle(idx)}
              activeOpacity={0.7}
            >
              {/* Checkbox */}
              <View style={[styles.checkbox, { borderColor: step.done ? COLORS.success : border,
                backgroundColor: step.done ? COLORS.success : 'transparent' }]}>
                {step.done && <Text style={styles.checkmark}>✓</Text>}
              </View>

              {/* AA badge */}
              <View style={[styles.aaBadge, { backgroundColor: color + '22', borderColor: color }]}>
                <Text style={[styles.aaLetter, { color }]}>{step.aa}</Text>
              </View>

              {/* Info */}
              <View style={styles.stepInfo}>
                <Text style={[styles.stepName, { color: text, textDecorationLine: step.done ? 'line-through' : 'none' }]}>
                  {AA_DATA[step.aa]?.fullName ?? step.aa}
                </Text>
                <Text style={[styles.stepPos, { color: muted }]}>
                  Position {step.position} (C→N)
                  {step.completedAt ? `  ·  ${new Date(step.completedAt).toLocaleTimeString()}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: RADIUS.lg, borderWidth: 1, padding: SPACING.md, marginVertical: SPACING.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  title: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  count: { fontSize: FONT_SIZE.lg, fontWeight: '700' },
  track: { height: 8, borderRadius: RADIUS.full, overflow: 'hidden', marginBottom: 4 },
  fill: { height: '100%', borderRadius: RADIUS.full },
  pctText: { fontSize: FONT_SIZE.xs, marginBottom: SPACING.md },
  scroll: { maxHeight: 360 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  aaBadge: {
    width: 30, height: 30, borderRadius: 6, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  aaLetter: { fontSize: 14, fontWeight: '700', fontFamily: 'monospace' },
  stepInfo: { flex: 1 },
  stepName: { fontSize: FONT_SIZE.md, fontWeight: '600' },
  stepPos: { fontSize: FONT_SIZE.xs, marginTop: 1 },
});
