import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { StatBar } from '../../components/ui/StatBar';

interface Location {
  id: string;
  name: string;
  city: string;
  zone: string;
  traffic_level: number;
  level: number;
  is_dual_use: boolean;
  upgrade_cost: number;
  transform_cost: number;
  weekly_revenue: number;
  weekly_expenses: number;
  status: string;
}

export function LocationScreen() {
  const queryClient = useQueryClient();

  const { data: locationsData, isLoading, refetch } = useQuery({
    queryKey: ['locations'],
    queryFn: () => api.get('/locations').then((r: any) => r.data ?? r),
  });

  const upgradeMutation = useMutation({
    mutationFn: (locationId: string) =>
      api.post(`/locations/${locationId}/upgrade`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      Alert.alert('Success', 'Location upgraded!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Upgrade failed'),
  });

  const transformMutation = useMutation({
    mutationFn: (locationId: string) =>
      api.post(`/locations/${locationId}/transform`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['locations'] });
      Alert.alert('Success', 'Location transformed to dual-use!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Transform failed'),
  });

  const locations: Location[] = Array.isArray(locationsData) ? locationsData : locationsData?.items ?? [];

  const handleUpgrade = (loc: Location) => {
    Alert.alert(
      'Upgrade Location',
      `Upgrade ${loc.name} to level ${loc.level + 1} for ${formatCurrency(loc.upgrade_cost)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => upgradeMutation.mutate(loc.id) },
      ]
    );
  };

  const handleTransform = (loc: Location) => {
    Alert.alert(
      'Transform to Dual-Use',
      `Transform ${loc.name} into a dual-use location for ${formatCurrency(loc.transform_cost)}? This allows both legal and illegal operations but increases detection risk.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Transform', style: 'destructive', onPress: () => transformMutation.mutate(loc.id) },
      ]
    );
  };

  const calculateROI = (loc: Location): number => {
    const netWeekly = loc.weekly_revenue - loc.weekly_expenses;
    if (loc.upgrade_cost <= 0 || netWeekly <= 0) return 0;
    return Math.round((netWeekly / loc.upgrade_cost) * 100);
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#22c55e" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Locations</Text>
        <Text style={styles.subtitle}>{locations.length} properties owned</Text>
      </View>

      {locations.length === 0 ? (
        <EmptyState
          icon="📍"
          title="No Locations"
          subtitle="Purchase locations to expand your empire"
        />
      ) : (
        locations.map((loc) => {
          const roi = calculateROI(loc);
          return (
            <Card key={loc.id} style={styles.locationCard}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationName}>{loc.name}</Text>
                  <Text style={styles.locationMeta}>
                    {loc.city} · {loc.zone}
                  </Text>
                </View>
                <View style={styles.headerRight}>
                  <StatusBadge status={loc.status} />
                  {loc.is_dual_use && (
                    <Badge label="DUAL-USE" variant="orange" />
                  )}
                </View>
              </View>

              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Level</Text>
                  <Text style={styles.statValue}>{loc.level}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Revenue/wk</Text>
                  <Text style={[styles.statValue, { color: '#22c55e' }]}>
                    {formatCurrency(loc.weekly_revenue)}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Expenses/wk</Text>
                  <Text style={[styles.statValue, { color: '#ef4444' }]}>
                    {formatCurrency(loc.weekly_expenses)}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>ROI</Text>
                  <Text style={[styles.statValue, { color: roi > 10 ? '#22c55e' : roi > 5 ? '#eab308' : '#6b7280' }]}>
                    {roi}%
                  </Text>
                </View>
              </View>

              <StatBar
                label="Traffic Level"
                value={loc.traffic_level}
                color={loc.traffic_level > 70 ? '#22c55e' : loc.traffic_level > 40 ? '#eab308' : '#ef4444'}
              />

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => handleUpgrade(loc)}
                  disabled={upgradeMutation.isPending}
                >
                  <Text style={styles.upgradeBtnText}>
                    {upgradeMutation.isPending ? 'Upgrading...' : `Upgrade (${formatCurrency(loc.upgrade_cost)})`}
                  </Text>
                </TouchableOpacity>
                {!loc.is_dual_use && (
                  <TouchableOpacity
                    style={styles.transformBtn}
                    onPress={() => handleTransform(loc)}
                    disabled={transformMutation.isPending}
                  >
                    <Text style={styles.transformBtnText}>
                      {transformMutation.isPending ? 'Transforming...' : 'Dual-Use'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  locationCard: { marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  locationName: { fontSize: 16, fontWeight: '700', color: '#f9fafb' },
  locationMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  statItem: { flex: 1, minWidth: '40%', backgroundColor: '#030712', borderRadius: 8, padding: 8 },
  statLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#d1d5db' },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  upgradeBtn: { flex: 1, backgroundColor: '#22c55e', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  upgradeBtnText: { color: '#030712', fontWeight: '700', fontSize: 13 },
  transformBtn: { flex: 1, backgroundColor: '#1c1917', borderWidth: 1, borderColor: '#f97316', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  transformBtnText: { color: '#f97316', fontWeight: '700', fontSize: 13 },
});
