import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { PRESTIGE_TIERS, PRESTIGE_UPGRADES } from '../data/prestige';
import { formatMoney } from '../utils/formatMoney';
import { canPrestige, getPrestigeMultiplier } from '../utils/gameLogic';

export function PrestigeScreen() {
  const {
    money,
    totalEarned,
    lifetimeEarned,
    prestigeLevel,
    prestigeMultiplier,
    prestigeCoins,
    prestige,
  } = useGameStore();

  const nextTier = PRESTIGE_TIERS.find(t => t.level === prestigeLevel + 1);
  const isReady = canPrestige(totalEarned);
  const nextMultiplier = getPrestigeMultiplier(prestigeLevel + 1);

  const handlePrestige = () => {
    Alert.alert(
      '♻️ Prestige Reset',
      `Reset everything for a permanent ${nextMultiplier}× income multiplier?\n\nYour businesses, money and items will be lost — but you'll be much stronger.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'GO PRESTIGE!',
          style: 'destructive',
          onPress: () => {
            prestige();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>♻️ Prestige</Text>

        {/* Current Status */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Current Prestige</Text>
          <Text style={styles.statusValue}>
            {prestigeLevel === 0 ? 'None' : `×${prestigeMultiplier} Multiplier`}
          </Text>
          <Text style={styles.statusSub}>Level {prestigeLevel}</Text>
        </View>

        {/* Progress */}
        <View style={styles.progressCard}>
          <Text style={styles.progressTitle}>Next Prestige Requirement</Text>
          {nextTier ? (
            <>
              <Text style={styles.progressGoal}>
                Earn {formatMoney(nextTier.requiredTotalEarned)} this run
              </Text>
              <Text style={styles.progressCurrent}>
                Current: {formatMoney(totalEarned)}
              </Text>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, (totalEarned / nextTier.requiredTotalEarned) * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressReward}>
                Reward: ×{nextTier.multiplierBonus} income multiplier forever
              </Text>
            </>
          ) : (
            <Text style={styles.progressGoal}>Max prestige reached! 🏆</Text>
          )}
        </View>

        {/* Prestige Button */}
        {isReady && (
          <TouchableOpacity style={styles.prestigeBtn} onPress={handlePrestige}>
            <Text style={styles.prestigeBtnTitle}>⚡ PRESTIGE NOW</Text>
            <Text style={styles.prestigeBtnSub}>
              Get ×{nextMultiplier} permanent income boost
            </Text>
          </TouchableOpacity>
        )}

        {!isReady && (
          <View style={styles.notReadyBox}>
            <Text style={styles.notReadyText}>
              Earn {formatMoney(1_000_000_000)} this run to unlock prestige
            </Text>
            <Text style={styles.notReadyProgress}>
              Progress: {formatMoney(totalEarned)} / {formatMoney(1_000_000_000)}
            </Text>
          </View>
        )}

        {/* Prestige Coins */}
        <View style={styles.coinsCard}>
          <Text style={styles.coinsTitle}>🪙 Prestige Coins: {prestigeCoins}</Text>
          <Text style={styles.coinsSub}>Earned from prestiging. Use for permanent upgrades.</Text>
        </View>

        {/* Prestige Upgrades */}
        <Text style={styles.upgradesTitle}>Permanent Upgrades</Text>
        {PRESTIGE_UPGRADES.map(upg => (
          <View key={upg.id} style={styles.upgradeCard}>
            <Text style={styles.upgradeEmoji}>{upg.emoji}</Text>
            <View style={styles.upgradeInfo}>
              <Text style={styles.upgradeName}>{upg.name}</Text>
              <Text style={styles.upgradeDesc}>{upg.description}</Text>
            </View>
            <View style={styles.upgradeCost}>
              <Text style={styles.upgradeCostText}>🪙 {upg.cost}</Text>
            </View>
          </View>
        ))}

        {/* Lifetime Stats */}
        <View style={styles.lifetimeCard}>
          <Text style={styles.lifetimeTitle}>📊 Lifetime Stats</Text>
          <Text style={styles.lifetimeStat}>Total Earned: {formatMoney(lifetimeEarned)}</Text>
          <Text style={styles.lifetimeStat}>Times Prestiged: {prestigeLevel}</Text>
          <Text style={styles.lifetimeStat}>Prestige Coins: {prestigeCoins}</Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', paddingVertical: 18 },

  statusCard: {
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 14,
  },
  statusLabel: { color: '#888', fontSize: 13 },
  statusValue: { color: '#FFD700', fontSize: 26, fontWeight: '900', marginTop: 4 },
  statusSub: { color: '#555', fontSize: 12, marginTop: 2 },

  progressCard: {
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  progressTitle: { color: '#aaa', fontSize: 13, marginBottom: 10 },
  progressGoal: { color: '#fff', fontWeight: '700', fontSize: 16 },
  progressCurrent: { color: '#888', fontSize: 13, marginTop: 4 },
  progressBarBg: {
    height: 6,
    backgroundColor: '#2a2a4a',
    borderRadius: 3,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 3,
  },
  progressReward: { color: '#4ade80', fontSize: 13, marginTop: 8, fontWeight: '600' },

  prestigeBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  prestigeBtnTitle: { color: '#000', fontWeight: '900', fontSize: 20, letterSpacing: 1 },
  prestigeBtnSub: { color: '#00000088', fontSize: 13, marginTop: 4 },

  notReadyBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 14,
  },
  notReadyText: { color: '#888', fontSize: 14, textAlign: 'center' },
  notReadyProgress: { color: '#555', fontSize: 12, marginTop: 6 },

  coinsCard: {
    backgroundColor: '#1a150a',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4a3a00',
    marginBottom: 20,
  },
  coinsTitle: { color: '#FFD700', fontWeight: '700', fontSize: 16 },
  coinsSub: { color: '#888', fontSize: 12, marginTop: 4 },

  upgradesTitle: { color: '#fff', fontWeight: '700', fontSize: 17, marginBottom: 10 },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    gap: 12,
  },
  upgradeEmoji: { fontSize: 28 },
  upgradeInfo: { flex: 1 },
  upgradeName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  upgradeDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  upgradeCost: {
    backgroundColor: '#2a2a0a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  upgradeCostText: { color: '#FFD700', fontWeight: '700', fontSize: 13 },

  lifetimeCard: {
    backgroundColor: '#0f0f1a',
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1a1a2a',
  },
  lifetimeTitle: { color: '#aaa', fontWeight: '700', fontSize: 14, marginBottom: 8 },
  lifetimeStat: { color: '#666', fontSize: 13, paddingVertical: 3 },
});
