import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { CurrencyText } from '../components/ui/CurrencyText';
import { EmptyState } from '../components/ui/EmptyState';
import type { LeaderboardEntry, Player } from '@economy-game/shared';

const ALIGNMENT_COLORS: Record<string, string> = {
  LEGAL: '#3b82f6',
  CRIMINAL: '#ef4444',
  MIXED: '#f97316',
};

export default function ProfileScreen() {
  const { player, logout } = useAuthStore();

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get<LeaderboardEntry[]>('/players/leaderboard'),
    select: (r) => r.data,
  });

  const leaderboard = leaderboardQuery.data ?? [];
  const myRank = leaderboard.findIndex((e) => e.player_id === player?.id) + 1;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Player Card */}
      <View style={styles.playerCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{player?.username?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.username}>{player?.username ?? '—'}</Text>
          <Badge
            label={player?.alignment ?? 'LEGAL'}
            color={ALIGNMENT_COLORS[player?.alignment ?? 'LEGAL'] ?? '#3b82f6'}
          />
        </View>
        <View style={styles.metaPoints}>
          <Text style={styles.metaPointsValue}>{player?.meta_points ?? 0}</Text>
          <Text style={styles.metaPointsLabel}>Meta Points</Text>
        </View>
      </View>

      {/* Season Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <CurrencyText amount={player?.net_worth ?? 0} style={styles.statBigValue} />
          <Text style={styles.statLabel}>Net Worth</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBigValue}>{myRank > 0 ? `#${myRank}` : '—'}</Text>
          <Text style={styles.statLabel}>Season Rank</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBigValue}>{player?.business_slots ?? 1}</Text>
          <Text style={styles.statLabel}>Biz Slots</Text>
        </View>
      </View>

      {/* Veteran Bonus */}
      {(player?.veteran_bonus_cash ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veteran Bonus</Text>
          <View style={styles.bonusCard}>
            <Text style={styles.bonusText}>
              🎖️ +${player?.veteran_bonus_cash?.toLocaleString()} starting cash this season
            </Text>
          </View>
        </View>
      )}

      {/* Season History */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Season History</Text>
        {(player?.season_history ?? []).length === 0 ? (
          <EmptyState icon="📅" title="No past seasons" subtitle="Complete your first season to see history here" />
        ) : (
          (player?.season_history ?? []).map((s: any, i: number) => (
            <View key={i} style={styles.historyCard}>
              <Text style={styles.historyRank}>#{s.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.historyNet}>${s.net_worth?.toLocaleString()}</Text>
                <Text style={styles.historyLabel}>Season {i + 1}</Text>
              </View>
              <Text style={styles.historyAch}>{(s.achievements ?? []).length} achievements</Text>
            </View>
          ))
        )}
      </View>

      {/* Leaderboard */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Season Leaderboard</Text>
        {leaderboardQuery.isLoading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginVertical: 20 }} />
        ) : leaderboard.length === 0 ? (
          <EmptyState icon="🏆" title="No rankings yet" subtitle="Start playing to appear on the leaderboard" />
        ) : (
          leaderboard.slice(0, 50).map((entry) => (
            <View
              key={entry.player_id}
              style={[styles.rankRow, entry.player_id === player?.id && styles.rankRowSelf]}
            >
              <Text style={styles.rankNum}>#{entry.rank}</Text>
              <View style={styles.rankInfo}>
                <Text style={[styles.rankName, entry.player_id === player?.id && { color: '#22c55e' }]}>
                  {entry.username}
                  {entry.player_id === player?.id ? ' (you)' : ''}
                </Text>
                <Text style={styles.rankBizCount}>{entry.business_count} businesses</Text>
              </View>
              <CurrencyText amount={entry.net_worth} style={styles.rankValue} />
              <View style={[styles.alignmentDot, { backgroundColor: ALIGNMENT_COLORS[entry.alignment] ?? '#6b7280' }]} />
            </View>
          ))
        )}
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={logout}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 40 },
  playerCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827',
    borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#1f2937',
  },
  avatarCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#1d4ed8',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  avatarText: { color: 'white', fontSize: 24, fontWeight: '700' },
  playerInfo: { flex: 1, gap: 6 },
  username: { color: 'white', fontSize: 18, fontWeight: '700' },
  metaPoints: { alignItems: 'center' },
  metaPointsValue: { color: '#f97316', fontSize: 20, fontWeight: '700' },
  metaPointsLabel: { color: '#6b7280', fontSize: 11 },
  statsRow: {
    flexDirection: 'row', gap: 8, marginBottom: 16,
  },
  statBox: {
    flex: 1, backgroundColor: '#111827', borderRadius: 10, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#1f2937',
  },
  statBigValue: { color: 'white', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: { color: '#9ca3af', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  bonusCard: { backgroundColor: '#1c1917', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#292524' },
  bonusText: { color: '#fbbf24', fontSize: 14 },
  historyCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111827',
    borderRadius: 8, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#1f2937',
  },
  historyRank: { color: '#f97316', fontSize: 18, fontWeight: '700', width: 50 },
  historyNet: { color: 'white', fontSize: 15, fontWeight: '600' },
  historyLabel: { color: '#6b7280', fontSize: 12 },
  historyAch: { color: '#6b7280', fontSize: 12 },
  rankRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  rankRowSelf: { backgroundColor: '#0f2617', borderRadius: 6 },
  rankNum: { color: '#6b7280', fontSize: 14, width: 36 },
  rankInfo: { flex: 1 },
  rankName: { color: 'white', fontSize: 14, fontWeight: '500' },
  rankBizCount: { color: '#6b7280', fontSize: 12 },
  rankValue: { color: '#22c55e', fontSize: 14, fontWeight: '600', marginRight: 8 },
  alignmentDot: { width: 8, height: 8, borderRadius: 4 },
  signOutButton: {
    padding: 16, borderRadius: 8, backgroundColor: '#1f2937',
    alignItems: 'center', marginTop: 8,
  },
  signOutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});
