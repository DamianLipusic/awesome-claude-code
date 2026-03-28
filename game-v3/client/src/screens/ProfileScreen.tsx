import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { formatCurrency, formatCurrencyCompact } from '../components/ui/CurrencyText';
import { LoadingScreen } from '../components/ui/LoadingScreen';

// ─── Types ─────────────────────────────────────────

interface UnlockedAchievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  xp_reward: number;
  unlocked_at: string;
}

interface AllAchievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  xpReward: number;
}

interface PlayerProfile {
  id: string;
  username: string;
  cash: number;
  bank_balance: number;
  xp: number;
  level: number;
  season_id: string | null;
  created_at: string;
}

interface MyRank {
  rank: number;
  net_worth: number;
  total_players?: number;
}

// ─── Helpers ───────────────────────────────────────

const RANK_TITLES: Record<number, string> = {
  1: 'Street Hustler',
  2: 'Corner Dealer',
  3: 'Shop Owner',
  4: 'Business Mogul',
  5: 'Industry Baron',
  6: 'Trade Tycoon',
  7: 'Market King',
  8: 'Empire Lord',
  9: 'Economic Titan',
  10: 'Legendary Magnate',
};

function getRankTitle(level: number): string {
  if (level >= 10) return RANK_TITLES[10];
  return RANK_TITLES[level] ?? `Level ${level}`;
}

