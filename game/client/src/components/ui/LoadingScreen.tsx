import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

interface LoadingScreenProps {
  message?: string;
  fullscreen?: boolean;
}

export function LoadingScreen({ message, fullscreen = true }: LoadingScreenProps) {
  return (
    <View style={[styles.container, fullscreen && styles.fullscreen]}>
      <ActivityIndicator size="large" color="#22c55e" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.skeletonContainer}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.skeletonLine, { width: '70%' }]} />
          <View style={[styles.skeletonLine, { width: '40%', marginTop: 6 }]} />
        </View>
      ))}
    </View>
  );
}

export function CardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <View style={[styles.skeletonLine, { width: '50%', height: 16, marginBottom: 8 }]} />
      <View style={[styles.skeletonLine, { width: '80%', height: 12 }]} />
      <View style={[styles.skeletonLine, { width: '60%', height: 12, marginTop: 6 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: '#030712',
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  skeletonContainer: {
    gap: 12,
  },
  skeletonRow: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1f2937',
  },
  cardSkeleton: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 10,
  },
});
