import React, { useState } from 'react';
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { BusinessCard } from '../components/BusinessCard';
import { BUSINESSES } from '../data/businesses';
import { BUSINESS_UPGRADES } from '../data/upgrades';
import { formatMoney, formatPerSecond } from '../utils/formatMoney';
import { getTotalIncomePerSecond } from '../utils/gameLogic';

type SubTab = 'businesses' | 'upgrades';

export function BusinessScreen() {
  const {
    money, totalEarned, businesses, ownedItems, prestigeMultiplier,
    boostActive, boostExpiry, boostMultiplier, isPremium, purchasedUpgrades,
    buyBusiness, toggleAutoManage, purchaseUpgrade, activeEvent,
  } = useGameStore();

  const [subTab, setSubTab] = useState<SubTab>('businesses');

  const eventActive = activeEvent && Date.now() < activeEvent.endTime;
  const ips = getTotalIncomePerSecond(businesses, ownedItems, prestigeMultiplier, boostActive && Date.now() < boostExpiry ? boostMultiplier : 1, isPremium);
  const totalOwned = businesses.filter(b => b.level > 0).length;
  const autoCount = businesses.filter(b => b.autoManaged && b.level > 0).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🏢 Empire</Text>

        {/* Sub tabs */}
        <View style={styles.subTabs}>
          <TouchableOpacity
            style={[styles.subTab, subTab === 'businesses' && styles.activeSubTab]}
            onPress={() => setSubTab('businesses')}
          >
            <Text style={[styles.subTabText, subTab === 'businesses' && styles.activeSubTabText]}>Businesses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subTab, subTab === 'upgrades' && styles.activeSubTab]}
            onPress={() => setSubTab('upgrades')}
          >
            <Text style={[styles.subTabText, subTab === 'upgrades' && styles.activeSubTabText]}>Upgrades</Text>
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.sumVal}>{totalOwned}</Text>
            <Text style={styles.sumLbl}>Owned</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.sumVal}>{formatPerSecond(ips)}</Text>
            <Text style={styles.sumLbl}>Total/sec</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.sumVal}>{autoCount}/{totalOwned}</Text>
            <Text style={styles.sumLbl}>Auto-Managed</Text>
          </View>
        </View>

        {eventActive && (
          <View style={styles.saleBanner}>
            <Text style={styles.saleText}>🛒 EVENT: All businesses 50% OFF!</Text>
          </View>
        )}

        {/* Business List */}
        {subTab === 'businesses' && BUSINESSES.map(def => {
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

        {/* Upgrades List */}
        {subTab === 'upgrades' && (
          <>
            <Text style={styles.upgradeHint}>
              💡 Upgrades multiply a specific business's income permanently
            </Text>
            {BUSINESS_UPGRADES.map(upg => {
              const biz = businesses.find(b => b.id === upg.businessId);
              const bizDef = BUSINESSES.find(b => b.id === upg.businessId);
              const owned = purchasedUpgrades.includes(upg.id);
              const meetsRequirement = (biz?.level || 0) >= upg.requires;
              const canAfford = money >= upg.cost;

              if (!meetsRequirement && !owned) {
                return (
                  <View key={upg.id} style={[styles.upgCard, styles.lockedUpg]}>
                    <Text style={styles.upgEmoji}>{bizDef?.emoji} 🔒</Text>
                    <View style={styles.upgInfo}>
                      <Text style={styles.upgName}>{upg.name}</Text>
                      <Text style={styles.upgDesc}>Requires {bizDef?.name} Lv.{upg.requires}</Text>
                    </View>
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={upg.id}
                  style={[styles.upgCard, owned && styles.upgOwned, !canAfford && !owned && styles.upgCantAfford]}
                  onPress={() => {
                    if (!owned && canAfford) {
                      Alert.alert(
                        upg.name,
                        `${upg.description}\nCost: ${formatMoney(upg.cost)}`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Buy', onPress: () => {
                            purchaseUpgrade(upg.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          }},
                        ]
                      );
                    }
                  }}
                >
                  <Text style={styles.upgEmoji}>{upg.emoji}</Text>
                  <View style={styles.upgInfo}>
                    <Text style={styles.upgName}>{bizDef?.emoji} {upg.name}</Text>
                    <Text style={styles.upgDesc}>{upg.description}</Text>
                  </View>
                  {owned ? (
                    <Text style={styles.ownedText}>✓</Text>
                  ) : (
                    <Text style={[styles.upgCost, !canAfford && styles.cantAffordCost]}>
                      {formatMoney(upg.cost)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', paddingVertical: 18 },

  subTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  subTab: {
    flex: 1,
    backgroundColor: '#12122a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  activeSubTab: { backgroundColor: '#1a1a3a', borderColor: '#FFD700' },
  subTabText: { color: '#666', fontSize: 13, fontWeight: '700' },
  activeSubTabText: { color: '#FFD700' },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  sumVal: { color: '#FFD700', fontWeight: '800', fontSize: 15 },
  sumLbl: { color: '#666', fontSize: 10, marginTop: 2 },

  saleBanner: {
    backgroundColor: '#1a0f00',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f97316',
    alignItems: 'center',
  },
  saleText: { color: '#f97316', fontWeight: '700', fontSize: 13 },

  upgradeHint: { color: '#555', fontSize: 12, textAlign: 'center', marginBottom: 12, fontStyle: 'italic' },

  upgCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    gap: 10,
  },
  upgOwned: { borderColor: '#4ade80', backgroundColor: '#0a1a0a' },
  upgCantAfford: { opacity: 0.5 },
  lockedUpg: { opacity: 0.35 },
  upgEmoji: { fontSize: 24 },
  upgInfo: { flex: 1 },
  upgName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  upgDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  upgCost: { color: '#FFD700', fontWeight: '700', fontSize: 13 },
  cantAffordCost: { color: '#555' },
  ownedText: { color: '#4ade80', fontWeight: '900', fontSize: 18 },
});
