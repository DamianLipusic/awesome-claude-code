import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { StatBar } from '../../components/ui/StatBar';

interface Spy {
  id: string;
  employee_name: string;
  target_name: string;
  status: string;
  discovery_risk: number;
}

interface IntelItem {
  id: string;
  title: string;
  description: string;
  price: number;
  quality: string;
  source_type: string;
}

export function IntelScreen() {
  const queryClient = useQueryClient();
  const [showPlaceSpy, setShowPlaceSpy] = useState(false);
  const [spyEmployeeId, setSpyEmployeeId] = useState('');
  const [targetPlayerId, setTargetPlayerId] = useState('');

  const { data: spiesData, isLoading: spiesLoading, refetch: refetchSpies } = useQuery({
    queryKey: ['intelligence', 'spies'],
    queryFn: () => api.get('/intelligence/spies').then((r: any) => r.data),
  });

  const { data: marketData, isLoading: marketLoading } = useQuery({
    queryKey: ['intelligence', 'market'],
    queryFn: () => api.get('/intelligence/market').then((r: any) => r.data),
  });

  const placeSpyMutation = useMutation({
    mutationFn: (params: { spy_employee_id: string; target_player_id: string }) =>
      api.post('/intelligence/spies/place', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intelligence'] });
      setShowPlaceSpy(false);
      setSpyEmployeeId('');
      setTargetPlayerId('');
      Alert.alert('Success', 'Spy placed successfully!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to place spy'),
  });

  const counterIntelMutation = useMutation({
    mutationFn: () => api.post('/intelligence/counter-intel', {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['intelligence'] });
      Alert.alert('Counter-Intel', data?.data?.message ?? 'Counter-intelligence sweep completed!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Counter-intel failed'),
  });

  const spies: Spy[] = spiesData ?? [];
  const market: IntelItem[] = marketData ?? [];
  const isLoading = spiesLoading || marketLoading;

  if (isLoading) return <LoadingSkeleton />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetchSpies} tintColor="#22c55e" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Intelligence Network</Text>
          <Text style={styles.subtitle}>{spies.length} active spies</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.counterIntelBtn} onPress={() => counterIntelMutation.mutate()} disabled={counterIntelMutation.isPending}>
            <Text style={styles.counterIntelBtnText}>
              {counterIntelMutation.isPending ? 'Sweeping...' : 'Counter-Intel ($3,000)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Active Spies */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Active Spies</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowPlaceSpy(true)}>
            <Text style={styles.primaryBtnText}>+ Place Spy</Text>
          </TouchableOpacity>
        </View>

        {spies.length === 0 ? (
          <EmptyState
            icon="🕵️"
            title="No Active Spies"
            subtitle="Place spies to gather intelligence on rivals"
          />
        ) : (
          spies.map((spy) => (
            <Card key={spy.id} style={styles.spyCard}>
              <View style={styles.spyHeader}>
                <View>
                  <Text style={styles.spyName}>{spy.employee_name}</Text>
                  <Text style={styles.spyTarget}>Target: {spy.target_name}</Text>
                </View>
                <StatusBadge status={spy.status} />
              </View>
              <StatBar
                label="Discovery Risk"
                value={spy.discovery_risk}
                color={spy.discovery_risk > 70 ? '#ef4444' : spy.discovery_risk > 40 ? '#eab308' : '#22c55e'}
              />
            </Card>
          ))
        )}
      </View>

      {/* Intel Market */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Intel Market</Text>
        {market.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No Intel Available"
            subtitle="Check back later for available intelligence"
          />
        ) : (
          market.map((item) => (
            <Card key={item.id} style={styles.intelCard}>
              <View style={styles.intelHeader}>
                <Text style={styles.intelTitle}>{item.title}</Text>
                <Badge
                  label={item.quality}
                  variant={item.quality === 'HIGH' ? 'green' : item.quality === 'MEDIUM' ? 'yellow' : 'gray'}
                />
              </View>
              <Text style={styles.intelDesc}>{item.description}</Text>
              <View style={styles.intelFooter}>
                <Text style={styles.intelSource}>{item.source_type}</Text>
                <Text style={styles.intelPrice}>{formatCurrency(item.price)}</Text>
              </View>
            </Card>
          ))
        )}
      </View>

      {/* Place Spy Modal */}
      <Modal visible={showPlaceSpy} transparent animationType="fade" onRequestClose={() => setShowPlaceSpy(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowPlaceSpy(false)}>
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            <Text style={styles.dialogTitle}>Place Spy</Text>
            <Text style={styles.dialogSubtext}>Select an employee and target player</Text>
            <TextInput
              style={styles.input}
              placeholder="Employee ID..."
              placeholderTextColor="#6b7280"
              value={spyEmployeeId}
              onChangeText={setSpyEmployeeId}
            />
            <TextInput
              style={styles.input}
              placeholder="Target Player ID..."
              placeholderTextColor="#6b7280"
              value={targetPlayerId}
              onChangeText={setTargetPlayerId}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowPlaceSpy(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, alignItems: 'center' as const }, (!spyEmployeeId || !targetPlayerId) && styles.disabledBtn]}
                onPress={() => placeSpyMutation.mutate({ spy_employee_id: spyEmployeeId, target_player_id: targetPlayerId })}
                disabled={!spyEmployeeId || !targetPlayerId || placeSpyMutation.isPending}
              >
                <Text style={styles.primaryBtnText}>
                  {placeSpyMutation.isPending ? 'Placing...' : 'Place Spy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 20 },
  headerActions: { marginTop: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 12 },
  primaryBtn: { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { color: '#030712', fontWeight: '700', fontSize: 13 },
  disabledBtn: { opacity: 0.5 },
  counterIntelBtn: { backgroundColor: '#0c1a2e', borderWidth: 1, borderColor: '#3b82f6', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  counterIntelBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 13 },
  spyCard: { marginBottom: 10 },
  spyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  spyName: { fontSize: 15, fontWeight: '700', color: '#f9fafb' },
  spyTarget: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  intelCard: { marginBottom: 10 },
  intelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  intelTitle: { fontSize: 15, fontWeight: '600', color: '#f9fafb', flex: 1, marginRight: 8 },
  intelDesc: { fontSize: 13, color: '#9ca3af', lineHeight: 18, marginBottom: 10 },
  intelFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intelSource: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  intelPrice: { fontSize: 14, fontWeight: '700', color: '#22c55e' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#111827', borderRadius: 14, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#1f2937' },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 4 },
  dialogSubtext: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  input: { backgroundColor: '#0a0f1a', borderWidth: 1, borderColor: '#1f2937', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#f9fafb', fontSize: 15, marginBottom: 12 },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  cancelBtnText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },
});
