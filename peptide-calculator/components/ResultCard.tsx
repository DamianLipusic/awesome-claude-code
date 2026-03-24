import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../constants/theme';

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  badge?: string;
  badgeColor?: string;
  icon?: string;
  dark?: boolean;
}

export default function ResultCard({ label, value, unit, badge, badgeColor, icon, dark }: Props) {
  const bg   = dark ? COLORS.cardDark   : COLORS.cardLight;
  const text = dark ? COLORS.textDark   : COLORS.textLight;
  const muted = dark ? COLORS.mutedDark : COLORS.mutedLight;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;

  return (
    <View style={[styles.card, SHADOW.card, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[styles.label, { color: muted }]}>{icon ? `${icon} ` : ''}{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.value, { color: text }]} numberOfLines={1} adjustsFontSizeToFit>
          {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : value}
        </Text>
        {unit ? <Text style={[styles.unit, { color: muted }]}>{unit}</Text> : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: badgeColor ?? COLORS.accent }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    margin: SPACING.xs,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  label: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: FONT_SIZE.xl,
    fontWeight: '700',
    flexShrink: 1,
  },
  unit: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '500',
    flexShrink: 0,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
  },
  badgeText: {
    color: '#fff',
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
  },
});
