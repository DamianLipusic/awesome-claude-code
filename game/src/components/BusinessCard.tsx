import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BusinessDefinition, BusinessState } from '../store/types';
import { formatMoney, formatPerSecond } from '../utils/formatMoney';
import { getBusinessCost, getBusinessIncome } from '../utils/gameLogic';

interface Props {
  definition: BusinessDefinition;
  state: BusinessState;
  money: number;
  totalEarned: number;
  onBuy: () => void;
  onToggleAuto: () => void;
}

export function BusinessCard({ definition, state, money, totalEarned, onBuy, onToggleAuto }: Props) {
  const isUnlocked = totalEarned >= definition.unlockAt || state.level > 0;
  const cost = getBusinessCost(definition.id, state.level);
  const incomePerSec = getBusinessIncome(definition.id, state.level);
  const canAfford = money >= cost;
  const isOwned = state.level > 0;

  if (!isUnlocked) {
    return (
      <View style={[styles.card, styles.locked]}>
        <Text style={styles.lockEmoji}>🔒</Text>
        <Text style={styles.lockedText}>
          Earn {formatMoney(definition.unlockAt)} to unlock
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.emoji}>{definition.emoji}</Text>
        <View>
          <Text style={styles.name}>{definition.name}</Text>
          <Text style={styles.description}>{definition.description}</Text>
          {isOwned && (
            <Text style={styles.income}>
              {formatPerSecond(incomePerSec)} · Lv.{state.level}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.right}>
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
          <Text style={styles.buyLabel}>{isOwned ? 'UPGRADE' : 'BUY'}</Text>
          <Text style={[styles.buyCost, !canAfford && styles.disabledText]}>
            {formatMoney(cost)}
          </Text>
        </TouchableOpacity>

        {isOwned && (
          <TouchableOpacity
            style={[styles.autoBtn, state.autoManaged && styles.autoActive]}
            onPress={onToggleAuto}
          >
            <Text style={styles.autoLabel}>
              {state.autoManaged ? '🤖 AUTO' : '⏸ MANUAL'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  locked: {
    opacity: 0.5,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 12,
  },
  lockEmoji: { fontSize: 24, marginBottom: 4 },
  lockedText: { color: '#666', fontSize: 12 },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  emoji: { fontSize: 36 },
  name: { color: '#fff', fontWeight: '700', fontSize: 15 },
  description: { color: '#888', fontSize: 12, marginTop: 2 },
  income: { color: '#4ade80', fontSize: 12, marginTop: 2, fontWeight: '600' },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  buyBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 90,
  },
  disabled: {
    backgroundColor: '#2a2a3a',
  },
  buyLabel: {
    color: '#000',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1,
  },
  buyCost: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
  },
  disabledText: {
    color: '#555',
  },
  autoBtn: {
    backgroundColor: '#1e1e3a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#333',
  },
  autoActive: {
    borderColor: '#4ade80',
    backgroundColor: '#0f2a1a',
  },
  autoLabel: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
  },
});
