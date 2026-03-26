import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { StatBar } from '../../components/ui/StatBar';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { formatCurrency } from '../../components/ui/CurrencyText';

export type LogisticsStackParamList = {
  LogisticsHub: undefined;
  DeliveryBoard: undefined;
  MyDeliveries: undefined;
  Fleet: undefined;
};

type NavProp = StackNavigationProp<LogisticsStackParamList, 'LogisticsHub'>;

interface CareerProgress {
  current_tier: number;
  deliveries_completed: number;
  total_earned: number;
  next_tier_threshold: number;
  tier_name: string;
}

interface FleetBusiness {
  id: string;
  name: string;
  tier: number;
  active_deliveries: number;
  max_concurrent: number;
  city: string;
}

const TIER_COLORS: Record<number, string> = { 1: '#666666', 2: '#4a9eff', 3: '#6c5ce7', 4: '#ffd700' };

export function LogisticsHubScreen() {
  const navigation = useNavigation<NavProp>();
  const player = useAuthStore((s) => s.player);

  const { data: career, isLoading: careerLoading, refetch } = useQuery<CareerProgress>({
    queryKey: ['logistics', 'career'],
    queryFn: () => api.get<CareerProgress>('/logistics/career'),
    staleTime: 30_000,
  });

  const { data: fleet, isLoading: fleetLoading } = useQuery<FleetBusiness[]>({
    queryKey: ['logistics', 'fleet'],
    queryFn: () => api.get<FleetBusiness[]>('/logistics/fleet'),
    staleTime: 30_000,
  });

  const isLoading = careerLoading || fleetLoading;

  if (isLoading) return <View style={s.screen}><View style={{ padding: 16 }}><LoadingSkeleton rows={5} /></View></View>;

  const tierColor = TIER_COLORS[career?.current_tier ?? 1] ?? '#666';
  const progressPercent = career ? Math.min(100, (career.deliveries_completed / career.next_tier_threshold) * 100) : 0;

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#00d2d3" />}>

      {/* Career Progress Card */}
      <View style={[s.careerCard, { borderLeftWidth: 3, borderLeftColor: tierColor }]}>
        <Text style={s.careerTitle}>🚚 Carrier Career</Text>
        <View style={s.careerTierRow}>
          <Text style={[s.careerTier, { color: tierColor }]}>T{career?.current_tier ?? 1}</Text>
          <Text style={s.careerTierName}>{career?.tier_name ?? 'Rookie'}</Text>
        </View>
        <View style={s.careerStatsRow}>
          <View style={s.careerStat}>
            <Text style={s.careerStatLabel}>Deliveries</Text>
            <Text style={s.careerStatValue}>{career?.deliveries_completed ?? 0}</Text>
          </View>
          <View style={s.careerStat}>
            <Text style={s.careerStatLabel}>Total Earned</Text>
            <Text style={[s.careerStatValue, { color: '#00d2d3' }]}>{formatCurrency(career?.total_earned ?? 0)}</Text>
          </View>
        </View>
        <Text style={s.progressLabel}>Progress to next tier</Text>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progressPercent}%` as `${number}%`, backgroundColor: tierColor }]} />
        </View>
        <Text style={s.progressText}>{career?.deliveries_completed ?? 0}/{career?.next_tier_threshold ?? 10}</Text>
      </View>

      {/* Fleet Overview */}
      {(fleet ?? []).length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Fleet Overview</Text>
          {(fleet ?? []).map((biz) => {
            const tc = TIER_COLORS[biz.tier] ?? '#666';
            return (
              <View key={biz.id} style={s.fleetCard}>
                <View style={s.fleetHeader}>
                  <Text style={s.fleetName}>{biz.name}</Text>
                  <Text style={[s.fleetTier, { color: tc }]}>T{biz.tier}</Text>
                </View>
                <Text style={s.fleetCity}>📍 {biz.city}</Text>
                <View style={s.fleetDeliveryRow}>
                  <Text style={s.fleetDeliveryLabel}>Active Deliveries</Text>
                  <Text style={s.fleetDeliveryValue}>{biz.active_deliveries}/{biz.max_concurrent}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Action Cards */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Quick Actions</Text>
        <View style={s.actionsGrid}>
          <TouchableOpacity style={s.actionCard} onPress={() => navigation.navigate('DeliveryBoard')} activeOpacity={0.8}>
            <Text style={s.actionIcon}>📋</Text>
            <Text style={s.actionTitle}>Delivery Board</Text>
            <Text style={s.actionDesc}>Browse available delivery jobs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionCard} onPress={() => navigation.navigate('MyDeliveries')} activeOpacity={0.8}>
            <Text style={s.actionIcon}>📦</Text>
            <Text style={s.actionTitle}>My Deliveries</Text>
            <Text style={s.actionDesc}>Track your active deliveries</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.actionCard} onPress={() => navigation.navigate('Fleet')} activeOpacity={0.8}>
            <Text style={s.actionIcon}>🚛</Text>
            <Text style={s.actionTitle}>Fleet Management</Text>
            <Text style={s.actionDesc}>Manage your logistics businesses</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { padding: 16, paddingBottom: 32, gap: 16 },
  careerCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2a3e' },
  careerTitle: { fontSize: 16, fontWeight: '700', color: '#e0e0e0', marginBottom: 10 },
  careerTierRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  careerTier: { fontSize: 28, fontWeight: '800' },
  careerTierName: { fontSize: 16, color: '#a0a0b0', fontWeight: '600' },
  careerStatsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  careerStat: { flex: 1, backgroundColor: '#12121a', borderRadius: 8, padding: 10 },
  careerStatLabel: { fontSize: 10, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  careerStatValue: { fontSize: 18, fontWeight: '700', color: '#e0e0e0' },
  progressLabel: { fontSize: 11, color: '#a0a0b0', marginBottom: 6 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: '#12121a', overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { fontSize: 11, color: '#a0a0b0', textAlign: 'right' },
  section: {},
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#e0e0e0', marginBottom: 10 },
  fleetCard: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2a2a3e', marginBottom: 8 },
  fleetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  fleetName: { fontSize: 14, fontWeight: '700', color: '#e0e0e0' },
  fleetTier: { fontSize: 13, fontWeight: '800' },
  fleetCity: { fontSize: 12, color: '#a0a0b0', marginBottom: 6 },
  fleetDeliveryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  fleetDeliveryLabel: { fontSize: 11, color: '#a0a0b0' },
  fleetDeliveryValue: { fontSize: 13, fontWeight: '700', color: '#00d2d3' },
  actionsGrid: { gap: 10 },
  actionCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#2a2a3e' },
  actionIcon: { fontSize: 28, marginBottom: 8 },
  actionTitle: { fontSize: 15, fontWeight: '700', color: '#e0e0e0', marginBottom: 4 },
  actionDesc: { fontSize: 12, color: '#a0a0b0' },
});
