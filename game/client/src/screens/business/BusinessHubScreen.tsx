import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { StatBar } from '../../components/ui/StatBar';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import type { Business } from '@economy-game/shared';

export type BusinessStackParamList = {
  BusinessHub: undefined;
  BusinessDetail: { businessId: string };
  EmployeeMarket: { businessId: string };
};

type NavProp = NativeStackNavigationProp<BusinessStackParamList, 'BusinessHub'>;

const BUSINESS_TYPE_ICONS: Record<string, string> = {
  RETAIL: '🏪',
  FACTORY: '🏭',
  MINE: '⛏️',
  FARM: '🌾',
  LOGISTICS: '🚚',
  SECURITY_FIRM: '🛡️',
  FRONT_COMPANY: '🎭',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e',
  IDLE: '#6b7280',
  RAIDED: '#ef4444',
  BANKRUPT: '#ef4444',
  SUSPENDED: '#eab308',
};

function BusinessCard({
  business,
  onPress,
}: {
  business: Business;
  onPress: () => void;
}) {
  const icon = BUSINESS_TYPE_ICONS[business.type] ?? '🏢';
  const statusColor = STATUS_COLORS[business.status] ?? '#6b7280';
  const capacityPercent = (business.capacity / business.storage_cap) * 100;
  const dailyPnl = business.total_revenue - business.total_expenses;

  return (
    <TouchableOpacity style={styles.businessCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.businessIcon}>{icon}</Text>
          <View>
            <Text style={styles.businessName} numberOfLines={1}>
              {business.name}
            </Text>
            <Text style={styles.businessType}>{business.type.replace(/_/g, ' ')}</Text>
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <StatusBadge status={business.status} />
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>City</Text>
          <Text style={styles.statValue}>{business.city}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Tier</Text>
          <Text style={styles.statValue}>{business.tier}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Daily P&L</Text>
          <Text style={[styles.statValue, { color: dailyPnl >= 0 ? '#22c55e' : '#ef4444' }]}>
            {dailyPnl >= 0 ? '+' : ''}{formatCurrency(dailyPnl)}
          </Text>
        </View>
      </View>

      <StatBar
        label="Capacity"
        value={capacityPercent}
        color={capacityPercent > 80 ? '#f97316' : '#3b82f6'}
        showValue={false}
      />
      <StatBar label="Efficiency" value={business.efficiency * 100} color="#22c55e" />

      {business.is_front && (
        <View style={styles.frontBadge}>
          <Text style={styles.frontBadgeText}>🎭 Front Company</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export function BusinessHubScreen() {
  const navigation = useNavigation<NavProp>();
  const player = useAuthStore((s) => s.player);

  const { data: businesses, isLoading, refetch, isRefetching } = useQuery<Business[]>({
    queryKey: ['businesses'],
    queryFn: () => api.get<Business[]>('/businesses'),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });

  const usedSlots = businesses?.length ?? 0;
  const maxSlots = player?.business_slots ?? 1;
  const atLimit = usedSlots >= maxSlots;

  const handleAddBusiness = () => {
    if (atLimit) {
      const nextSlotNetWorth = maxSlots * 50000;
      Alert.alert(
        'Slot Limit Reached',
        `You can unlock the next slot by reaching a net worth of ${formatCurrency(nextSlotNetWorth)}.`
      );
      return;
    }
    Alert.alert('Add Business', 'Business creation flow coming soon.');
  };

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}>
          <LoadingSkeleton rows={4} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Businesses</Text>
          <Text style={styles.headerSlots}>
            {usedSlots}/{maxSlots} slots used
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, atLimit && styles.addButtonDisabled]}
          onPress={handleAddBusiness}
        >
          <Text style={[styles.addButtonText, atLimit && styles.addButtonTextDisabled]}>
            + Add Business
          </Text>
        </TouchableOpacity>
      </View>

      {(businesses ?? []).length === 0 ? (
        <EmptyState
          icon="🏢"
          title="No businesses yet"
          subtitle="Start your first business to begin generating income and building your empire."
          action={
            <TouchableOpacity style={styles.addButton} onPress={handleAddBusiness}>
              <Text style={styles.addButtonText}>+ Add First Business</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <BusinessCard
              business={item}
              onPress={() =>
                navigation.navigate('BusinessDetail', { businessId: item.id })
              }
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#22c55e"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  headerSlots: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  addButton: {
    backgroundColor: '#052e16',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addButtonDisabled: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  addButtonText: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '700',
  },
  addButtonTextDisabled: {
    color: '#4b5563',
  },
  businessCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  businessIcon: {
    fontSize: 28,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    maxWidth: 180,
  },
  businessType: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: '#030712',
    borderRadius: 8,
    padding: 8,
  },
  statLabel: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#d1d5db',
  },
  frontBadge: {
    marginTop: 10,
    backgroundColor: '#2e1065',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  frontBadgeText: {
    fontSize: 11,
    color: '#a855f7',
    fontWeight: '600',
  },
});
