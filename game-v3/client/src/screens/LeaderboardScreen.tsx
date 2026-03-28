import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../components/ui/CurrencyText';

// ─── Types ─────────────────────────────────────────

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  level: number;
  rank_title: string;
  net_worth: number;
  business_count: number;
}

interface MyRank {
  rank: number;
  net_worth: number;
}

interface WorldStats {
  total_players: number;
  active_players: number;
  total_businesses: number;
  total_employees: number;
  open_listings: number;
  market_volume_24h: number;
  active_events: number;
}

// ─── Helpers ───────────────────────────────────────

const MEDAL_COLORS: Record<number, string> = {
  1: '#fbbf24', // gold
  2: '#9ca3af', // silver
  3: '#cd7f32', // bronze
};

function getRankDisplay(rank: number): { color: string; label: string } {
  if (rank <= 3) {
    return { color: MEDAL_COLORS[rank], label: `#${rank}` };
  }
  return { color: '#6b7280', label: `#${rank}` };
}

// ─── Component ─────────────────────────────────────

export function LeaderboardScreen() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data: entries,
    isLoading: entriesLoading,
    refetch: refetchEntries,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: () => api.get<LeaderboardEntry[]>('/leaderboard'),
    refetchInterval: 30000,
  });

  const {
    data: myRank,
    refetch: refetchMyRank,
  } = useQuery<MyRank>({
    queryKey: ['leaderboardMe'],
    queryFn: () => api.get<MyRank>('/leaderboard/me'),
    refetchInterval: 30000,
  });

  const {
    data: worldStats,
    refetch: refetchStats,
  } = useQuery<WorldStats>({
    queryKey: ['leaderboardStats'],
    queryFn: () => api.get<WorldStats>('/leaderboard/stats'),
    refetchInterval: 30000,
  });

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchEntries(), refetchMyRank(), refetchStats()]);
    setIsRefreshing(false);
  }, [refetchEntries, refetchMyRank, refetchStats]);

  // ─── Loading ───────────────────────────────────────

  if (entriesLoading) {
    return <LoadingScreen message="Loading leaderboard..." />;
  }

  // ─── Render ────────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#22c55e"
            colors={['#22c55e']}
          />
        }
      >
        {/* Header */}
        <Text style={styles.title}>{'\uD83C\uDFC6'} Leaderboard</Text>

        {/* World Stats Card */}
        {worldStats && (
          <View style={styles.worldStatsCard}>
            <Text style={styles.worldStatsTitle}>World Stats</Text>
            <Text style={styles.worldStatsLine}>
              Players: {worldStats.total_players} ({worldStats.active_players} active)
            </Text>
            <Text style={styles.worldStatsLine}>
              Businesses: {worldStats.total_businesses}  |  Employees: {worldStats.total_employees}
            </Text>
            <Text style={styles.worldStatsLine}>
              Market: {worldStats.open_listings} listings  |  {formatCurrency(worldStats.market_volume_24h)} volume (24h)
            </Text>
            <Text style={styles.worldStatsLine}>
              Events: {worldStats.active_events} active
            </Text>
          </View>
        )}

        {/* Your Rank Card */}
        {myRank && (
          <View style={styles.myRankCard}>
            <Text style={styles.myRankLabel}>Your Rank</Text>
            <View style={styles.myRankRow}>
              <Text style={styles.myRankNumber}>#{myRank.rank}</Text>
              <Text style={styles.myRankWorth}>{formatCurrency(myRank.net_worth)}</Text>
            </View>
          </View>
        )}

        {/* Leaderboard List */}
        {!entries || entries.length === 0 ? (
          <EmptyState
            icon={'\uD83C\uDFC6'}
            title="No players yet"
            subtitle="Be the first to build an empire"
          />
        ) : (
          <View style={styles.list}>
            {entries.slice(0, 20).map((entry) => {
              const { color: rankColor, label: rankLabel } = getRankDisplay(entry.rank);
              const isTopThree = entry.rank <= 3;

              return (
                <View
                  key={entry.id}
                  style={[
                    styles.row,
                    isTopThree && styles.rowTopThree,
                    isTopThree && { borderLeftColor: rankColor },
                  ]}
                >
                  {/* Rank */}
                  <View style={styles.rankCol}>
                    <Text style={[styles.rankText, { color: rankColor }]}>
                      {rankLabel}
                    </Text>
                  </View>

                  {/* Player Info */}
                  <View style={styles.infoCol}>
                    <Text style={styles.username}>{entry.username}</Text>
                    <Text style={styles.levelText}>
                      Lv.{entry.level} {entry.rank_title}
                    </Text>
                  </View>

                  {/* Net Worth + Business Count */}
                  <View style={styles.valueCol}>
                    <Text style={styles.netWorth}>
                      {formatCurrency(entry.net_worth)}
                    </Text>
                    <View style={styles.bizBadge}>
                      <Text style={styles.bizBadgeText}>
                        {entry.business_count} biz
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

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

  // World Stats card
  worldStatsCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
  },
  worldStatsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  worldStatsLine: {
    fontSize: 13,
    color: '#d1d5db',
    fontWeight: '600',
    lineHeight: 20,
  },

  // Your Rank card
  myRankCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#22c55e',
  },
  myRankLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22c55e',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  myRankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  myRankNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f9fafb',
  },
  myRankWorth: {
    fontSize: 20,
    fontWeight: '700',
    color: '#22c55e',
    fontVariant: ['tabular-nums'],
  },

  // List
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    borderLeftWidth: 3,
    borderLeftColor: '#1f2937',
  },
  rowTopThree: {
    borderLeftWidth: 3,
  },

  // Rank column
  rankCol: {
    width: 44,
    alignItems: 'center',
  },
  rankText: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },

  // Info column
  infoCol: {
    flex: 1,
    marginLeft: 8,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },
  levelText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },

  // Value column
  valueCol: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  netWorth: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
    fontVariant: ['tabular-nums'],
  },
  bizBadge: {
    backgroundColor: '#1f2937',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  bizBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
});
