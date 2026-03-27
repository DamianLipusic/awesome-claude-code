import React, { useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCurrency } from '../components/ui/CurrencyText';
import { LoadingSkeleton } from '../components/ui/LoadingScreen';

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  net_worth: number;
  level: number;
  xp: number;
  is_you: boolean;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  your_rank: number;
}

const C = {
  bg: '#0a0a0f',
  card: '#1a1a2e',
  cardBorder: '#2a2a3e',
  primary: '#6c5ce7',
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
  success: '#22c55e',
  text: '#e0e0e0',
  dim: '#6b7280',
  bright: '#f9fafb',
  you: '#6c5ce7',
};

const RANK_STYLE: Record<number, { color: string; emoji: string }> = {
  1: { color: C.gold, emoji: '🥇' },
  2: { color: C.silver, emoji: '🥈' },
  3: { color: C.bronze, emoji: '🥉' },
};

export function LeaderboardScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard'],
    queryFn: () => api.get<LeaderboardData>('/game/leaderboard'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  if (isLoading) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <LoadingSkeleton rows={6} />
      </ScrollView>
    );
  }

  if (!data) return null;

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={C.primary} />
      }
    >
      <View style={s.header}>
        <Text style={s.title}>Leaderboard</Text>
        <Text style={s.yourRank}>Your Rank: #{data.your_rank}</Text>
      </View>

      {data.leaderboard.map((entry) => {
        const medal = RANK_STYLE[entry.rank];
        const isYou = entry.is_you;

        return (
          <View
            key={entry.id}
            style={[s.row, isYou && s.rowYou]}
          >
            <View style={s.rankCol}>
              {medal ? (
                <Text style={s.medal}>{medal.emoji}</Text>
              ) : (
                <Text style={[s.rankNum, medal && { color: medal.color }]}>#{entry.rank}</Text>
              )}
            </View>

            <View style={s.infoCol}>
              <Text style={[s.username, isYou && { color: C.you }]}>
                {entry.username}{isYou ? ' (you)' : ''}
              </Text>
              <Text style={s.levelText}>Lv {entry.level}</Text>
            </View>

            <Text style={[s.netWorth, medal && { color: medal.color }]}>
              {formatCurrency(entry.net_worth)}
            </Text>
          </View>
        );
      })}

      {data.leaderboard.length === 0 && (
        <Text style={s.empty}>No players yet. Be the first!</Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: C.bright,
  },
  yourRank: {
    fontSize: 14,
    fontWeight: '700',
    color: C.primary,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  rowYou: {
    borderColor: C.you + '66',
    backgroundColor: C.you + '11',
  },

  rankCol: {
    width: 40,
    alignItems: 'center',
  },
  medal: {
    fontSize: 22,
  },
  rankNum: {
    fontSize: 14,
    fontWeight: '800',
    color: C.dim,
  },

  infoCol: {
    flex: 1,
    marginLeft: 8,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
    color: C.bright,
  },
  levelText: {
    fontSize: 11,
    color: C.dim,
    fontWeight: '600',
    marginTop: 1,
  },

  netWorth: {
    fontSize: 15,
    fontWeight: '800',
    color: C.success,
  },

  empty: {
    fontSize: 14,
    color: C.dim,
    textAlign: 'center',
    marginTop: 40,
  },
});
