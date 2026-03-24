import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { AA_DATA } from '../lib/aaData';
import { COLORS, SPACING, FONT_SIZE, RADIUS, getAAColor } from '../constants/theme';

interface Props {
  sequence: string;
  dark?: boolean;
}

export default function SequenceViewer({ sequence, dark }: Props) {
  const bg = dark ? COLORS.surfaceDark : COLORS.surfaceLight;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;

  if (!sequence) return null;

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.header, { color: dark ? COLORS.mutedDark : COLORS.mutedLight }]}>
        Sequence Viewer · {sequence.length} residues
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        <View style={styles.row}>
          {sequence.split('').map((aa, i) => {
            const group = AA_DATA[aa]?.group ?? 'special';
            const color = getAAColor(group);
            return (
              <View key={i} style={[styles.aa, { backgroundColor: color + '22', borderColor: color }]}>
                <Text style={[styles.aaLetter, { color }]}>{aa}</Text>
                <Text style={[styles.aaPos, { color: dark ? COLORS.mutedDark : COLORS.mutedLight }]}>
                  {i + 1}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Legend */}
      <View style={styles.legend}>
        {(['acidic','basic','polar','hydrophobic','special'] as const).map(g => (
          <View key={g} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: getAAColor(g) }]} />
            <Text style={[styles.legendText, { color: dark ? COLORS.mutedDark : COLORS.mutedLight }]}>
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  header: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  scroll: { marginBottom: SPACING.sm },
  row: { flexDirection: 'row', flexWrap: 'nowrap', gap: 3 },
  aa: {
    width: 28,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aaLetter: { fontSize: 13, fontWeight: '700', fontFamily: 'monospace' },
  aaPos: { fontSize: 8, marginTop: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FONT_SIZE.xs },
});
