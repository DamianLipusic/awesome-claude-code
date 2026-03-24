import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { ShopItemCard } from '../components/ShopItemCard';
import { SHOP_ITEMS } from '../data/shopItems';
import { formatMoney } from '../utils/formatMoney';

type Category = 'all' | 'vehicle' | 'property' | 'status';

const CATEGORIES: { key: Category; label: string; emoji: string }[] = [
  { key: 'all', label: 'All', emoji: '✨' },
  { key: 'vehicle', label: 'Rides', emoji: '🚗' },
  { key: 'property', label: 'Property', emoji: '🏠' },
  { key: 'status', label: 'Status', emoji: '💎' },
];

export function ShopScreen() {
  const { money, ownedItems, prestigeLevel, buyItem } = useGameStore();
  const [category, setCategory] = useState<Category>('all');

  const filtered = SHOP_ITEMS.filter(item =>
    category === 'all' || item.category === category
  );

  const totalBonusPercent = Math.round(
    (ownedItems.reduce((acc, id) => {
      const item = SHOP_ITEMS.find(i => i.id === id);
      return item ? acc * item.incomeBonus : acc;
    }, 1) - 1) * 100
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🛍️ Flex Shop</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatMoney(money)}</Text>
            <Text style={styles.statLabel}>Your Cash</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>+{totalBonusPercent}%</Text>
            <Text style={styles.statLabel}>Income Bonus</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{ownedItems.length}</Text>
            <Text style={styles.statLabel}>Owned</Text>
          </View>
        </View>

        {/* Category Tabs */}
        <View style={styles.tabs}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.tab, category === cat.key && styles.activeTab]}
              onPress={() => setCategory(cat.key)}
            >
              <Text style={[styles.tabText, category === cat.key && styles.activeTabText]}>
                {cat.emoji} {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Items */}
        {filtered.map(item => (
          <ShopItemCard
            key={item.id}
            item={item}
            owned={ownedItems.includes(item.id)}
            money={money}
            prestigeLevel={prestigeLevel}
            onBuy={() => buyItem(item.id)}
          />
        ))}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', paddingVertical: 18 },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
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
  statValue: { color: '#FFD700', fontWeight: '800', fontSize: 15 },
  statLabel: { color: '#666', fontSize: 11, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    backgroundColor: '#12122a',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  activeTab: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  tabText: { color: '#888', fontSize: 11, fontWeight: '600' },
  activeTabText: { color: '#000' },
});
