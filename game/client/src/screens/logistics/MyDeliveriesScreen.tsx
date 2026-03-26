import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';

type TabKey = 'active' | 'completed';

interface MyDelivery {
  id: string;
  resource_name: string;
  resource_icon: string;
  quantity: number;
  origin: string;
  destination: string;
  fee: number;
  status: string;
  claimed_at: string;
  estimated_delivery: string;
  delivered_at: string | null;
  progress: number;
}

export function MyDeliveriesScreen() {
  const [tab, setTab] = useState<TabKey>('active');

  const { data: deliveries, isLoading, refetch, isRefetching } = useQuery<MyDelivery[]>({
    queryKey: ['logistics', 'my-deliveries'],
    queryFn: () => api.get<MyDelivery[]>('/logistics/deliveries/mine'),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const active = (deliveries ?? []).filter((d) => d.status !== 'DELIVERED' && d.status !== 'COMPLETED');
  const completed = (deliveries ?? []).filter((d) => d.status === 'DELIVERED' || d.status === 'COMPLETED');
  const list = tab === 'active' ? active : completed;

  if (isLoading) return <View style={s.screen}><View style={{ padding: 16 }}><LoadingSkeleton rows={4} /></View></View>;

  return (
    <View style={s.screen}>
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, tab === 'active' && s.tabActive]} onPress={() => setTab('active')}>
          <Text style={[s.tabText, tab === 'active' && s.tabTextActive]}>Active ({active.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, tab === 'completed' && s.tabActive]} onPress={() => setTab('completed')}>
          <Text style={[s.tabText, tab === 'completed' && s.tabTextActive]}>Completed ({completed.length})</Text>
        </TouchableOpacity>
      </View>

      {list.length === 0 ? (
        <EmptyState
          icon={tab === 'active' ? '🚚' : '✅'}
          title={tab === 'active' ? 'No active deliveries' : 'No completed deliveries'}
          subtitle={tab === 'active' ? 'Claim a delivery from the board to get started.' : 'Complete some deliveries to see them here.'}
        />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(d) => d.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00d2d3" />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardHeader}>
                <View style={s.resourceRow}>
                  <Text style={s.resourceIcon}>{item.resource_icon || '📦'}</Text>
                  <View>
                    <Text style={s.resourceName}>{item.resource_name} x{item.quantity}</Text>
                    <View style={s.routeRow}>
                      <Text style={s.routeText}>{item.origin}</Text>
                      <Text style={s.routeArrow}> → </Text>
                      <Text style={s.routeText}>{item.destination}</Text>
                    </View>
                  </View>
                </View>
                <Text style={[s.fee, tab === 'completed' && { color: '#00d2d3' }]}>
                  {tab === 'completed' ? '+' : ''}{formatCurrency(item.fee)}
                </Text>
              </View>

              {tab === 'active' && (
                <View style={s.progressSection}>
                  <View style={s.progressRow}>
                    <Text style={s.progressLabel}>Delivery Progress</Text>
                    <Text style={s.progressPercent}>{Math.round(item.progress)}%</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${Math.min(100, item.progress)}%` as `${number}%` }]} />
                  </View>
                  <Text style={s.etaText}>ETA: {new Date(item.estimated_delivery).toLocaleString()}</Text>
                </View>
              )}

              {tab === 'completed' && item.delivered_at && (
                <Text style={s.completedAt}>Delivered: {new Date(item.delivered_at).toLocaleDateString()}</Text>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0f' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2a2a3e', backgroundColor: '#12121a' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#6c5ce7' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#a0a0b0' },
  tabTextActive: { color: '#6c5ce7' },
  listContent: { padding: 12, paddingBottom: 32 },
  card: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a3e' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  resourceIcon: { fontSize: 24 },
  resourceName: { fontSize: 14, fontWeight: '700', color: '#e0e0e0' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  routeText: { fontSize: 12, color: '#a0a0b0' },
  routeArrow: { fontSize: 12, color: '#a0a0b0' },
  fee: { fontSize: 15, fontWeight: '800', color: '#ffa502' },
  progressSection: { backgroundColor: '#12121a', borderRadius: 8, padding: 10 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 11, color: '#a0a0b0' },
  progressPercent: { fontSize: 12, fontWeight: '700', color: '#6c5ce7' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: '#2a2a3e', overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#6c5ce7' },
  etaText: { fontSize: 10, color: '#a0a0b0' },
  completedAt: { fontSize: 11, color: '#a0a0b0' },
});
