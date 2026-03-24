import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { formatTimestamp } from '../../lib/format';
import type { TradeContract, PaginatedResponse } from '@economy-game/shared';

type Tab = 'my' | 'open';

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
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>＋ Create Contract</Text>
      </TouchableOpacity>
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
