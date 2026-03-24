import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { formatMoney, formatPerSecond } from '../utils/formatMoney';

interface Props {
  money: number;
  incomePerSecond: number;
}

export function MoneyDisplay({ money, incomePerSecond }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevMoney = useRef(money);

  useEffect(() => {
    if (money > prevMoney.current) {
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.04, duration: 60, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
    }
    prevMoney.current = money;
  }, [Math.floor(money / 100)]);

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.money, { transform: [{ scale: scaleAnim }] }]}>
        {formatMoney(money)}
      </Animated.Text>
      {incomePerSecond > 0 && (
        <Text style={styles.ips}>+{formatPerSecond(incomePerSecond)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  money: {
    fontSize: 52,
    fontWeight: '900',
    color: '#FFD700',
    letterSpacing: -1,
    textShadowColor: 'rgba(255,215,0,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  ips: {
    fontSize: 16,
    color: '#4ade80',
    marginTop: 4,
    fontWeight: '600',
  },
});
