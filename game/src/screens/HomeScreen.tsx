import React, { useEffect, useRef } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { MoneyDisplay } from '../components/MoneyDisplay';
import { TapButton } from '../components/TapButton';
import { getTotalIncomePerSecond } from '../utils/gameLogic';
import { formatMoney } from '../utils/formatMoney';
import { BUSINESSES } from '../data/businesses';

const TICK_INTERVAL = 100; // ms

export function HomeScreen() {
  const {
    money,
    totalEarned,
    lifetimeEarned,
    tapValue,
    businesses,
    ownedItems,
    prestigeMultiplier,
    prestigeLevel,
    boostActive,
    boostExpiry,
    isPremium,
    tap,
    tick,
    loadSave,
    saveGame,
  } = useGameStore();

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    loadSave();
  }, []);

  useEffect(() => {
    tickRef.current = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      tick(delta);
    }, TICK_INTERVAL);

    saveRef.current = setInterval(() => {
      saveGame();
    }, 10_000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (saveRef.current) clearInterval(saveRef.current);
    };
  }, []);

  const ips = getTotalIncomePerSecond(
    businesses, ownedItems, prestigeMultiplier, boostActive && Date.now() < boostExpiry, isPremium
  );

  const topBusinesses = businesses
    .filter(b => b.level > 0)
    .slice(0, 3)
    .map(b => {
      const def = BUSINESSES.find(d => d.id === b.id);
      return def ? `${def.emoji} ${def.name} Lv.${b.level}` : '';
    });

  const boostTimeLeft = boostActive ? Math.max(0, Math.ceil((boostExpiry - Date.now()) / 60000)) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>💸 CASH EMPIRE</Text>
          {prestigeLevel > 0 && (
            <Text style={styles.prestige}>Prestige ×{prestigeMultiplier}</Text>
          )}
        </View>

        {/* Money Display */}
        <MoneyDisplay money={money} incomePerSecond={ips} />

        {/* Boost Badge */}
        {boostActive && (
          <View style={styles.boostBadge}>
            <Text style={styles.boostText}>⚡ 5× BOOST ACTIVE — {boostTimeLeft}m left</Text>
          </View>
        )}

        {/* Tap Button */}
        <TapButton onTap={tap} tapValue={tapValue * prestigeMultiplier} />

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatMoney(totalEarned)}</Text>
            <Text style={styles.statLabel}>This Run</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatMoney(lifetimeEarned)}</Text>
            <Text style={styles.statLabel}>Lifetime</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatMoney(ips)}</Text>
            <Text style={styles.statLabel}>Per Second</Text>
          </View>
        </View>

        {/* Active Businesses */}
        {topBusinesses.length > 0 && (
          <View style={styles.bizPreview}>
            <Text style={styles.bizTitle}>Active Businesses</Text>
            {topBusinesses.map((b, i) => (
              <Text key={i} style={styles.bizItem}>{b}</Text>
            ))}
            {businesses.filter(b => b.level > 0).length > 3 && (
              <Text style={styles.bizMore}>
                +{businesses.filter(b => b.level > 0).length - 3} more → go to Businesses tab
              </Text>
            )}
          </View>
        )}

        {topBusinesses.length === 0 && (
          <View style={styles.hint}>
            <Text style={styles.hintText}>👆 Tap to earn money, then buy businesses!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 20, paddingBottom: 30 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#FFD700', letterSpacing: 1 },
  prestige: {
    backgroundColor: '#FFD70022',
    borderColor: '#FFD700',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: '#FFD700',
    fontWeight: '700',
    fontSize: 13,
  },
  boostBadge: {
    backgroundColor: '#1a1a00',
    borderColor: '#FFD700',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  boostText: { color: '#FFD700', fontWeight: '700', fontSize: 13 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  statValue: { color: '#FFD700', fontWeight: '800', fontSize: 16 },
  statLabel: { color: '#666', fontSize: 11, marginTop: 2 },
  bizPreview: {
    marginTop: 20,
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  bizTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 8 },
  bizItem: { color: '#aaa', fontSize: 14, paddingVertical: 3 },
  bizMore: { color: '#555', fontSize: 12, marginTop: 6 },
  hint: {
    marginTop: 30,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#12122a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  hintText: { color: '#aaa', fontSize: 15, textAlign: 'center', lineHeight: 22 },
});
