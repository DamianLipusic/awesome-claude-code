import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';

interface CountdownTimerProps {
  target: Date | string;
  style?: TextStyle;
  onComplete?: () => void;
  prefix?: string;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '00:00:00';

  const totalSecs = Math.floor(ms / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function CountdownTimer({ target, style, onComplete, prefix = '' }: CountdownTimerProps) {
  const targetDate = typeof target === 'string' ? new Date(target) : target;

  const [remaining, setRemaining] = useState(() =>
    Math.max(0, targetDate.getTime() - Date.now())
  );

  useEffect(() => {
    if (remaining <= 0) {
      onComplete?.();
      return;
    }

    const interval = setInterval(() => {
      const r = Math.max(0, targetDate.getTime() - Date.now());
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate.getTime(), onComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  const isComplete = remaining <= 0;

  return (
    <Text style={[styles.text, isComplete && styles.complete, style]}>
      {isComplete ? 'Complete' : `${prefix}${formatDuration(remaining)}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f97316',
    fontVariant: ['tabular-nums'],
  },
  complete: {
    color: '#22c55e',
  },
});
