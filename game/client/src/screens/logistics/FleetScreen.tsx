import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { useToast } from '../../components/Toast';

const TIER_COLORS: Record<number, string> = { 1: '#666666', 2: '#4a9eff', 3: '#6c5ce7', 4: '#ffd700' };

interface FleetVehicle {
  id: string;
  name: string;
  tier: number;
  city: string;
  active_deliveries: number;
  max_concurrent: number;
  total_revenue: number;
  upgrade_cost: number | null;
}

interface FleetStats {
  total_vehicles: number;
  total_revenue: number;
  total_deliveries: number;
}

export function FleetScreen() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: fleet, isLoading, refetch, isRefetching } = useQuery<FleetVehicle[]>({
    queryKey: ['logistics', 'fleet'],
    queryFn: () => api.get<FleetVehicle[]>('/logistics/fleet'),
    staleTime: 30_000,
  });

  const { data: stats } = useQuery<FleetStats>({
    queryKey: ['logistics', 'fleet-stats'],
    queryFn: () => api.get<FleetStats>('/logistics/fleet/stats'),
    staleTime: 30_000,
  });

  const upgradeMutation = useMutation({
    mutationFn: (businessId: string) => api.post('/logistics/fleet/' + businessId + '/upgrade'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics'] });
      toast.show('Fleet vehicle upgraded!', 'success');
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Upgrade failed', 'error'); },
  });

  if (isLoading) return <View style={s.screen}><View style={{ padding: 16 }}><LoadingSkeleton rows={5} /></View></View>;

  return (
    <View style={s.screen}>
      {/* Stats header */}
      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Text style={s.statLabel}>Vehicles</Text>
          <Text style={s.statValue}>{stats?.total_vehicles ?? (fleet ?? []).length}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>Total Revenue</Text>
          <Text style={[s.statValue, { color: '#00d2d3' }]}>{formatCurrency(stats?.total_revenue ?? 0)}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={s.statLabel}>Deliveries</Text>
          <Text style={s.statValue}>{stats?.total_deliveries ?? 0}</Text>
        </View>
      </View>

      {(fleet ?? []).length === 0 ? (
        <EmptyState icon="🚛" title="No logistics businesses" subtitle="Open a logistics business to start your fleet." />
      ) : (
        <FlatList
          data={fleet}
          keyExtractor={(v) => v.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00d2d3" />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const tierColor = TIER_COLORS[item.tier] ?? '#666';
            return (
              <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: tierColor }]}>
                <View style={s.cardHeader}>
                  <View>
                    <Text style={s.vehicleName}>{item.name}</Text>
                    <Text style={s.vehicleCity}>📍 {item.city}</Text>
                  </View>
                  <Text style={[s.vehicleTier, { color: tierColor }]}>T{item.tier}</Text>
                </View>

                <View style={s.infoRow}>
                  <View style={s.infoItem}>
                    <Text style={s.infoLabel}>Active</Text>
                    <Text style={s.infoValue}>{item.active_deliveries}/{item.max_concurrent}</Text>
                  </View>
                  <View style={s.infoItem}>
                    <Text style={s.infoLabel}>Revenue</Text>
                    <Text style={[s.infoValue, { color: '#00d2d3' }]}>{formatCurrency(item.total_revenue)}</Text>
                  </View>
                </View>

                {item.upgrade_cost !== null && (
                  <TouchableOpacity
                    style={s.upgradeBtn}
                    onPress={() => upgradeMutation.mutate(item.id)}
                    disabled={upgradeMutation.isPending}
                  >
                    <Text style={s.upgradeBtnText}>Upgrade — {formatCurrency(item.upgrade_cost)}</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0f' },
  statsBar: { flexDirection: 'row', backgroundColor: '#12121a', borderBottomWidth: 1, borderBottomColor: '#2a2a3e', padding: 14, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#e0e0e0' },
  statDivider: { width: 1, height: 28, backgroundColor: '#2a2a3e' },
  listContent: { padding: 12, paddingBottom: 32 },
  card: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a3e' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  vehicleName: { fontSize: 16, fontWeight: '700', color: '#e0e0e0' },
  vehicleCity: { fontSize: 12, color: '#a0a0b0', marginTop: 2 },
  vehicleTier: { fontSize: 20, fontWeight: '800' },
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  infoItem: { flex: 1, backgroundColor: '#12121a', borderRadius: 8, padding: 10 },
  infoLabel: { fontSize: 10, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#e0e0e0' },
  upgradeBtn: { backgroundColor: '#6c5ce7', borderRadius: 8, padding: 10, alignItems: 'center' },
  upgradeBtnText: { color: '#e0e0e0', fontSize: 13, fontWeight: '700' },
});
