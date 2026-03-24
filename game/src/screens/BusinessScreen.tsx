import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { BusinessCard } from '../components/BusinessCard';
import { BUSINESSES } from '../data/businesses';
import { formatMoney, formatPerSecond } from '../utils/formatMoney';
import { getTotalIncomePerSecond } from '../utils/gameLogic';

export function BusinessScreen() {
  const {
    money,
    totalEarned,
    businesses,
    ownedItems,
    prestigeMultiplier,
    boostActive,
    boostExpiry,
    isPremium,
    buyBusiness,
    toggleAutoManage,
  } = useGameStore();

  const ips = getTotalIncomePerSecond(
    businesses, ownedItems, prestigeMultiplier, boostActive && Date.now() < boostExpiry, isPremium
  );

  const totalOwned = businesses.filter(b => b.level > 0).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🏢 Businesses</Text>

        {/* Summary Bar */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalOwned}</Text>
            <Text style={styles.summaryLabel}>Owned</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatPerSecond(ips)}</Text>
            <Text style={styles.summaryLabel}>Total Income</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatMoney(money)}</Text>
            <Text style={styles.summaryLabel}>Available</Text>
          </View>
        </View>

        <Text style={styles.tip}>💡 Enable AUTO to earn passively while you're away</Text>

        {BUSINESSES.map(def => {
          const state = businesses.find(b => b.id === def.id)!;
          return (
            <BusinessCard
              key={def.id}
              definition={def}
              state={state}
              money={money}
              totalEarned={totalEarned}
              onBuy={() => buyBusiness(def.id)}
              onToggleAuto={() => toggleAutoManage(def.id)}
            />
          );
        })}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', paddingVertical: 18 },
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { color: '#FFD700', fontWeight: '800', fontSize: 16 },
  summaryLabel: { color: '#666', fontSize: 11, marginTop: 2 },
  tip: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },
});
