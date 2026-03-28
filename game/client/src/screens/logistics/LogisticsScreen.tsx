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

interface Route {
  id: string;
  origin: string;
  destination: string;
  type: string;
  cost: number;
  risk: number;
  time_hours: number;
}

interface Shipment {
  id: string;
  route_name: string;
  origin: string;
  destination: string;
  status: string;
  progress: number;
  departed_at: string;
  arrives_at: string;
}

interface Blockade {
  id: string;
  route_name: string;
  set_by: string;
  cost: number;
  active: boolean;
}

export function LogisticsScreen() {
  const queryClient = useQueryClient();
  const [showNewShipment, setShowNewShipment] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState('');
  const [itemsInput, setItemsInput] = useState('');

  const { data: routesData, isLoading: routesLoading, refetch } = useQuery({
    queryKey: ['logistics', 'routes'],
    queryFn: () => api.get('/logistics/routes').then((r: any) => r.data),
  });

  const { data: shipmentsData, isLoading: shipmentsLoading } = useQuery({
    queryKey: ['logistics', 'shipments'],
    queryFn: () => api.get('/logistics/shipments').then((r: any) => r.data),
  });

  const shipMutation = useMutation({
    mutationFn: (params: { route_id: string; items: string[] }) =>
      api.post('/logistics/ship', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics'] });
      setShowNewShipment(false);
      setSelectedRouteId('');
      setItemsInput('');
      Alert.alert('Success', 'Shipment dispatched!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to create shipment'),
  });

  const blockadeMutation = useMutation({
    mutationFn: (routeId: string) => api.post('/logistics/blockades', { route_id: routeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics'] });
      Alert.alert('Success', 'Blockade set!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to set blockade'),
  });

  const routes: Route[] = routesData ?? [];
  const shipments: Shipment[] = shipmentsData?.shipments ?? shipmentsData ?? [];
  const blockades: Blockade[] = shipmentsData?.blockades ?? [];
  const isLoading = routesLoading || shipmentsLoading;

  if (isLoading) return <LoadingSkeleton />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#22c55e" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Logistics & Transport</Text>
          <Text style={styles.subtitle}>{shipments.length} active shipments</Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowNewShipment(true)}>
          <Text style={styles.primaryBtnText}>+ New Shipment</Text>
        </TouchableOpacity>
      </View>

      {/* Active Shipments */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Shipments</Text>
        {shipments.length === 0 ? (
          <EmptyState icon="📦" title="No Active Shipments" subtitle="Dispatch a shipment to move goods between locations" />
        ) : (
          shipments.map((s) => (
            <Card key={s.id} style={styles.shipmentCard}>
              <View style={styles.shipmentHeader}>
                <Text style={styles.shipmentRoute}>{s.origin} → {s.destination}</Text>
                <StatusBadge status={s.status} />
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, s.progress)}%` }]} />
                </View>
                <Text style={styles.progressText}>{Math.round(s.progress)}%</Text>
              </View>
              <View style={styles.shipmentTimes}>
                <Text style={styles.timeLabel}>Departed</Text>
                <Text style={styles.timeLabel}>Arriving</Text>
              </View>
            </Card>
          ))
        )}
      </View>

      {/* Available Routes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Routes</Text>
        {routes.map((r) => (
          <Card key={r.id} style={styles.routeCard}>
            <View style={styles.routeHeader}>
              <View style={styles.routeInfo}>
                <Text style={styles.routeOrigin}>{r.origin}</Text>
                <Text style={styles.routeArrow}>→</Text>
                <Text style={styles.routeDest}>{r.destination}</Text>
              </View>
              <Badge label={r.type} variant="blue" />
            </View>
            <View style={styles.routeStats}>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatLabel}>Cost</Text>
                <Text style={styles.routeStatValue}>{formatCurrency(r.cost)}</Text>
              </View>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatLabel}>Risk</Text>
                <Text style={[styles.routeStatValue, { color: r.risk > 70 ? '#ef4444' : r.risk > 40 ? '#eab308' : '#22c55e' }]}>
                  {r.risk}%
                </Text>
              </View>
              <View style={styles.routeStat}>
                <Text style={styles.routeStatLabel}>Time</Text>
                <Text style={styles.routeStatValue}>{r.time_hours}h</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>

      {/* Blockades */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Blockades</Text>
          <TouchableOpacity
            style={styles.blockadeBtn}
            onPress={() => {
              if (routes.length > 0) {
                blockadeMutation.mutate(routes[0].id);
              }
            }}
            disabled={blockadeMutation.isPending}
          >
            <Text style={styles.blockadeBtnText}>Set Blockade ($5,000)</Text>
          </TouchableOpacity>
        </View>
        {blockades.length === 0 ? (
          <Card style={{ marginBottom: 10 }}>
            <Text style={styles.noBlockades}>No active blockades</Text>
          </Card>
        ) : (
          blockades.map((b) => (
            <Card key={b.id} style={styles.blockadeCard}>
              <View style={styles.blockadeInfo}>
                <Text style={styles.blockadeRoute}>{b.route_name}</Text>
                <Text style={styles.blockadeBy}>Set by: {b.set_by}</Text>
              </View>
              <Badge label={b.active ? 'ACTIVE' : 'INACTIVE'} variant={b.active ? 'red' : 'gray'} />
            </Card>
          ))
        )}
      </View>

      {/* New Shipment Modal */}
      <Modal visible={showNewShipment} transparent animationType="fade" onRequestClose={() => setShowNewShipment(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowNewShipment(false)}>
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            <Text style={styles.dialogTitle}>New Shipment</Text>
            <Text style={styles.dialogSubtext}>Select a route and specify items</Text>

            <Text style={styles.inputLabel}>Route</Text>
            {routes.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.routeOption, selectedRouteId === r.id && styles.routeOptionSelected]}
                onPress={() => setSelectedRouteId(r.id)}
              >
                <Text style={[styles.routeOptionText, selectedRouteId === r.id && styles.routeOptionTextSelected]}>
                  {r.origin} → {r.destination} ({formatCurrency(r.cost)})
                </Text>
              </TouchableOpacity>
            ))}

            <Text style={[styles.inputLabel, { marginTop: 12 }]}>Items (comma-separated)</Text>
            <TextInput
              style={styles.input}
              placeholder="item1, item2..."
              placeholderTextColor="#6b7280"
              value={itemsInput}
              onChangeText={setItemsInput}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowNewShipment(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, alignItems: 'center' as const }, (!selectedRouteId || !itemsInput) && styles.disabledBtn]}
                onPress={() => {
                  const items = itemsInput.split(',').map((i) => i.trim()).filter(Boolean);
                  shipMutation.mutate({ route_id: selectedRouteId, items });
                }}
                disabled={!selectedRouteId || !itemsInput || shipMutation.isPending}
              >
                <Text style={styles.primaryBtnText}>
                  {shipMutation.isPending ? 'Dispatching...' : 'Dispatch'}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 12 },
  primaryBtn: { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { color: '#030712', fontWeight: '700', fontSize: 13 },
  disabledBtn: { opacity: 0.5 },
  shipmentCard: { marginBottom: 10 },
  shipmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  shipmentRoute: { fontSize: 15, fontWeight: '700', color: '#f9fafb' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#1f2937', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#22c55e' },
  progressText: { fontSize: 12, fontWeight: '700', color: '#22c55e', width: 40, textAlign: 'right' },
  shipmentTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  timeLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  routeCard: { marginBottom: 8 },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  routeInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  routeOrigin: { fontSize: 14, fontWeight: '600', color: '#f9fafb' },
  routeArrow: { fontSize: 14, color: '#6b7280' },
  routeDest: { fontSize: 14, fontWeight: '600', color: '#f9fafb' },
  routeStats: { flexDirection: 'row', justifyContent: 'space-between' },
  routeStat: { alignItems: 'center' },
  routeStatLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 3 },
  routeStatValue: { fontSize: 14, fontWeight: '700', color: '#d1d5db' },
  blockadeBtn: { backgroundColor: '#1a0505', borderWidth: 1, borderColor: '#ef4444', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  blockadeBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  blockadeCard: { marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  blockadeInfo: { flex: 1 },
  blockadeRoute: { fontSize: 14, fontWeight: '600', color: '#f9fafb' },
  blockadeBy: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  noBlockades: { fontSize: 13, color: '#6b7280', textAlign: 'center', paddingVertical: 8 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#111827', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#1f2937', maxHeight: '80%' },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 4 },
  dialogSubtext: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  inputLabel: { fontSize: 12, color: '#9ca3af', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#0a0f1a', borderWidth: 1, borderColor: '#1f2937', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#f9fafb', fontSize: 15, marginBottom: 12 },
  routeOption: { backgroundColor: '#0a0f1a', borderWidth: 1, borderColor: '#1f2937', borderRadius: 8, padding: 12, marginBottom: 6 },
  routeOptionSelected: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  routeOptionText: { fontSize: 13, color: '#d1d5db' },
  routeOptionTextSelected: { color: '#22c55e', fontWeight: '600' },
  modalBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  cancelBtnText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },
});
