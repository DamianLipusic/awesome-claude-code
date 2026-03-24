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
import { GEM_PACKS, GEM_SHOP_ITEMS, SEASON_TIERS, MAX_SEASON_LEVEL, SEASON_NAME } from '../data/seasonPass';
import { GLOBAL_UPGRADES } from '../data/upgrades';
import { formatMoney } from '../utils/formatMoney';

type Tab = 'gems' | 'season' | 'upgrades';

export function StoreScreen() {
  const {
    money,
    gems,
    seasonXp,
    seasonPassPurchased,
    seasonPassClaimedTiers,
    purchasedUpgrades,
    purchaseGemPack,
    purchaseSeasonPass,
    spendGems,
    purchaseUpgrade,
  } = useGameStore();

  const [tab, setTab] = useState<Tab>('gems');

  const currentLevel = SEASON_TIERS.findLastIndex(t => seasonXp >= t.xpRequired) + 1;
  const nextTier = SEASON_TIERS[currentLevel];
  const xpProgress = nextTier ? (seasonXp - SEASON_TIERS[currentLevel - 1]?.xpRequired || 0) : seasonXp;
  const xpNeeded = nextTier ? nextTier.xpRequired - (SEASON_TIERS[currentLevel - 1]?.xpRequired || 0) : 1;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🏪 Store</Text>

        {/* Gem Balance */}
        <View style={styles.gemBalance}>
          <Text style={styles.gemCount}>💎 {gems} Gems</Text>
          <Text style={styles.gemSub}>Use gems for boosts, skips & perks</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(['gems', 'season', 'upgrades'] as Tab[]).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.activeTab]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.activeTabText]}>
                {t === 'gems' ? '💎 Gems' : t === 'season' ? '🏆 Pass' : '⚡ Power-Ups'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* GEM SHOP */}
        {tab === 'gems' && (
          <>
            <Text style={styles.sectionTitle}>Buy Gems</Text>
            <Text style={styles.sectionSub}>Used to buy boosts, skip cooldowns, and power-ups</Text>
            {GEM_PACKS.map(pack => (
              <TouchableOpacity
                key={pack.id}
                style={styles.gemPack}
                onPress={() => {
                  Alert.alert(
                    `Buy ${pack.label}`,
                    `This would cost $${pack.price} via App Store IAP.\n\nFor demo: gems granted free.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Confirm', onPress: () => {
                        purchaseGemPack(pack.id);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }},
                    ]
                  );
                }}
              >
                <Text style={styles.packEmoji}>{pack.emoji}</Text>
                <View style={styles.packInfo}>
                  <Text style={styles.packLabel}>{pack.label}</Text>
                  {pack.bonus ? <Text style={styles.packBonus}>{pack.bonus}</Text> : null}
                </View>
                <View style={styles.packPrice}>
                  <Text style={styles.packPriceText}>${pack.price}</Text>
                </View>
              </TouchableOpacity>
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Gem Shop</Text>
            {GEM_SHOP_ITEMS.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.gemItem, gems < item.cost && styles.dimmed]}
                onPress={() => {
                  if (gems >= item.cost) {
                    Alert.alert(
                      item.name,
                      `Spend ${item.cost} gems on: ${item.description}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Buy', onPress: () => {
                          spendGems(item.cost, item.id);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }},
                      ]
                    );
                  }
                }}
              >
                <Text style={styles.itemEmoji}>{item.emoji}</Text>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemDesc}>{item.description}</Text>
                </View>
                <View style={[styles.itemCost, gems < item.cost && styles.cantAfford]}>
                  <Text style={styles.itemCostText}>💎 {item.cost}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* SEASON PASS */}
        {tab === 'season' && (
          <>
            <View style={styles.seasonHeader}>
              <Text style={styles.seasonName}>{SEASON_NAME}</Text>
              <Text style={styles.seasonLevel}>Level {currentLevel} / {MAX_SEASON_LEVEL}</Text>
              <View style={styles.xpBar}>
                <View style={[styles.xpFill, { width: `${Math.min(100, (xpProgress / xpNeeded) * 100)}%` }]} />
              </View>
              <Text style={styles.xpText}>{seasonXp} XP total · Earn XP from missions</Text>
            </View>

            {!seasonPassPurchased && (
              <TouchableOpacity
                style={styles.buyPassBtn}
                onPress={() => Alert.alert(
                  'Buy Season Pass',
                  'Get PREMIUM rewards on all 30 tiers! $4.99 via App Store.\n\nFor demo: granted free.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Buy', onPress: () => {
                      purchaseSeasonPass();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }},
                  ]
                )}
              >
                <Text style={styles.buyPassTitle}>🏆 GET SEASON PASS</Text>
                <Text style={styles.buyPassSub}>$4.99 · Unlock all Premium Rewards</Text>
              </TouchableOpacity>
            )}

            {seasonPassPurchased && (
              <View style={styles.passOwnedBadge}>
                <Text style={styles.passOwnedText}>✓ SEASON PASS ACTIVE</Text>
              </View>
            )}

            {SEASON_TIERS.slice(0, Math.min(currentLevel + 3, MAX_SEASON_LEVEL)).map(tier => {
              const isUnlocked = currentLevel >= tier.level;
              const freeClaimed = seasonPassClaimedTiers.includes(tier.level);
              const premClaimed = seasonPassClaimedTiers.includes(-tier.level);

              return (
                <View key={tier.level} style={[styles.tierRow, !isUnlocked && styles.lockedTier]}>
                  <Text style={styles.tierLevel}>Lv.{tier.level}</Text>
                  <View style={styles.tierRewardBox}>
                    <Text style={styles.tierRewardLabel}>FREE</Text>
                    <Text style={styles.tierRewardText}>{tier.freeReward.label}</Text>
                    {isUnlocked && !freeClaimed && tier.freeReward.type !== 'none' && (
                      <TouchableOpacity style={styles.claimTierBtn}
                        onPress={() => { /* simplified claim */ Haptics.impactAsync(); }}>
                        <Text style={styles.claimTierText}>Claim</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={[styles.tierRewardBox, styles.premiumBox, !seasonPassPurchased && styles.lockedPremium]}>
                    <Text style={styles.premiumLabel}>PREMIUM</Text>
                    <Text style={styles.tierRewardText}>{tier.premiumReward.label}</Text>
                    {isUnlocked && seasonPassPurchased && !premClaimed && (
                      <TouchableOpacity style={[styles.claimTierBtn, styles.premiumClaimBtn]}
                        onPress={() => { Haptics.impactAsync(); }}>
                        <Text style={styles.claimTierText}>Claim</Text>
                      </TouchableOpacity>
                    )}
                    {!seasonPassPurchased && <Text style={styles.lockIcon}>🔒</Text>}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {/* GLOBAL UPGRADES */}
        {tab === 'upgrades' && (
          <>
            <Text style={styles.sectionTitle}>Permanent Upgrades</Text>
            <Text style={styles.sectionSub}>Buy once, keep forever across this prestige run</Text>
            {GLOBAL_UPGRADES.map(upg => {
              const owned = purchasedUpgrades.includes(upg.id);
              const canAfford = money >= upg.cost;
              return (
                <TouchableOpacity
                  key={upg.id}
                  style={[styles.upgCard, owned && styles.upgOwned, !canAfford && !owned && styles.upgCantAfford]}
                  onPress={() => {
                    if (!owned && canAfford) {
                      Alert.alert(upg.name, `Buy for ${formatMoney(upg.cost)}?\n${upg.description}`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Buy', onPress: () => {
                          purchaseUpgrade(upg.id);
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }},
                      ]);
                    }
                  }}
                >
                  <Text style={styles.upgEmoji}>{upg.emoji}</Text>
                  <View style={styles.upgInfo}>
                    <Text style={styles.upgName}>{upg.name}</Text>
                    <Text style={styles.upgDesc}>{upg.description}</Text>
                  </View>
                  {owned ? (
                    <Text style={styles.ownedBadge}>✓ OWNED</Text>
                  ) : (
                    <Text style={[styles.upgCost, !canAfford && styles.cantAffordText]}>
                      {formatMoney(upg.cost)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', paddingVertical: 18 },

  gemBalance: {
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38bdf8',
    marginBottom: 16,
  },
  gemCount: { color: '#38bdf8', fontSize: 22, fontWeight: '900' },
  gemSub: { color: '#888', fontSize: 12, marginTop: 4 },

  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: {
    flex: 1,
    backgroundColor: '#12122a',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  activeTab: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  tabText: { color: '#888', fontSize: 11, fontWeight: '700' },
  activeTabText: { color: '#000' },

  sectionTitle: { color: '#fff', fontWeight: '800', fontSize: 17, marginBottom: 4 },
  sectionSub: { color: '#555', fontSize: 12, marginBottom: 14, fontStyle: 'italic' },

  gemPack: {
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
  packEmoji: { fontSize: 28 },
  packInfo: { flex: 1 },
  packLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  packBonus: { color: '#4ade80', fontSize: 12, marginTop: 2, fontWeight: '600' },
  packPrice: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  packPriceText: { color: '#000', fontWeight: '900', fontSize: 14 },

  gemItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1a2a3a',
    gap: 12,
  },
  dimmed: { opacity: 0.5 },
  itemEmoji: { fontSize: 28 },
  itemInfo: { flex: 1 },
  itemName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  itemDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  itemCost: {
    backgroundColor: '#0a1a2a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  cantAfford: { borderColor: '#333' },
  itemCostText: { color: '#38bdf8', fontWeight: '700', fontSize: 13 },

  // Season Pass
  seasonHeader: {
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  seasonName: { color: '#FFD700', fontWeight: '900', fontSize: 18 },
  seasonLevel: { color: '#aaa', fontSize: 13, marginTop: 4, marginBottom: 10 },
  xpBar: {
    height: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpFill: { height: '100%', backgroundColor: '#a855f7', borderRadius: 4 },
  xpText: { color: '#666', fontSize: 11 },

  buyPassBtn: {
    backgroundColor: '#a855f7',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  buyPassTitle: { color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 0.5 },
  buyPassSub: { color: '#ffffff88', fontSize: 12, marginTop: 4 },
  passOwnedBadge: {
    backgroundColor: '#0f2a0f',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4ade80',
    marginBottom: 14,
  },
  passOwnedText: { color: '#4ade80', fontWeight: '800', fontSize: 14 },

  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#12122a',
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#1a1a2a',
  },
  lockedTier: { opacity: 0.4 },
  tierLevel: { color: '#FFD700', fontWeight: '800', fontSize: 13, width: 40 },
  tierRewardBox: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    borderRadius: 8,
    padding: 8,
  },
  premiumBox: { borderWidth: 1, borderColor: '#a855f7' },
  lockedPremium: { opacity: 0.5 },
  tierRewardLabel: { color: '#666', fontSize: 9, letterSpacing: 1 },
  premiumLabel: { color: '#a855f7', fontSize: 9, letterSpacing: 1 },
  tierRewardText: { color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 2 },
  claimTierBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  premiumClaimBtn: { backgroundColor: '#a855f7' },
  claimTierText: { color: '#000', fontWeight: '700', fontSize: 10 },
  lockIcon: { fontSize: 14, marginTop: 4 },

  // Upgrades
  upgCard: {
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
  upgOwned: { borderColor: '#4ade80', backgroundColor: '#0a1a0a' },
  upgCantAfford: { opacity: 0.5 },
  upgEmoji: { fontSize: 28 },
  upgInfo: { flex: 1 },
  upgName: { color: '#fff', fontWeight: '700', fontSize: 14 },
  upgDesc: { color: '#888', fontSize: 12, marginTop: 2 },
  upgCost: { color: '#FFD700', fontWeight: '700', fontSize: 14 },
  cantAffordText: { color: '#555' },
  ownedBadge: { color: '#4ade80', fontWeight: '800', fontSize: 12 },
});
