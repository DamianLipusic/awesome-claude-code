import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ShopItem } from '../store/types';
import { formatMoney } from '../utils/formatMoney';

interface Props {
  item: ShopItem;
  owned: boolean;
  money: number;
  prestigeLevel: number;
  onBuy: () => void;
}

export function ShopItemCard({ item, owned, money, prestigeLevel, onBuy }: Props) {
  const isUnlocked = prestigeLevel >= item.unlockAt;
  const canAfford = money >= item.cost;
  const bonusPercent = Math.round((item.incomeBonus - 1) * 100);

  if (!isUnlocked) {
    return (
      <View style={[styles.card, styles.locked]}>
        <Text style={styles.emoji}>🔒</Text>
        <Text style={styles.lockedText}>Prestige {item.unlockAt}× to unlock</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, owned && styles.ownedCard]}>
      <Text style={styles.emoji}>{item.emoji}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.description}>{item.description}</Text>
        <Text style={styles.bonus}>+{bonusPercent}% income</Text>
      </View>
      {owned ? (
        <View style={styles.ownedBadge}>
          <Text style={styles.ownedText}>OWNED</Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.buyBtn, !canAfford && styles.disabled]}
          onPress={() => {
            if (canAfford) {
              onBuy();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          }}
          activeOpacity={canAfford ? 0.7 : 1}
        >
          <Text style={[styles.price, !canAfford && styles.disabledText]}>
            {formatMoney(item.cost)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 14,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    gap: 12,
  },
  ownedCard: {
    borderColor: '#FFD700',
    backgroundColor: '#1a1a14',
  },
  locked: {
    opacity: 0.45,
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 10,
  },
  emoji: { fontSize: 36 },
  info: { flex: 1 },
  name: { color: '#fff', fontWeight: '700', fontSize: 15 },
  description: { color: '#888', fontSize: 12, marginTop: 2 },
  bonus: { color: '#4ade80', fontSize: 12, marginTop: 4, fontWeight: '600' },
  buyBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 80,
  },
  disabled: { backgroundColor: '#2a2a3a' },
  price: { color: '#000', fontWeight: '800', fontSize: 13 },
  disabledText: { color: '#555' },
  ownedBadge: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ownedText: { color: '#000', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  lockedText: { color: '#666', fontSize: 12, marginTop: 4 },
});
