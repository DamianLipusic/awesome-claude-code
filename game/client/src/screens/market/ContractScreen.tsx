import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../lib/api';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { formatTimestamp } from '../../lib/format';
import type { TradeContract, PaginatedResponse } from '@economy-game/shared';

type Tab = 'my' | 'open';

interface Resource {
  id: string;
  name: string;
  category: string;
  tier: number;
  illegal: boolean;
  current_ai_price: number;
}

const CITIES = ['Ironport', 'Duskfield', 'Ashvale', 'Coldmarsh', 'Farrow'] as const;

function CreateContractModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [qty, setQty] = useState('100');
  const [price, setPrice] = useState('');
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [duration, setDuration] = useState('7');
  const [city, setCity] = useState<string>('Ironport');

  const { data: resources, isLoading: resLoading } = useQuery<Resource[]>({
    queryKey: ['market', 'resources'],
    queryFn: () => api.get<Resource[]>('/market/resources'),
    enabled: visible,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.post('/contracts', {
        resource_id: selectedResource!.id,
        quantity_per_period: parseInt(qty, 10),
        price_per_unit: parseFloat(price),
        period,
        duration_periods: parseInt(duration, 10),
        delivery_city: city,
      }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
      onClose();
      resetForm();
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create contract');
    },
  });

  const resetForm = () => {
    setSelectedResource(null);
    setQty('100');
    setPrice('');
    setPeriod('DAILY');
    setDuration('7');
    setCity('Ironport');
  };

  const handleCreate = () => {
    if (!selectedResource) {
      Alert.alert('Validation', 'Please select a resource.');
      return;
    }
    const qtyNum = parseInt(qty, 10);
    const priceNum = parseFloat(price);
    const durNum = parseInt(duration, 10);
    if (!qtyNum || qtyNum <= 0) {
      Alert.alert('Validation', 'Enter a valid quantity per period.');
      return;
    }
    if (!priceNum || priceNum <= 0) {
      Alert.alert('Validation', 'Enter a valid price per unit.');
      return;
    }
    if (!durNum || durNum <= 0) {
      Alert.alert('Validation', 'Enter a valid duration.');
      return;
    }
    const totalValue = qtyNum * priceNum * durNum;
    Alert.alert(
      'Confirm Contract',
      `Post a ${period.toLowerCase()} contract for ${qtyNum.toLocaleString()} × ${selectedResource.name} @ ${formatCurrency(priceNum)} for ${durNum} periods.\n\nTotal value: ${formatCurrency(totalValue)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create', onPress: () => mutation.mutate() },
      ]
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const suggestedPrice = selectedResource ? selectedResource.current_ai_price * 0.9 : 0;

  // Group resources by category
  const grouped: Record<string, Resource[]> = {};
  for (const r of resources ?? []) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={mStyles.container}>
        <View style={mStyles.header}>
          <Text style={mStyles.title}>Create Trade Contract</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={mStyles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={mStyles.body} showsVerticalScrollIndicator={false}>
          {/* Resource picker */}
          <Text style={mStyles.label}>Resource</Text>
          {resLoading ? (
            <ActivityIndicator color="#22c55e" style={{ marginVertical: 12 }} />
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <View key={cat}>
                <Text style={mStyles.categoryLabel}>{cat}</Text>
                <View style={mStyles.resourceGrid}>
                  {items.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        mStyles.resourceChip,
                        selectedResource?.id === r.id && mStyles.resourceChipSelected,
                        r.illegal && mStyles.resourceChipIllegal,
                      ]}
                      onPress={() => {
                        setSelectedResource(r);
                        if (!price) setPrice(String((r.current_ai_price * 0.9).toFixed(2)));
                      }}
                    >
                      <Text style={[mStyles.resourceChipText, selectedResource?.id === r.id && mStyles.resourceChipTextSelected]}>
                        {r.illegal ? '🔴 ' : ''}{r.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))
          )}

          {selectedResource && (
            <View style={mStyles.priceHint}>
              <Text style={mStyles.priceHintText}>
                AI price: {formatCurrency(selectedResource.current_ai_price)} · Suggested: {formatCurrency(suggestedPrice)}
              </Text>
            </View>
          )}

          {/* Period */}
          <Text style={mStyles.label}>Period</Text>
          <View style={mStyles.segmentRow}>
            {(['DAILY', 'WEEKLY'] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[mStyles.segmentBtn, period === p && mStyles.segmentBtnActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[mStyles.segmentText, period === p && mStyles.segmentTextActive]}>
                  {p === 'DAILY' ? 'Daily' : 'Weekly'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Numeric fields */}
          <View style={mStyles.fieldsRow}>
            <View style={mStyles.fieldHalf}>
              <Text style={mStyles.label}>Qty / Period</Text>
              <TextInput
                style={mStyles.input}
                value={qty}
                onChangeText={setQty}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor="#4b5563"
              />
            </View>
            <View style={mStyles.fieldHalf}>
              <Text style={mStyles.label}>Price / Unit ($)</Text>
              <TextInput
                style={mStyles.input}
                value={price}
                onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#4b5563"
              />
            </View>
          </View>

          <Text style={mStyles.label}>Duration ({period === 'DAILY' ? 'days' : 'weeks'})</Text>
          <View style={mStyles.durationRow}>
            {(period === 'DAILY' ? [3, 7, 14, 30] : [1, 2, 4, 8]).map((d) => (
              <TouchableOpacity
                key={d}
                style={[mStyles.durationChip, duration === String(d) && mStyles.durationChipActive]}
                onPress={() => setDuration(String(d))}
              >
                <Text style={[mStyles.durationChipText, duration === String(d) && mStyles.durationChipTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
            <TextInput
              style={[mStyles.input, { flex: 1, minWidth: 60 }]}
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              placeholder="Custom"
              placeholderTextColor="#4b5563"
            />
          </View>

          {/* Delivery city */}
          <Text style={mStyles.label}>Delivery City</Text>
          <View style={mStyles.cityRow}>
            {CITIES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[mStyles.cityBtn, city === c && mStyles.cityBtnActive]}
                onPress={() => setCity(c)}
              >
                <Text style={[mStyles.cityBtnText, city === c && mStyles.cityBtnTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary */}
          {selectedResource && parseFloat(price) > 0 && parseInt(qty, 10) > 0 && parseInt(duration, 10) > 0 && (
            <View style={mStyles.summary}>
              <View style={mStyles.summaryRow}>
                <Text style={mStyles.summaryLabel}>Per Period Value</Text>
                <Text style={mStyles.summaryValue}>
                  {formatCurrency(parseInt(qty, 10) * parseFloat(price))}
                </Text>
              </View>
              <View style={mStyles.summaryRow}>
                <Text style={mStyles.summaryLabel}>Total Contract Value</Text>
                <Text style={[mStyles.summaryValue, { color: '#22c55e' }]}>
                  {formatCurrency(parseInt(qty, 10) * parseFloat(price) * parseInt(duration, 10))}
                </Text>
              </View>
              <View style={mStyles.summaryRow}>
                <Text style={mStyles.summaryLabel}>Duration</Text>
                <Text style={mStyles.summaryValue}>
                  {duration} {period === 'DAILY' ? 'days' : 'weeks'}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[mStyles.createBtn, mutation.isPending && mStyles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#030712" />
            ) : (
              <Text style={mStyles.createBtnText}>Post Contract Offer</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function ContractCard({
  contract,
  showAccept,
  onAccept,
}: {
  contract: TradeContract;
  showAccept?: boolean;
  onAccept?: (id: string) => void;
}) {
  const periodsLeft = contract.duration_periods - contract.periods_completed;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.resourceName}>{contract.resource_name ?? contract.resource_id}</Text>
        <StatusBadge status={contract.status} />
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Qty / Period</Text>
          <Text style={styles.detailValue}>{contract.quantity_per_period.toLocaleString()}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Price / Unit</Text>
          <Text style={[styles.detailValue, styles.greenText]}>
            {formatCurrency(contract.price_per_unit)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Period</Text>
          <Text style={styles.detailValue}>{contract.period}</Text>
        </View>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Remaining</Text>
          <Text style={styles.detailValue}>{periodsLeft} periods</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.footerLeft}>
          {contract.counterparty_username ? (
            <Text style={styles.partyText}>with {contract.counterparty_username}</Text>
          ) : (
            <Text style={styles.partyText}>
              by {contract.initiator_username ?? 'Unknown'}
            </Text>
          )}
          {contract.next_settlement && (
            <Text style={styles.settlementText}>
              Next settlement: {formatTimestamp(contract.next_settlement)}
            </Text>
          )}
        </View>
        <View style={styles.footerRight}>
          {contract.price_locked && <Badge label="LOCKED" variant="blue" />}
          {contract.auto_renew && <Badge label="AUTO-RENEW" variant="green" />}
        </View>
      </View>

      {showAccept && contract.status === 'PENDING' && (
        <TouchableOpacity
          style={styles.acceptButton}
          onPress={() => onAccept?.(contract.id)}
        >
          <Text style={styles.acceptButtonText}>Accept Contract</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function ContractScreen() {
  const [tab, setTab] = useState<Tab>('my');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: myContracts, isLoading: myLoading, refetch: refetchMy } = useQuery<PaginatedResponse<TradeContract>>({
    queryKey: ['contracts', 'my'],
    queryFn: () => api.get<PaginatedResponse<TradeContract>>('/contracts/my?limit=30'),
    enabled: tab === 'my',
  });

  const { data: openContracts, isLoading: openLoading, refetch: refetchOpen } = useQuery<PaginatedResponse<TradeContract>>({
    queryKey: ['contracts', 'open'],
    queryFn: () => api.get<PaginatedResponse<TradeContract>>('/contracts/open?limit=30'),
    enabled: tab === 'open',
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.post(`/contracts/${id}/accept`),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to accept contract');
    },
  });

  const handleAccept = (id: string) => {
    Alert.alert('Accept Contract', 'Are you sure you want to accept this trade contract?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: () => acceptMutation.mutate(id),
      },
    ]);
  };

  const currentData = tab === 'my' ? myContracts : openContracts;
  const currentLoading = tab === 'my' ? myLoading : openLoading;
  const currentRefetch = tab === 'my' ? refetchMy : refetchOpen;
  const items = currentData?.items ?? [];

  return (
    <View style={styles.screen}>
      {/* Tab bar */}
      <View style={styles.tabs}>
        {(['my', 'open'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'my' ? 'My Contracts' : 'Open Offers'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {currentLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingSkeleton rows={4} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="📋"
          title={tab === 'my' ? 'No contracts yet' : 'No open offers'}
          subtitle={
            tab === 'my'
              ? 'Create a trade contract to start recurring trade deals'
              : 'No open contract offers available right now'
          }
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContractCard
              contract={item}
              showAccept={tab === 'open'}
              onAccept={handleAccept}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={currentRefetch}
              tintColor="#22c55e"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <Text style={styles.fabText}>＋ Create Contract</Text>
      </TouchableOpacity>

      <CreateContractModal visible={showCreate} onClose={() => setShowCreate(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#22c55e',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#22c55e',
  },
  loadingContainer: {
    padding: 16,
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resourceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  detailItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#030712',
    borderRadius: 8,
    padding: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
  },
  greenText: {
    color: '#22c55e',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  footerLeft: {
    flex: 1,
  },
  partyText: {
    fontSize: 13,
    color: '#9ca3af',
  },
  settlementText: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  footerRight: {
    flexDirection: 'row',
    gap: 6,
  },
  acceptButton: {
    marginTop: 12,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#030712',
    fontSize: 14,
    fontWeight: '700',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: '#22c55e',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: '#030712',
    fontSize: 15,
    fontWeight: '800',
  },
});

const mStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#f9fafb' },
  closeBtn: { fontSize: 20, color: '#6b7280', padding: 4 },
  body: { flex: 1, padding: 20 },
  label: {
    fontSize: 13, fontWeight: '600', color: '#9ca3af',
    letterSpacing: 0.5, marginBottom: 8, marginTop: 16,
  },
  categoryLabel: {
    fontSize: 11, color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: 1, marginTop: 8, marginBottom: 4,
  },
  resourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  resourceChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: '#1f2937', backgroundColor: '#111827',
  },
  resourceChipSelected: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  resourceChipIllegal: { borderColor: '#7f1d1d' },
  resourceChipText: { fontSize: 12, fontWeight: '600', color: '#9ca3af' },
  resourceChipTextSelected: { color: '#22c55e' },
  priceHint: {
    backgroundColor: '#111827', borderRadius: 8, padding: 10,
    marginTop: 8, borderWidth: 1, borderColor: '#1f2937',
  },
  priceHintText: { fontSize: 12, color: '#6b7280' },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#1f2937', backgroundColor: '#111827', alignItems: 'center',
  },
  segmentBtnActive: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  segmentTextActive: { color: '#22c55e' },
  fieldsRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  input: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: 10, padding: 12, fontSize: 15, color: '#f9fafb',
  },
  durationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  durationChip: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    borderColor: '#1f2937', backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center',
  },
  durationChipActive: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  durationChipText: { fontSize: 14, fontWeight: '700', color: '#6b7280' },
  durationChipTextActive: { color: '#22c55e' },
  cityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#1f2937', backgroundColor: '#111827',
  },
  cityBtnActive: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  cityBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  cityBtnTextActive: { color: '#22c55e' },
  summary: {
    backgroundColor: '#111827', borderRadius: 10, padding: 16,
    marginTop: 16, borderWidth: 1, borderColor: '#1f2937', gap: 10,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: '#9ca3af' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#f9fafb' },
  createBtn: {
    backgroundColor: '#22c55e', borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 20, marginBottom: 40,
  },
  createBtnDisabled: { backgroundColor: '#1f2937', opacity: 0.6 },
  createBtnText: { color: '#030712', fontSize: 16, fontWeight: '700' },
});