// XP required for each level (simple formula: level * 1000)
function xpForLevel(level: number): number {
  return level * 1000;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Component ─────────────────────────────────────

export function ProfileScreen() {
  const logout = useAuthStore((s) => s.logout);

  const {
    data: player,
    isLoading: playerLoading,
    refetch: refetchPlayer,
    isRefetching: playerRefetching,
  } = useQuery<PlayerProfile>({
    queryKey: ['profileMe'],
    queryFn: () => api.get<PlayerProfile>('/auth/me'),
    refetchInterval: 30000,
  });

  const {
    data: dashboardData,
    refetch: refetchDashboard,
    isRefetching: dashboardRefetching,
  } = useQuery<{ player: { rep_street: number; rep_business: number; rep_underworld: number } }>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard'),
    refetchInterval: 30000,
  });

  const {
    data: myRank,
    refetch: refetchRank,
    isRefetching: rankRefetching,
  } = useQuery<MyRank>({
    queryKey: ['leaderboardMe'],
    queryFn: () => api.get<MyRank>('/leaderboard/me'),
    refetchInterval: 30000,
  });

  const {
    data: myAchievements,
    refetch: refetchMyAchievements,
    isRefetching: myAchRefetching,
  } = useQuery<{ data: UnlockedAchievement[] }>({
    queryKey: ['achievementsMe'],
    queryFn: () => api.get<{ data: UnlockedAchievement[] }>('/achievements/me'),
    refetchInterval: 30000,
  });

  const {
    data: allAchievements,
    refetch: refetchAllAchievements,
    isRefetching: allAchRefetching,
  } = useQuery<{ data: AllAchievement[] }>({
    queryKey: ['achievementsAll'],
    queryFn: () => api.get<{ data: AllAchievement[] }>('/achievements/all'),
    refetchInterval: 60000,
  });

  const isRefetching = playerRefetching || rankRefetching || myAchRefetching || allAchRefetching || dashboardRefetching;

  const refetchAll = () => {
    refetchPlayer();
    refetchRank();
    refetchMyAchievements();
    refetchAllAchievements();
    refetchDashboard();
  };

  if (playerLoading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  if (!player) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Failed to load profile</Text>
      </View>
    );
  }

  const xpNeeded = xpForLevel(player.level + 1);
  const xpProgress = xpNeeded > 0 ? Math.min(1, player.xp / xpNeeded) : 1;
  const rankTitle = getRankTitle(player.level);
  const netWorth = myRank?.net_worth ?? player.cash + player.bank_balance;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchAll}
            tintColor="#22c55e"
            colors={['#22c55e']}
          />
        }
      >
        <Text style={styles.title}>Profile</Text>

        {/* Player Identity Card */}
        <Card style={styles.identityCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {player.username.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.identityInfo}>
              <Text style={styles.username}>{player.username}</Text>
              <View style={styles.badgeRow}>
                <Badge label={`Lv.${player.level}`} variant="purple" size="md" />
                <Badge label={rankTitle} variant="blue" size="md" />
              </View>
            </View>
          </View>

          {/* XP Bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpLabelRow}>
              <Text style={styles.xpLabel}>Experience</Text>
              <Text style={styles.xpValue}>
                {player.xp.toLocaleString()} / {xpNeeded.toLocaleString()} XP
              </Text>
            </View>
            <ProgressBar progress={xpProgress} color="#a855f7" height={8} />
          </View>
        </Card>

        {/* Financials Card */}
        <Card style={styles.financeCard}>
          <Text style={styles.cardTitle}>Finances</Text>

          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Net Worth</Text>
            <Text style={styles.financeValueGreen}>
              {formatCurrency(netWorth)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Cash</Text>
            <Text style={styles.financeValue}>
              {formatCurrency(player.cash)}
            </Text>
          </View>

          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Bank Balance</Text>
            <Text style={styles.financeValue}>
              {formatCurrency(player.bank_balance)}
            </Text>
          </View>
        </Card>

        {/* Reputation Card */}
        {dashboardData && (
          dashboardData.player.rep_street !== 50 ||
          dashboardData.player.rep_business !== 50 ||
          dashboardData.player.rep_underworld !== 50
        ) && (
          <Card style={styles.reputationCard}>
            <Text style={styles.cardTitle}>Reputation</Text>
            <View style={styles.repRow}>
              <Text style={styles.repLabel}>{'\uD83D\uDCCD'} Street</Text>
              <View style={styles.repBarWrap}>
                <ProgressBar progress={dashboardData.player.rep_street / 100} color="#3b82f6" height={8} />
              </View>
              <Text style={[styles.repValue, { color: '#3b82f6' }]}>{dashboardData.player.rep_street}</Text>
            </View>
            <View style={styles.repRow}>
              <Text style={styles.repLabel}>{'\uD83D\uDCBC'} Business</Text>
              <View style={styles.repBarWrap}>
                <ProgressBar progress={dashboardData.player.rep_business / 100} color="#22c55e" height={8} />
              </View>
              <Text style={[styles.repValue, { color: '#22c55e' }]}>{dashboardData.player.rep_business}</Text>
            </View>
            <View style={styles.repRow}>
              <Text style={styles.repLabel}>{'\uD83D\uDD2E'} Underworld</Text>
              <View style={styles.repBarWrap}>
                <ProgressBar progress={dashboardData.player.rep_underworld / 100} color="#a855f7" height={8} />
              </View>
              <Text style={[styles.repValue, { color: '#a855f7' }]}>{dashboardData.player.rep_underworld}</Text>
            </View>
          </Card>
        )}

        {/* Rank Card */}
        {myRank && (
          <Card style={styles.rankCard}>
            <Text style={styles.cardTitle}>Ranking</Text>
            <View style={styles.rankRow}>
              <View style={styles.rankPosition}>
                <Text style={styles.rankHash}>#</Text>
                <Text style={styles.rankNumber}>{myRank.rank}</Text>
              </View>
              {myRank.total_players && (
                <Text style={styles.rankTotal}>
                  of {myRank.total_players} players
                </Text>
              )}
            </View>
            <Text style={styles.rankWorth}>
              Net Worth: {formatCurrency(myRank.net_worth)}
            </Text>
          </Card>
        )}

        {/* Achievements */}
        {allAchievements?.data && allAchievements.data.length > 0 && (() => {
          const unlockedKeys = new Set((myAchievements?.data ?? []).map((a) => a.key));
          const unlockedMap = new Map((myAchievements?.data ?? []).map((a) => [a.key, a]));
          const unlockedCount = unlockedKeys.size;
          const totalCount = allAchievements.data.length;

          return (
            <Card style={styles.achievementsCard}>
              <View style={styles.achievementsHeader}>
                <Text style={styles.cardTitle}>Achievements</Text>
                <Text style={styles.achievementsCount}>
                  {unlockedCount} / {totalCount} Unlocked
                </Text>
              </View>
              {allAchievements.data.map((ach) => {
                const unlocked = unlockedKeys.has(ach.key);
                const unlockedData = unlockedMap.get(ach.key);
                return (
                  <View
                    key={ach.key}
                    style={[
                      styles.achievementRow,
                      unlocked ? styles.achievementUnlocked : styles.achievementLocked,
                    ]}
                  >
                    <Text style={[styles.achievementIcon, !unlocked && styles.achievementIconLocked]}>
                      {ach.icon}
                    </Text>
                    <View style={styles.achievementInfo}>
                      <Text style={[styles.achievementTitle, !unlocked && styles.achievementTitleLocked]}>
                        {ach.title}
                      </Text>
                      {unlocked && (
                        <Text style={styles.achievementDescription}>{ach.description}</Text>
                      )}
                    </View>
                    {unlocked ? (
                      <Text style={styles.achievementXp}>+{unlockedData?.xp_reward ?? ach.xpReward} XP</Text>
                    ) : (
                      <Text style={styles.achievementLockedLabel}>Locked</Text>
                    )}
                  </View>
                );
              })}
            </Card>
          );
        })()}

        {/* Member Since */}
        <Card style={styles.memberCard}>
          <View style={styles.memberRow}>
            <Text style={styles.memberLabel}>Member Since</Text>
            <Text style={styles.memberValue}>{formatDate(player.created_at)}</Text>
          </View>
        </Card>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 52,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f9fafb',
    marginBottom: 16,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    paddingTop: 80,
  },

  // Identity card
  identityCard: {
    marginBottom: 16,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#030712',
  },
  identityInfo: {
    flex: 1,
  },
  username: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f9fafb',
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
  },

  // XP section
  xpSection: {
    gap: 6,
  },
  xpLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  xpValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a855f7',
    fontVariant: ['tabular-nums'],
  },

  // Finance card
  financeCard: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  financeLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  financeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
    fontVariant: ['tabular-nums'],
  },
  financeValueGreen: {
    fontSize: 18,
    fontWeight: '800',
    color: '#22c55e',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    backgroundColor: '#1f2937',
    marginVertical: 8,
  },

  // Reputation card
  reputationCard: {
    marginBottom: 16,
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  repLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
    width: 100,
  },
  repBarWrap: {
    flex: 1,
  },
  repValue: {
    fontSize: 13,
    fontWeight: '700',
    width: 30,
    textAlign: 'right',
    fontVariant: ['tabular-nums' as const],
  },

  // Rank card
  rankCard: {
    marginBottom: 16,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  rankPosition: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rankHash: {
    fontSize: 18,
    fontWeight: '700',
    color: '#22c55e',
  },
  rankNumber: {
    fontSize: 36,
    fontWeight: '800',
    color: '#f9fafb',
    fontVariant: ['tabular-nums'],
  },
  rankTotal: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  rankWorth: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600',
  },

  // Member card
  memberCard: {
    marginBottom: 24,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberLabel: {
    fontSize: 14,
    color: '#9ca3af',
    fontWeight: '600',
  },
  memberValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },

  // Achievements card
  achievementsCard: {
    marginBottom: 16,
  },
  achievementsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  achievementsCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },
  achievementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  achievementUnlocked: {
    backgroundColor: '#052e16',
    borderWidth: 1,
    borderColor: '#166534',
  },
  achievementLocked: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    opacity: 0.6,
  },
  achievementIcon: {
    fontSize: 22,
  },
  achievementIconLocked: {
    opacity: 0.4,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f9fafb',
  },
  achievementTitleLocked: {
    color: '#6b7280',
  },
  achievementDescription: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    lineHeight: 15,
  },
  achievementXp: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
  },
  achievementLockedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4b5563',
  },

  // Logout button
  logoutButton: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
