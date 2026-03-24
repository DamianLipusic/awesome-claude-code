import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

type BadgeVariant =
  | 'green'
  | 'red'
  | 'orange'
  | 'blue'
  | 'purple'
  | 'gray'
  | 'yellow';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
  size?: 'sm' | 'md';
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  green:  { bg: '#052e16', text: '#22c55e', border: '#166534' },
  red:    { bg: '#450a0a', text: '#ef4444', border: '#7f1d1d' },
  orange: { bg: '#431407', text: '#f97316', border: '#7c2d12' },
  blue:   { bg: '#0c1a2e', text: '#3b82f6', border: '#1e3a5f' },
  purple: { bg: '#2e1065', text: '#a855f7', border: '#581c87' },
  gray:   { bg: '#1f2937', text: '#9ca3af', border: '#374151' },
  yellow: { bg: '#422006', text: '#eab308', border: '#713f12' },
};

export function Badge({ label, variant = 'gray', style, size = 'sm' }: BadgeProps) {
  const colors = variantColors[variant];
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          paddingHorizontal: isSmall ? 6 : 10,
          paddingVertical: isSmall ? 2 : 4,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: colors.text, fontSize: isSmall ? 10 : 12 },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

// Convenience helpers

export function StatusBadge({ status }: { status: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    ACTIVE: 'green',
    IDLE: 'gray',
    RAIDED: 'red',
    BANKRUPT: 'red',
    SUSPENDED: 'yellow',
    OPEN: 'blue',
    PARTIALLY_FILLED: 'yellow',
    FILLED: 'green',
    CANCELLED: 'gray',
    EXPIRED: 'gray',
    PENDING: 'yellow',
    COMPLETED: 'green',
    BREACHED: 'red',
    PLANNING: 'blue',
    BUSTED: 'red',
    ABORTED: 'gray',
    IN_PROGRESS: 'orange',
    SEIZED: 'red',
  };
  const variant = variantMap[status] ?? 'gray';
  return <Badge label={status.replace(/_/g, ' ')} variant={variant} />;
}

export function HeatBadge({ level }: { level: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    COLD: 'gray',
    WARM: 'yellow',
    HOT: 'orange',
    BURNING: 'red',
    FUGITIVE: 'purple',
  };
  const variant = variantMap[level] ?? 'gray';
  return <Badge label={level} variant={variant} />;
}

export function AlignmentBadge({ alignment }: { alignment: string }) {
  const variantMap: Record<string, BadgeVariant> = {
    LEGAL: 'green',
    MIXED: 'yellow',
    CRIMINAL: 'red',
  };
  const variant = variantMap[alignment] ?? 'gray';
  return <Badge label={alignment} variant={variant} />;
}
