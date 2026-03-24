import React, { useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { HUSTLES, RISK_COLORS, RISK_LABELS } from '../data/hustles';
import { formatMoney, formatDuration } from '../utils/formatMoney';
import { HustleResult } from '../store/types';

export function HustleScreen() {
  const { money, totalEarned, hustleCooldowns, attemptHustle } = useGameStore();
  const [lastResult, setLastResult] = useState<HustleResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleHustle = (id: string) => {
    const result = attemptHustle(id);
    setLastResult(result);
    setShowResult(true);

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    setTimeout(() => setShowResult(false), 3000);
  };

  const now = Date.now();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🕵️ Hustle</Text>
        <Text style={styles.subtitle}>High risk. Higher reward. No questions asked.</Text>

        {/* Result Toast */}
        {showResult && lastResult && (
          <View style={[styles.resultToast, lastResult.success ? styles.successToast : styles.failToast]}>
            <Text style={styles.resultEmoji}>{lastResult.success ? '💰' : '💀'}</Text>
            <View>
              <Text style={styles.resultTitle}>
                {lastResult.success ? 'PAID OUT!' : 'BUSTED!'}
              </Text>
              <Text style={styles.resultAmount}>
                {lastResult.success ? '+' : '-'}{formatMoney(Math.abs(lastResult.reward))}
              </Text>
            </View>
          </View>
        )}

        {HUSTLES.map(hustle => {
          const cooldownExpiry = hustleCooldowns[hustle.id] || 0;
          const onCooldown = now < cooldownExpiry;
          const cooldownLeft = Math.max(0, cooldownExpiry - now);
          const isUnlocked = totalEarned >= hustle.unlockAt || hustle.unlockAt === 0;

          if (!isUnlocked) {
            return (
              <View key={hustle.id} style={[styles.card, styles.lockedCard]}>
                <Text style={styles.lockEmoji}>🔒</Text>
                <Text style={styles.lockedText}>
                  Earn {formatMoney(hustle.unlockAt)} to unlock {hustle.name}
                </Text>
              </View>
            );
          }

          return (
            <View key={hustle.id} style={[styles.card, onCooldown && styles.cooldownCard]}>
              <View style={styles.cardHeader}>
                <Text style={styles.hustleEmoji}>{hustle.emoji}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.hustleName}>{hustle.name}</Text>
                  <Text style={styles.hustleDesc}>{hustle.description}</Text>
                </View>
                <View style={[styles.riskBadge, { backgroundColor: RISK_COLORS[hustle.risk] + '22', borderColor: RISK_COLORS[hustle.risk] }]}>
                  <Text style={[styles.riskLabel, { color: RISK_COLORS[hustle.risk] }]}>
                    {RISK_LABELS[hustle.risk]}
                  </Text>
                </View>
              </View>

              <View style={styles.cardStats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>SUCCESS</Text>
                  <Text style={styles.statValue}>{Math.round(hustle.successChance * 100)}%</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>REWARD</Text>
                  <Text style={[styles.statValue, styles.green]}>
                    {formatMoney(hustle.minReward)}–{formatMoney(hustle.maxReward)}
                  </Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>PENALTY</Text>
                  <Text style={[styles.statValue, styles.red]}>-{formatMoney(hustle.failPenalty)}</Text>
                </View>
              </View>

              {onCooldown ? (
                <View style={styles.cooldownBar}>
                  <Text style={styles.cooldownText}>⏳ Cooldown: {formatDuration(cooldownLeft)}</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.goBtn, { backgroundColor: RISK_COLORS[hustle.risk] }]}
                  onPress={() => handleHustle(hustle.id)}
                >
                  <Text style={styles.goBtnText}>LET'S GO →</Text>
                </TouchableOpacity>
              )}
            </View>
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
  title: { fontSize: 24, fontWeight: '900', color: '#fff', paddingTop: 18, paddingBottom: 4 },
  subtitle: { color: '#555', fontSize: 13, marginBottom: 16, fontStyle: 'italic' },

  resultToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  successToast: { backgroundColor: '#0a1a0f', borderColor: '#4ade80' },
  failToast: { backgroundColor: '#1a0a0a', borderColor: '#f87171' },
  resultEmoji: { fontSize: 32 },
  resultTitle: { color: '#fff', fontWeight: '900', fontSize: 16 },
  resultAmount: { color: '#FFD700', fontWeight: '700', fontSize: 14 },

  card: {
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cooldownCard: { opacity: 0.7 },
  lockedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    opacity: 0.4,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  lockEmoji: { fontSize: 20 },
  lockedText: { color: '#666', fontSize: 12 },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  hustleEmoji: { fontSize: 32 },
  cardInfo: { flex: 1 },
  hustleName: { color: '#fff', fontWeight: '800', fontSize: 15 },
  hustleDesc: { color: '#888', fontSize: 12, marginTop: 3 },
  riskBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  cardStats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
  },
  statLabel: { color: '#555', fontSize: 9, letterSpacing: 1 },
  statValue: { color: '#fff', fontWeight: '700', fontSize: 13, marginTop: 2 },
  green: { color: '#4ade80' },
  red: { color: '#f87171' },

  goBtn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  goBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  cooldownBar: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cooldownText: { color: '#888', fontWeight: '600', fontSize: 13 },
});
