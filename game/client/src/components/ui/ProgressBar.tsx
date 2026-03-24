import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({
  progress,
  color = '#22c55e',
  height = 6,
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = Math.round(clamped * 100);

  return (
    <View>
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, backgroundColor: color, height },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color }]}>{pct}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 999,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
  },
  fill: {
    borderRadius: 999,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
});
