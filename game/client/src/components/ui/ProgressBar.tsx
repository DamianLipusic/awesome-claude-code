import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  height?: number;
  style?: ViewStyle;
  showLabel?: boolean;
}

export function ProgressBar({
  progress,
  color = '#22c55e',
  height = 4,
  style,
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = Math.round(clamped * 100);

  return (
    <View style={style}>
      <View style={[styles.track, { height }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${pct}%` as `${number}%`,
              height,
              backgroundColor: color,
            },
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
    borderRadius: 4,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
    textAlign: 'right',
  },
});
