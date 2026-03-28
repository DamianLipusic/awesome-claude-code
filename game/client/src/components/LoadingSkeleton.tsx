import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: object;
}

function SkeletonBox({ width = "100%", height = 16, borderRadius = 6, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.box,
        { width: width as number, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBox width="40%" height={14} />
      <View style={styles.spacerSm} />
      <SkeletonBox width="70%" height={24} />
      <View style={styles.spacerMd} />
      <View style={styles.row}>
        <SkeletonBox width="45%" height={12} />
        <SkeletonBox width="30%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.listRow}>
          <SkeletonBox width={40} height={40} borderRadius={8} />
          <View style={styles.listRowContent}>
            <SkeletonBox width="60%" height={14} />
            <View style={styles.spacerSm} />
            <SkeletonBox width="40%" height={10} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DashboardSkeleton() {
  return (
    <View style={styles.container}>
      <SkeletonBox width="50%" height={22} style={styles.spacerMd} />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonList rows={3} />
    </View>
  );
}

export { SkeletonBox };

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#1f2937",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  spacerSm: { height: 6 },
  spacerMd: { height: 12 },
  list: { gap: 10 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  listRowContent: {
    flex: 1,
  },
  container: {
    padding: 16,
    gap: 4,
  },
});
