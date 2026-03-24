import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AA_DATA } from '../../lib/aaData';
import { COLORS, SPACING, FONT_SIZE, RADIUS, getAAColor } from '../../constants/theme';

interface Props {
  composition: Record<string, number>;
  total: number;
  dark?: boolean;
}

export default function CompositionChart({ composition, total, dark }: Props) {
  const bg     = dark ? COLORS.cardDark   : COLORS.cardLight;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;
  const text   = dark ? COLORS.textDark   : COLORS.textLight;
  const muted  = dark ? COLORS.mutedDark  : COLORS.mutedLight;

  const sorted = Object.entries(composition)
    .sort((a, b) => b[1] - a[1]);

  const maxCount = sorted[0]?.[1] ?? 1;

  return (
    <View style={[styles.container, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.title, { color: text }]}>Amino Acid Composition</Text>
      <Text style={[styles.sub, { color: muted }]}>{total} residues total</Text>

      {sorted.map(([aa, count]) => {
        const pct = (count / total) * 100;
        const barPct = (count / maxCount) * 100;
        const color = getAAColor(AA_DATA[aa]?.group ?? 'special');
        return (
          <View key={aa} style={styles.row}>
            <Text style={[styles.aaLabel, { color, fontFamily: 'monospace' }]}>{aa}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { width: `${barPct}%` as any, backgroundColor: color + 'CC' }]} />
            </View>
            <Text style={[styles.count, { color: muted }]}>{count}</Text>
            <Text style={[styles.pct, { color: muted }]}>{pct.toFixed(1)}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginVertical: SPACING.sm,
  },
  title: { fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 2 },
  sub: { fontSize: FONT_SIZE.xs, marginBottom: SPACING.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 6,
  },
  aaLabel: { width: 14, fontSize: FONT_SIZE.sm, fontWeight: '700' },
  barTrack: { flex: 1, height: 16, borderRadius: 4, backgroundColor: '#00000011', overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  count: { width: 22, fontSize: FONT_SIZE.xs, textAlign: 'right' },
  pct: { width: 38, fontSize: FONT_SIZE.xs, textAlign: 'right' },
});
