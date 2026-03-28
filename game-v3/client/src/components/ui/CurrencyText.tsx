import React from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';

interface CurrencyTextProps {
  amount: number;
  variant?: 'clean' | 'dirty' | 'neutral';
  style?: TextStyle;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function formatCurrency(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  return `${sign}$${abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCurrencyCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
}

const variantColors = {
  clean: '#22c55e',
  dirty: '#ef4444',
  neutral: '#f3f4f6',
};

const sizeMap = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 24,
};

export function CurrencyText({ amount, variant = 'neutral', style, size = 'md' }: CurrencyTextProps) {
  return (
    <Text
      style={[
        styles.text,
        { color: variantColors[variant], fontSize: sizeMap[size] },
        style,
      ]}
    >
      {formatCurrency(amount)}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
