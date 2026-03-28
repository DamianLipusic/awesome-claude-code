import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { useToast } from '../../components/Toast';
import type { BusinessStackParamList } from './BusinessHubScreen';

type RoutePropType = RouteProp<BusinessStackParamList, 'ManagerMarket'>;

const TIER_COLORS: Record<number, string> = { 1: '#666666', 2: '#4a9eff', 3: '#6c5ce7', 4: '#ffd700' };

interface AvailableManager {
  id: string;
  name: string;
  tier: number;
  skill_bonus: number;
  satisfaction_bonus: number;
  price: number;
  specialization: string;
}

export function ManagerMarketScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { businessId } = route.params;
  const [pendingHire, setPendingHire] = useState<AvailableManager | null>(null);

  const { data: managers, isLoading, refetch, isRefetching } = useQuery<AvailableManager[]>({
    queryKey: ['managers-available'],
    queryFn: () => api.get<AvailableManager[]>('/managers/available'),
    staleTime: 60_000,
  });

  const hireMutation = useMutation({
    mutationFn: (managerId: string) => api.post('/managers/hire', { manager_id: managerId, business_id: businessId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      queryClient.invalidateQueries({ queryKey: ['managers-available'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      setPendingHire(null);
      toast.show('Manager hired successfully!', 'success');
      navigation.goBack();
    },
    onError: (err) => {
      toast.show(err instanceof Error ? err.message : 'Failed to hire manager', 'error');
      setPendingHire(null);
    },
  });

  const trainMutation = useMutation({
    mutationFn: () => api.post('/managers/train', { business_id: businessId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      toast.show('Manager training started! Ready in 7 days.', 'success');
      navigation.goBack();
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Failed to start training', 'error'); },
  });

  if (isLoading) return <View style={s.screen}><LoadingSkeleton rows={4} /></View>;

  return (
    <View style={s.screen}>
      <View style={s.headerInfo}>
        <Text style={s.headerTitle}>Manager Market</Text>
        <Text style={s.headerSubtitle}>Very few managers available each season. Hire wisely.</Text>
      </View>

      {(managers ?? []).length === 0 ? (
        <EmptyState icon="👔" title="No managers available" subtitle="Check back next season for new managers." />
      ) : (
        <FlatList
          data={managers}
          keyExtractor={(m) => m.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00d2d3" />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const tierColor = TIER_COLORS[item.tier] ?? '#666';
            return (
              <View style={[s.managerCard, { borderLeftWidth: 3, borderLeftColor: tierColor }]}>
                <View style={s.cardHeader}>
                  <View>
                    <Text style={s.managerName}>{item.name}</Text>
                    <View style={s.badgeRow}>
                      <Badge label={'T' + item.tier} variant={item.tier >= 3 ? 'purple' : 'blue'} />
                      {item.specialization && <Badge label={item.specialization} variant="gray" />}
                    </View>
                  </View>
                  <Text style={[s.price, { color: tierColor }]}>{formatCurrency(item.price)}</Text>
                </View>

                <View style={s.statsRow}>
                  <View style={s.stat}>
                    <Text style={s.statLabel}>Skill Bonus</Text>
                    <Text style={s.statValue}>+{Math.round(item.skill_bonus * 100)}%</Text>
                  </View>
                  <View style={s.stat}>
                    <Text style={s.statLabel}>Satisfaction</Text>
                    <Text style={s.statValue}>+{Math.round(item.satisfaction_bonus * 100)}%</Text>
                  </View>
                </View>

                <TouchableOpacity style={s.hireBtn} onPress={() => setPendingHire(item)}>
                  <Text style={s.hireBtnText}>Hire Manager — {formatCurrency(item.price)}</Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListFooterComponent={
            <View style={s.trainSection}>
              <View style={s.trainCard}>
                <Text style={s.trainTitle}>🎓 Train Your Own Manager</Text>
                <Text style={s.trainDesc}>Train an internal manager for $50,000. Takes 7 days to complete.</Text>
                <TouchableOpacity style={s.trainBtn} onPress={() => trainMutation.mutate()} disabled={trainMutation.isPending}>
                  {trainMutation.isPending ? <ActivityIndicator color="#0a0a0f" /> : (
                    <Text style={s.trainBtnText}>Start Training — $50,000</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          }
        />
      )}

      <ConfirmModal
        visible={pendingHire !== null}
        title="Hire Manager"
        message={pendingHire ? 'Hire ' + pendingHire.name + ' (T' + pendingHire.tier + ') for ' + formatCurrency(pendingHire.price) + '?' : ''}
        confirmLabel="Hire"
        onConfirm={() => { if (pendingHire) hireMutation.mutate(pendingHire.id); }}
        onCancel={() => setPendingHire(null)}
        isLoading={hireMutation.isPending}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0f' },
  headerInfo: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#e0e0e0' },
  headerSubtitle: { fontSize: 12, color: '#a0a0b0', marginTop: 4 },
  listContent: { padding: 12, paddingBottom: 32 },
  managerCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a3e' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  managerName: { fontSize: 16, fontWeight: '700', color: '#e0e0e0', marginBottom: 6 },
  badgeRow: { flexDirection: 'row', gap: 6 },
  price: { fontSize: 18, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: '#12121a', borderRadius: 8, padding: 10 },
  statLabel: { fontSize: 10, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#00d2d3' },
  hireBtn: { backgroundColor: '#6c5ce7', borderRadius: 8, padding: 12, alignItems: 'center' },
  hireBtnText: { color: '#0a0a0f', fontSize: 14, fontWeight: '700' },
  trainSection: { marginTop: 20 },
  trainCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#2a2a3e' },
  trainTitle: { fontSize: 16, fontWeight: '700', color: '#e0e0e0', marginBottom: 6 },
  trainDesc: { fontSize: 13, color: '#a0a0b0', marginBottom: 14 },
  trainBtn: { backgroundColor: '#ffa502', borderRadius: 8, padding: 12, alignItems: 'center' },
  trainBtnText: { color: '#0a0a0f', fontSize: 14, fontWeight: '700' },
});
