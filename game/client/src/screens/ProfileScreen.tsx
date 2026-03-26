import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { AlignmentBadge } from '../components/ui/Badge';
import { CurrencyText, formatCurrency } from '../components/ui/CurrencyText';
import { EmptyState } from '../components/ui/EmptyState';
import { Card } from '../components/ui/Card';
import type { LeaderboardEntry } from '@economy-game/shared';

const ALIGNMENT_COLORS: Record<string, string> = {
  LEGAL: '#3b82f6',
  CRIMINAL: '#ef4444',
  MIXED: '#f97316',
};

interface ReputationAxis {
  label: string;
  key: string;
  color: string;
}

const REPUTATION_AXES: ReputationAxis[] = [
  { label: 'Street Cred', key: 'street_cred', color: '#ef4444' },
  { label: 'Business Rep', key: 'business_rep', color: '#3b82f6' },
  { label: 'Political Inf.', key: 'political_influence', color: '#a855f7' },
  { label: 'Fear Factor', key: 'fear_factor', color: '#f97316' },
  { label: 'Reliability', key: 'reliability', color: '#22c55e' },
  { label: 'Discretion', key: 'discretion', color: '#06b6d4' },
];

function ReputationBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <View style={repStyles.row}>
      <Text style={repStyles.label}>{label}</Text>
      <View style={repStyles.track}>
        <View style={[repStyles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[repStyles.value, { color }]}>{pct}</Text>
    </View>
  );
}

const repStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { width: 90, fontSize: 11, color: '#9ca3af', fontWeight: '600' },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#1f2937', overflow: 'hidden', marginHorizontal: 8 },
  fill: { height: '100%', borderRadius: 4 },
  value: { width: 28, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

function AchievementBadge({ label }: { label: string }) {
  return (
    <View style={achStyles.badge}>
      <Text style={achStyles.badgeText}>{label}</Text>
    </View>
  );
}

const achStyles = StyleSheet.create({
  badge: { backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#374151' },
  badgeText: { color: '#9ca3af', fontSize: 11, fontWeight: '600' },
});

export function ProfileScreen() {
  const { player, logout } = useAuthStore();

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await api.get<{ items: LeaderboardEntry[]; total: number }>('/players/leaderboard');
      return res?.items ?? [];
    },
  });

  const { data: profileData } = useQuery({
    queryKey: ['player', 'profile'],
    queryFn: () => api.get('/players/profile').then((r: any) => r.data ?? r),
  });

  const { data: rivalryData } = useQuery({
    queryKey: ['player', 'rivalry-stats'],
    queryFn: () => api.get('/rivalries/stats').then((r: any) => r.data ?? r),
  });

  const leaderboard = leaderboardQuery.data ?? [];
  const myRank = leaderboard.findIndex((e) => e.player_id === player?.id) + 1;
  const reputation = profileData?.reputation ?? {};
  const rivalryStats = rivalryData ?? { wins: 0, losses: 0, active_feuds: 0 };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Player Card */}
      <View style={styles.playerCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{player?.username?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.username}>{player?.username ?? '\u2014'}</Text>
          <AlignmentBadge alignment={player?.alignment ?? 'LEGAL'} />
        </View>
        <View style={styles.metaPoints}>
          <Text style={styles.metaPointsValue}>{player?.meta_points ?? 0}</Text>
          <Text style={styles.metaPointsLabel}>Meta Points</Text>
        </View>
      </View>

      {/* Stats Overview */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <CurrencyText amount={player?.net_worth ?? 0} style={styles.statBigValue} />
          <Text style={styles.statLabel}>Net Worth</Text>
        </View>
        <View style={styles.statBox}>
          <CurrencyText amount={player?.cash ?? 0} style={styles.statBigValue} />
          <Text style={styles.statLabel}>Cash</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statBigValue}>{myRank > 0 ? `#${myRank}` : '\u2014'}</Text>
          <Text style={styles.statLabel}>Season Rank</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBigValue}>{player?.business_slots ?? 1}</Text>
          <Text style={styles.statLabel}>Biz Slots</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statBigValue}>{profileData?.total_employees ?? 0}</Text>
          <Text style={styles.statLabel}>Employees</Text>
        </View>
      </View>

      {/* Reputation Radar (Bar Chart) */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Reputation</Text>
        {REPUTATION_AXES.map((axis) => (
          <ReputationBar
            key={axis.key}
            label={axis.label}
            value={reputation[axis.key] ?? 0}
            color={axis.color}
          />
        ))}
      </Card>

      {/* Rivalry Stats */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Rivalry Stats</Text>
        <View style={styles.rivalryRow}>
          <View style={styles.rivalryStat}>
            <Text style={[styles.rivalryValue, { color: '#22c55e' }]}>{rivalryStats.wins}</Text>
            <Text style={styles.rivalryLabel}>Wins</Text>
          </View>
          <View style={styles.rivalryDivider} />
          <View style={styles.rivalryStat}>
            <Text style={[styles.rivalryValue, { color: '#ef4444' }]}>{rivalryStats.losses}</Text>
            <Text style={styles.rivalryLabel}>Losses</Text>
          </View>
          <View style={styles.rivalryDivider} />
          <View style={styles.rivalryStat}>
            <Text style={[styles.rivalryValue, { color: '#f97316' }]}>{rivalryStats.active_feuds}</Text>
            <Text style={styles.rivalryLabel}>Active Feuds</Text>
          </View>
        </View>
      </Card>

      {/* Achievement Badges */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Achievements</Text>
        {(profileData?.achievements ?? []).length === 0 ? (
          <View style={styles.achievementPlaceholder}>
            <Text style={styles.achievementPlaceholderText}>
              Complete objectives to earn achievement badges
            </Text>
            <View style={styles.achievementGrid}>
              <AchievementBadge label="First Blood" />
              <AchievementBadge label="Mogul" />
              <AchievementBadge label="Shadow King" />
              <AchievementBadge label="Untouchable" />
            </View>
          </View>
        ) : (
          <View style={styles.achievementGrid}>
            {(profileData?.achievements ?? []).map((ach: string, i: number) => (
              <AchievementBadge key={i} label={ach} />
            ))}
          </View>
        )}
      </Card>

      {/* Veteran Bonus */}
      {(player?.veteran_bonus_cash ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Veteran Bonus</Text>
          <View style={styles.bonusCard}>
            <Text style={styles.bonusText}>
              +${player?.veteran_bonus_cash?.toLocaleString()} starting cash this season
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
      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
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
    flexDirection: 'row', gap: 8, marginBottom: 8,
  },
  statBox: {
    flex: 1, backgroundColor: '#111827', borderRadius: 10, padding: 12,
    alignItems: 'center', borderWidth: 1, borderColor: '#1f2937',
  },
  statBigValue: { color: 'white', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#6b7280', fontSize: 11, marginTop: 4 },
  card: { marginBottom: 12, marginTop: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#f9fafb', marginBottom: 12 },
  rivalryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  rivalryStat: { alignItems: 'center', flex: 1 },
  rivalryValue: { fontSize: 24, fontWeight: '800' },
  rivalryLabel: { fontSize: 11, color: '#6b7280', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  rivalryDivider: { width: 1, height: 40, backgroundColor: '#1f2937' },
  achievementPlaceholder: { alignItems: 'center' },
  achievementPlaceholderText: { color: '#4b5563', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
