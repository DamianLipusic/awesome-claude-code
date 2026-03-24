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
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { StatBar } from '../../components/ui/StatBar';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import type { Business } from '@economy-game/shared';
import { BUSINESS_BASE_COSTS } from '@economy-game/shared';

export type BusinessStackParamList = {
  BusinessHub: undefined;
  BusinessDetail: { businessId: string };
  EmployeeMarket: { businessId: string };
};

type NavProp = StackNavigationProp<BusinessStackParamList, 'BusinessHub'>;

const BUSINESS_TYPES = [
  { type: 'RETAIL', icon: '🏪', label: 'Retail' },
  { type: 'FACTORY', icon: '🏭', label: 'Factory' },
  { type: 'MINE', icon: '⛏️', label: 'Mine' },
  { type: 'FARM', icon: '🌾', label: 'Farm' },
  { type: 'LOGISTICS', icon: '🚚', label: 'Logistics' },
  { type: 'SECURITY_FIRM', icon: '🛡️', label: 'Security Firm' },
  { type: 'FRONT_COMPANY', icon: '🎭', label: 'Front Company' },
] as const;

const CITIES = ['Ironport', 'Duskfield', 'Ashvale', 'Coldmarsh', 'Farrow'] as const;

const BUSINESS_TYPE_ICONS: Record<string, string> = {
  RETAIL: '🏪', FACTORY: '🏭', MINE: '⛏️', FARM: '🌾',
  LOGISTICS: '🚚', SECURITY_FIRM: '🛡️', FRONT_COMPANY: '🎭',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#22c55e', IDLE: '#6b7280', RAIDED: '#ef4444',
  BANKRUPT: '#ef4444', SUSPENDED: '#eab308',
};

