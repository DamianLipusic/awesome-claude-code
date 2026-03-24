import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { MoneyDisplay } from '../components/MoneyDisplay';
import { TapButton } from '../components/TapButton';
import { EventBanner } from '../components/EventBanner';
import { AchievementPopup } from '../components/AchievementPopup';
import { getTotalIncomePerSecond } from '../utils/gameLogic';
import { formatMoney, formatDuration } from '../utils/formatMoney';
import { BUSINESSES } from '../data/businesses';

const TICK_INTERVAL = 100;

export function HomeScreen() {
  const {
    money, totalEarned, lifetimeEarned, tapValue, businesses,
    ownedItems, prestigeMultiplier, prestigeLevel, boostActive, boostMultiplier,
    boostExpiry, isPremium, activeEvent, dailyMissions, gems, unlockedAchievements,
    tap, tick, loadSave, saveGame, triggerRandomEvent,
  } = useGameStore();

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickRef = useRef(Date.now());
  const [offlineEarned, setOfflineEarned] = useState<number | null>(null);

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
    saveRef.current = setInterval(() => saveGame(), 10_000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (saveRef.current) clearInterval(saveRef.current);
    };
  }, []);

  const now = Date.now();
  const boostReallyActive = boostActive && now < boostExpiry;
  const ips = getTotalIncomePerSecond(businesses, ownedItems, prestigeMultiplier, boostReallyActive ? boostMultiplier : 1, isPremium);
  const boostTimeLeft = boostReallyActive ? Math.max(0, boostExpiry - now) : 0;

  const activeBiz = businesses.filter(b => b.level > 0);
  const completedMissions = dailyMissions.filter(m => m.completed && !m.claimed).length;

  return (
    <SafeAreaView style={styles.safe}>
      <AchievementPopup />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>💸 CASH EMPIRE</Text>
            {prestigeLevel > 0 && <Text style={styles.prestigeTag}>Prestige ×{prestigeMultiplier}</Text>}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.gemCount}>💎 {gems}</Text>
            {completedMissions > 0 && (
              <View style={styles.missionBadge}>
                <Text style={styles.missionBadgeText}>{completedMissions}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Event Banner */}
        <EventBanner activeEvent={activeEvent} />

        {/* Money */}
        <MoneyDisplay money={money} incomePerSecond={ips} />

        {/* Boost badge */}
        {boostReallyActive && (
          <View style={styles.boostBadge}>
            <Text style={styles.boostText}>
              ⚡ {boostMultiplier}× BOOST — {formatDuration(boostTimeLeft)} left
            </Text>
          </View>
        )}

        {/* Tap Button */}
        <TapButton onTap={tap} tapValue={tapValue * prestigeMultiplier} />

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{formatMoney(totalEarned)}</Text>
            <Text style={styles.statLbl}>This Run</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{formatMoney(lifetimeEarned)}</Text>
            <Text style={styles.statLbl}>Lifetime</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{activeBiz.length}</Text>
            <Text style={styles.statLbl}>Businesses</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{unlockedAchievements.length}</Text>
            <Text style={styles.statLbl}>Achievements</Text>
          </View>
        </View>

        {/* Active Businesses Preview */}
        {activeBiz.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Active Empire</Text>
            {activeBiz.slice(0, 4).map(b => {
              const def = BUSINESSES.find(d => d.id === b.id)!;
              return (
                <View key={b.id} style={styles.bizRow}>
                  <Text style={styles.bizEmoji}>{def.emoji}</Text>
                  <Text style={styles.bizName}>{def.name}</Text>
                  <Text style={styles.bizLevel}>Lv.{b.level}</Text>
                  <Text style={styles.bizAuto}>{b.autoManaged ? '🤖' : '⏸'}</Text>
                </View>
              );
            })}
            {activeBiz.length > 4 && (
              <Text style={styles.moreBiz}>+{activeBiz.length - 4} more businesses</Text>
            )}
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.hintText}>👆 Tap to earn, then buy businesses!</Text>
            <Text style={styles.hintSub}>Food Cart costs {formatMoney(100)}. Start there.</Text>
          </View>
        )}

        {/* DEBUG: Trigger Event Button (remove in production) */}
        {!activeEvent && (
          <TouchableOpacity style={styles.devBtn} onPress={triggerRandomEvent}>
            <Text style={styles.devBtnText}>🎲 Trigger Random Event (Dev)</Text>
          </TouchableOpacity>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: '900', color: '#FFD700', letterSpacing: 1 },
  prestigeTag: { color: '#FFD700', fontSize: 12, fontWeight: '700', marginTop: 4 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  gemCount: { color: '#38bdf8', fontWeight: '800', fontSize: 16 },
  missionBadge: {
    backgroundColor: '#f97316',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  missionBadgeText: { color: '#fff', fontWeight: '900', fontSize: 11 },

  boostBadge: {
    backgroundColor: '#1a1500',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
    marginBottom: 8,
  },
  boostText: { color: '#FFD700', fontWeight: '700', fontSize: 13 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  statBox: {
    width: '47.5%',
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  statVal: { color: '#FFD700', fontWeight: '800', fontSize: 16 },
  statLbl: { color: '#666', fontSize: 11, marginTop: 2 },

  card: {
    marginTop: 16,
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  cardTitle: { color: '#fff', fontWeight: '700', fontSize: 15, marginBottom: 10 },
  bizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2a',
    gap: 8,
  },
  bizEmoji: { fontSize: 18 },
  bizName: { color: '#ccc', fontSize: 13, flex: 1 },
  bizLevel: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  bizAuto: { fontSize: 16 },
  moreBiz: { color: '#555', fontSize: 12, marginTop: 8, textAlign: 'center' },

  hintText: { color: '#aaa', fontSize: 15, textAlign: 'center', fontWeight: '600' },
  hintSub: { color: '#555', fontSize: 12, textAlign: 'center', marginTop: 6 },

  devBtn: {
    marginTop: 16,
    backgroundColor: '#1a0a1a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  devBtnText: { color: '#555', fontSize: 12 },
});