function CreateBusinessModal({
  visible,
  onClose,
  playerCash,
}: {
  visible: boolean;
  onClose: () => void;
  playerCash: number;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<string>('RETAIL');
  const [selectedCity, setSelectedCity] = useState<string>('Ironport');

  const cost = BUSINESS_BASE_COSTS[selectedType as keyof typeof BUSINESS_BASE_COSTS];
  const canAfford = playerCash >= cost.startup;

  const mutation = useMutation({
    mutationFn: () => api.post('/businesses', {
      name: name.trim(),
      type: selectedType,
      city: selectedCity,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setName('');
      setSelectedType('RETAIL');
      setSelectedCity('Ironport');
      onClose();
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create business');
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Please enter a business name.');
      return;
    }
    if (!canAfford) {
      Alert.alert('Insufficient Funds', `You need ${formatCurrency(cost.startup)} to open this business.`);
      return;
    }
    Alert.alert(
      'Confirm Purchase',
      `Open ${name.trim()} (${selectedType.replace(/_/g, ' ')}) in ${selectedCity} for ${formatCurrency(cost.startup)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Business', onPress: () => mutation.mutate() },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Open New Business</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={modalStyles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
          {/* Name */}
          <Text style={modalStyles.label}>Business Name</Text>
          <TextInput
            style={modalStyles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Iron Works Co."
            placeholderTextColor="#4b5563"
            maxLength={50}
          />

          {/* Type */}
          <Text style={modalStyles.label}>Business Type</Text>
          <View style={modalStyles.grid}>
            {BUSINESS_TYPES.map(({ type, icon, label }) => {
              const c = BUSINESS_BASE_COSTS[type as keyof typeof BUSINESS_BASE_COSTS];
              return (
                <TouchableOpacity
                  key={type}
                  style={[modalStyles.typeCard, selectedType === type && modalStyles.typeCardSelected]}
                  onPress={() => setSelectedType(type)}
                >
                  <Text style={modalStyles.typeIcon}>{icon}</Text>
                  <Text style={[modalStyles.typeLabel, selectedType === type && modalStyles.typeLabelSelected]}>
                    {label}
                  </Text>
                  <Text style={modalStyles.typeCost}>{formatCurrency(c.startup)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* City */}
          <Text style={modalStyles.label}>City</Text>
          <View style={modalStyles.cityRow}>
            {CITIES.map((city) => (
              <TouchableOpacity
                key={city}
                style={[modalStyles.cityBtn, selectedCity === city && modalStyles.cityBtnSelected]}
                onPress={() => setSelectedCity(city)}
              >
                <Text style={[modalStyles.cityBtnText, selectedCity === city && modalStyles.cityBtnTextSelected]}>
                  {city}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary */}
          <View style={modalStyles.summary}>
            <View style={modalStyles.summaryRow}>
              <Text style={modalStyles.summaryLabel}>Startup Cost</Text>
              <Text style={[modalStyles.summaryValue, !canAfford && { color: '#ef4444' }]}>
                {formatCurrency(cost.startup)}
              </Text>
            </View>
            <View style={modalStyles.summaryRow}>
              <Text style={modalStyles.summaryLabel}>Daily Operating</Text>
              <Text style={modalStyles.summaryValue}>{formatCurrency(cost.daily_operating)}/day</Text>
            </View>
            <View style={modalStyles.summaryRow}>
              <Text style={modalStyles.summaryLabel}>Your Cash</Text>
              <Text style={[modalStyles.summaryValue, { color: canAfford ? '#22c55e' : '#ef4444' }]}>
                {formatCurrency(playerCash)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[modalStyles.createBtn, (!canAfford || mutation.isPending) && modalStyles.createBtnDisabled]}
            onPress={handleCreate}
            disabled={!canAfford || mutation.isPending}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#030712" />
            ) : (
              <Text style={modalStyles.createBtnText}>
                {canAfford ? `Open Business — ${formatCurrency(cost.startup)}` : 'Insufficient Funds'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function BusinessCard({ business, onPress }: { business: Business; onPress: () => void }) {
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
            <Text style={styles.businessName} numberOfLines={1}>{business.name}</Text>
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

      <StatBar label="Capacity" value={capacityPercent} color={capacityPercent > 80 ? '#f97316' : '#3b82f6'} showValue={false} />
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
  const [showCreate, setShowCreate] = useState(false);

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
      Alert.alert('Slot Limit Reached', `Reach a net worth of ${formatCurrency(nextSlotNetWorth)} to unlock the next slot.`);
      return;
    }
    setShowCreate(true);
  };

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <View style={styles.content}><LoadingSkeleton rows={4} /></View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Businesses</Text>
          <Text style={styles.headerSlots}>{usedSlots}/{maxSlots} slots used</Text>
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
          subtitle="Start your first business to begin generating income."
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
              onPress={() => navigation.navigate('BusinessDetail', { businessId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      <CreateBusinessModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        playerCash={player?.cash ?? 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb' },
  headerSlots: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  content: { padding: 16 },
  listContent: { padding: 12, paddingBottom: 32 },
  addButton: {
    backgroundColor: '#052e16', borderWidth: 1, borderColor: '#22c55e',
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
  },
  addButtonDisabled: { backgroundColor: '#1f2937', borderColor: '#374151' },
  addButtonText: { color: '#22c55e', fontSize: 13, fontWeight: '700' },
  addButtonTextDisabled: { color: '#4b5563' },
  businessCard: {
    backgroundColor: '#111827', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1f2937',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  businessIcon: { fontSize: 28 },
  businessName: { fontSize: 16, fontWeight: '700', color: '#f9fafb', maxWidth: 180 },
  businessType: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statsRow: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  stat: { flex: 1, backgroundColor: '#030712', borderRadius: 8, padding: 8 },
  statLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  statValue: { fontSize: 12, fontWeight: '700', color: '#d1d5db' },
  frontBadge: {
    marginTop: 10, backgroundColor: '#2e1065', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
  },
  frontBadgeText: { fontSize: 11, color: '#a855f7', fontWeight: '600' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#f9fafb' },
  closeBtn: { fontSize: 20, color: '#6b7280', padding: 4 },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#9ca3af', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: 10, padding: 14, fontSize: 16, color: '#f9fafb',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
    borderRadius: 10, padding: 12, alignItems: 'center', minWidth: '30%', flex: 1,
  },
  typeCardSelected: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  typeIcon: { fontSize: 24, marginBottom: 4 },
  typeLabel: { fontSize: 11, fontWeight: '600', color: '#9ca3af', textAlign: 'center' },
  typeLabelSelected: { color: '#22c55e' },
  typeCost: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  cityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#1f2937', backgroundColor: '#111827',
  },
  cityBtnSelected: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  cityBtnText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  cityBtnTextSelected: { color: '#22c55e' },
  summary: {
    backgroundColor: '#111827', borderRadius: 10, padding: 16,
    marginTop: 20, borderWidth: 1, borderColor: '#1f2937', gap: 10,
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
