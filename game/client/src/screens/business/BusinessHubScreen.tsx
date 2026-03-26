import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
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
import { useToast } from '../../components/Toast';

export type BusinessStackParamList = {
  BusinessHub: undefined;
  BusinessDetail: { businessId: string };
  EmployeeMarket: { businessId: string };
  ManagerMarket: { businessId: string };
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

const TYPE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  RETAIL: { bg: '#1a2e1a', text: '#4ade80' },
  FACTORY: { bg: '#2e2a1a', text: '#fbbf24' },
  MINE: { bg: '#1a1a2e', text: '#818cf8' },
  FARM: { bg: '#1a2e2a', text: '#2dd4bf' },
  LOGISTICS: { bg: '#2e1a1a', text: '#f97316' },
  SECURITY_FIRM: { bg: '#1a2e2e', text: '#22d3ee' },
  FRONT_COMPANY: { bg: '#2e1a2e', text: '#c084fc' },
};

const TIER_COLORS: Record<number, string> = {
  1: '#666666',
  2: '#4a9eff',
  3: '#6c5ce7',
  4: '#ffd700',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#00d2d3', IDLE: '#ffa502', RAIDED: '#ff6b6b',
  BANKRUPT: '#ff6b6b', SUSPENDED: '#ffa502',
};

interface BusinessListing {
  id: string;
  name: string;
  type: string;
  district_name: string;
  foot_traffic: number;
  asking_price: number;
  size_sqm: number;
  tier: number;
  city: string;
}

function ListingCard({ listing, onBuy }: { listing: BusinessListing; onBuy: () => void }) {
  const icon = BUSINESS_TYPE_ICONS[listing.type] ?? '🏢';
  const typeColors = TYPE_BADGE_COLORS[listing.type] ?? { bg: '#1a1a2e', text: '#a0a0b0' };
  const tierColor = TIER_COLORS[listing.tier] ?? '#666666';

  return (
    <View style={[listingStyles.card, { borderColor: tierColor + '40' }]}>
      <View style={listingStyles.cardTop}>
        <View style={listingStyles.nameRow}>
          <Text style={listingStyles.icon}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={listingStyles.name} numberOfLines={1}>{listing.name}</Text>
            <View style={[listingStyles.typeBadge, { backgroundColor: typeColors.bg }]}>
              <Text style={[listingStyles.typeText, { color: typeColors.text }]}>
                {listing.type.replace(/_/g, ' ')}
              </Text>
            </View>
          </View>
        </View>
        <Text style={listingStyles.price}>{formatCurrency(listing.asking_price)}</Text>
      </View>

      <View style={listingStyles.detailRow}>
        <Text style={listingStyles.detail}>📍 {listing.district_name}</Text>
        <Text style={listingStyles.detail}>📐 {listing.size_sqm} sqm</Text>
      </View>

      <View style={listingStyles.footTrafficRow}>
        <Text style={listingStyles.footLabel}>Foot Traffic</Text>
        <View style={listingStyles.footBarTrack}>
          <View style={[listingStyles.footBarFill, { width: `${listing.foot_traffic}%` as `${number}%` }]} />
        </View>
        <Text style={listingStyles.footValue}>{listing.foot_traffic}%</Text>
      </View>

      <TouchableOpacity style={listingStyles.buyBtn} onPress={onBuy} activeOpacity={0.8}>
        <Text style={listingStyles.buyBtnText}>Buy Business</Text>
      </TouchableOpacity>
    </View>
  );
}

function CreateBusinessModal({
  visible, onClose, playerCash,
}: { visible: boolean; onClose: () => void; playerCash: number }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [selectedType, setSelectedType] = useState<string>('RETAIL');
  const [selectedCity, setSelectedCity] = useState<string>('Ironport');
  const cost = BUSINESS_BASE_COSTS[selectedType as keyof typeof BUSINESS_BASE_COSTS];
  const canAfford = playerCash >= cost.startup;

  const mutation = useMutation({
    mutationFn: () => api.post('/businesses', { name: name.trim(), type: selectedType, city: selectedCity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setName(''); setSelectedType('RETAIL'); setSelectedCity('Ironport'); onClose();
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Failed to create business', 'error'); },
  });

  const handleCreate = () => {
    if (!name.trim()) { toast.show('Please enter a business name.', 'warning'); return; }
    if (!canAfford) { toast.show('Insufficient funds: need ' + formatCurrency(cost.startup), 'error'); return; }
    mutation.mutate();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Open New Business</Text>
          <TouchableOpacity onPress={onClose}><Text style={modalStyles.closeBtn}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView style={modalStyles.body} showsVerticalScrollIndicator={false}>
          <Text style={modalStyles.label}>Business Name</Text>
          <TextInput style={modalStyles.input} value={name} onChangeText={setName} placeholder="e.g. Iron Works Co." placeholderTextColor="#4b5563" maxLength={50} />
          <Text style={modalStyles.label}>Business Type</Text>
          <View style={modalStyles.grid}>
            {BUSINESS_TYPES.map(({ type, icon, label }) => {
              const c = BUSINESS_BASE_COSTS[type as keyof typeof BUSINESS_BASE_COSTS];
              return (
                <TouchableOpacity key={type} style={[modalStyles.typeCard, selectedType === type && modalStyles.typeCardSelected]} onPress={() => setSelectedType(type)}>
                  <Text style={modalStyles.typeIcon}>{icon}</Text>
                  <Text style={[modalStyles.typeLabel, selectedType === type && modalStyles.typeLabelSelected]}>{label}</Text>
                  <Text style={modalStyles.typeCost}>{formatCurrency(c.startup)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={modalStyles.label}>City</Text>
          <View style={modalStyles.cityRow}>
            {CITIES.map((city) => (
              <TouchableOpacity key={city} style={[modalStyles.cityBtn, selectedCity === city && modalStyles.cityBtnSelected]} onPress={() => setSelectedCity(city)}>
                <Text style={[modalStyles.cityBtnText, selectedCity === city && modalStyles.cityBtnTextSelected]}>{city}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={modalStyles.summary}>
            <View style={modalStyles.summaryRow}><Text style={modalStyles.summaryLabel}>Startup Cost</Text><Text style={[modalStyles.summaryValue, !canAfford && { color: '#ff6b6b' }]}>{formatCurrency(cost.startup)}</Text></View>
            <View style={modalStyles.summaryRow}><Text style={modalStyles.summaryLabel}>Daily Operating</Text><Text style={modalStyles.summaryValue}>{formatCurrency(cost.daily_operating)}/day</Text></View>
            <View style={modalStyles.summaryRow}><Text style={modalStyles.summaryLabel}>Your Cash</Text><Text style={[modalStyles.summaryValue, { color: canAfford ? '#00d2d3' : '#ff6b6b' }]}>{formatCurrency(playerCash)}</Text></View>
          </View>
          <TouchableOpacity style={[modalStyles.createBtn, (!canAfford || mutation.isPending) && modalStyles.createBtnDisabled]} onPress={handleCreate} disabled={!canAfford || mutation.isPending}>
            {mutation.isPending ? <ActivityIndicator color="#0a0a0f" /> : (
              <Text style={modalStyles.createBtnText}>{canAfford ? 'Open Business — ' + formatCurrency(cost.startup) : 'Insufficient Funds'}</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function BusinessCard({ business, onPress }: { business: Business; onPress: () => void }) {
  const icon = BUSINESS_TYPE_ICONS[business.type] ?? '🏢';
  const statusColor = STATUS_COLORS[business.status] ?? '#a0a0b0';
  const tierColor = TIER_COLORS[business.tier] ?? '#666666';
  const typeColors = TYPE_BADGE_COLORS[business.type] ?? { bg: '#1a1a2e', text: '#a0a0b0' };
  const employeeCount = (business as any).employee_count ?? 0;
  const maxEmployees = (business as any).max_employees ?? (business.tier * 5);
  const managerName = (business as any).manager_name ?? null;
  const districtName = (business as any).district_name ?? null;
  const districtTier = (business as any).district_tier ?? null;
  const footTraffic = (business as any).foot_traffic ?? 0;
  const revenuePerTick = (business as any).revenue_per_tick ?? business.total_revenue;

  return (
    <TouchableOpacity style={[styles.businessCard, { borderLeftWidth: 3, borderLeftColor: tierColor }]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.businessIcon}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.businessName} numberOfLines={1}>{business.name}</Text>
            <View style={[styles.typeBadge, { backgroundColor: typeColors.bg }]}>
              <Text style={[styles.typeText, { color: typeColors.text }]}>{business.type.replace(/_/g, ' ')}</Text>
            </View>
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '60' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{business.status}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.tierStrip, { borderColor: tierColor + '40' }]}>
        <Text style={[styles.tierLabel, { color: tierColor }]}>T{business.tier}</Text>
        <View style={styles.tierDivider} />
        <Text style={styles.infoItem}>👥 {employeeCount}/{maxEmployees}</Text>
        <View style={styles.tierDivider} />
        <Text style={managerName ? styles.infoItem : styles.infoItemMuted}>👔 {managerName ?? 'No Manager'}</Text>
      </View>

      <View style={styles.districtRow}>
        <Text style={styles.districtText}>📍 {districtName ?? business.city}{districtTier ? ' (T' + districtTier + ')' : ''}</Text>
      </View>

      <View style={styles.footTrafficRow}>
        <Text style={styles.footLabel}>Foot Traffic</Text>
        <View style={styles.footBarTrack}>
          <View style={[styles.footBarFill, { width: `${Math.min(100, footTraffic)}%` as `${number}%`, backgroundColor: footTraffic > 70 ? '#00d2d3' : footTraffic > 40 ? '#ffa502' : '#ff6b6b' }]} />
        </View>
        <Text style={styles.footValue}>{footTraffic}%</Text>
      </View>

      <View style={styles.revenueRow}>
        <Text style={styles.revenueLabel}>Revenue</Text>
        <Text style={styles.revenueValue}>{formatCurrency(revenuePerTick)}/tick</Text>
      </View>

      {business.is_front && (
        <View style={styles.frontBadge}><Text style={styles.frontBadgeText}>🎭 Front Company</Text></View>
      )}
    </TouchableOpacity>
  );
}

export function BusinessHubScreen() {
  const navigation = useNavigation<NavProp>();
  const player = useAuthStore((s) => s.player);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data: businesses, isLoading, refetch, isRefetching } = useQuery<Business[]>({
    queryKey: ['businesses'],
    queryFn: () => api.get<Business[]>('/businesses'),
    staleTime: 15_000, refetchInterval: 60_000,
  });

  const currentCity = (player as any)?.current_city ?? 'Ironport';
  const { data: listings } = useQuery<BusinessListing[]>({
    queryKey: ['business-listings', currentCity],
    queryFn: () => api.get<BusinessListing[]>('/business-listings?city=' + currentCity),
    staleTime: 60_000,
  });

  const buyMutation = useMutation({
    mutationFn: (listingId: string) => api.post('/business-listings/' + listingId + '/buy'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business-listings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.show('Business purchased successfully!', 'success');
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Failed to buy business', 'error'); },
  });

  const usedSlots = businesses?.length ?? 0;
  const maxSlots = player?.business_slots ?? 1;
  const atLimit = usedSlots >= maxSlots;

  const handleAddBusiness = () => {
    if (atLimit) { toast.show('Reach net worth of ' + formatCurrency(maxSlots * 50000) + ' to unlock next slot.', 'warning'); return; }
    setShowCreate(true);
  };

  if (isLoading) return <View style={styles.screen}><View style={styles.content}><LoadingSkeleton rows={4} /></View></View>;

  const hasListings = (listings ?? []).length > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Your Businesses</Text>
          <Text style={styles.headerSlots}>{usedSlots}/{maxSlots} slots used</Text>
        </View>
        <TouchableOpacity style={[styles.addButton, atLimit && styles.addButtonDisabled]} onPress={handleAddBusiness}>
          <Text style={[styles.addButtonText, atLimit && styles.addButtonTextDisabled]}>+ New Business</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00d2d3" />}>

        {hasListings && (
          <View style={styles.saleSection}>
            <Text style={styles.saleSectionTitle}>🏪 Businesses For Sale</Text>
            <Text style={styles.saleSectionSubtitle}>Available in {currentCity}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {(listings ?? []).map((listing) => (
                <ListingCard key={listing.id} listing={listing} onBuy={() => buyMutation.mutate(listing.id)} />
              ))}
            </ScrollView>
          </View>
        )}

        {(businesses ?? []).length === 0 ? (
          <EmptyState icon="🏢" title="No businesses yet" subtitle="Start your first business to begin generating income."
            action={<TouchableOpacity style={styles.addButton} onPress={handleAddBusiness}><Text style={styles.addButtonText}>+ Add First Business</Text></TouchableOpacity>} />
        ) : (
          (businesses ?? []).map((biz) => (
            <BusinessCard key={biz.id} business={biz} onPress={() => navigation.navigate('BusinessDetail', { businessId: biz.id })} />
          ))
        )}
      </ScrollView>

      <CreateBusinessModal visible={showCreate} onClose={() => setShowCreate(false)} playerCash={player?.cash ?? 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a3e', backgroundColor: '#12121a' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#e0e0e0' },
  headerSlots: { fontSize: 12, color: '#a0a0b0', marginTop: 2 },
  content: { padding: 16 },
  listContent: { padding: 12, paddingBottom: 32, gap: 10 },
  addButton: { backgroundColor: '#1a0a2e', borderWidth: 1, borderColor: '#6c5ce7', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonDisabled: { backgroundColor: '#1a1a2e', borderColor: '#2a2a3e' },
  addButtonText: { color: '#6c5ce7', fontSize: 13, fontWeight: '700' },
  addButtonTextDisabled: { color: '#a0a0b0' },
  saleSection: { marginBottom: 20 },
  saleSectionTitle: { fontSize: 16, fontWeight: '700', color: '#e0e0e0', marginBottom: 2 },
  saleSectionSubtitle: { fontSize: 12, color: '#a0a0b0', marginBottom: 12 },
  businessCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a3e' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  businessIcon: { fontSize: 28 },
  businessName: { fontSize: 16, fontWeight: '700', color: '#e0e0e0', maxWidth: 180 },
  typeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 3 },
  typeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  tierStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#12121a', borderRadius: 8, padding: 8, borderWidth: 1, marginBottom: 8 },
  tierLabel: { fontSize: 13, fontWeight: '800' },
  tierDivider: { width: 1, height: 14, backgroundColor: '#2a2a3e' },
  infoItem: { fontSize: 12, color: '#e0e0e0' },
  infoItemMuted: { fontSize: 12, color: '#a0a0b0' },
  districtRow: { marginBottom: 6 },
  districtText: { fontSize: 12, color: '#a0a0b0' },
  footTrafficRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  footLabel: { fontSize: 10, color: '#a0a0b0', width: 70 },
  footBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#12121a', overflow: 'hidden' },
  footBarFill: { height: '100%', borderRadius: 3 },
  footValue: { fontSize: 10, fontWeight: '700', color: '#e0e0e0', width: 32, textAlign: 'right' },
  revenueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  revenueLabel: { fontSize: 11, color: '#a0a0b0', textTransform: 'uppercase' },
  revenueValue: { fontSize: 14, fontWeight: '700', color: '#00d2d3' },
  frontBadge: { marginTop: 8, backgroundColor: '#2e1065', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start' },
  frontBadgeText: { fontSize: 11, color: '#c084fc', fontWeight: '600' },
});

const listingStyles = StyleSheet.create({
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2a3e', width: 260 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  icon: { fontSize: 24 },
  name: { fontSize: 14, fontWeight: '700', color: '#e0e0e0', maxWidth: 120 },
  typeBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 2 },
  typeText: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase' },
  price: { fontSize: 16, fontWeight: '800', color: '#ffd700' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  detail: { fontSize: 11, color: '#a0a0b0' },
  footTrafficRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  footLabel: { fontSize: 10, color: '#a0a0b0', width: 65 },
  footBarTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#12121a', overflow: 'hidden' },
  footBarFill: { height: '100%', borderRadius: 3, backgroundColor: '#00d2d3' },
  footValue: { fontSize: 10, fontWeight: '700', color: '#e0e0e0', width: 30, textAlign: 'right' },
  buyBtn: { backgroundColor: '#6c5ce7', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  buyBtnText: { color: '#e0e0e0', fontSize: 13, fontWeight: '700' },
});

const modalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  title: { fontSize: 20, fontWeight: '800', color: '#e0e0e0' },
  closeBtn: { fontSize: 20, color: '#a0a0b0', padding: 4 },
  body: { flex: 1, padding: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#a0a0b0', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 10, padding: 14, fontSize: 16, color: '#e0e0e0' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeCard: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 10, padding: 12, alignItems: 'center', minWidth: '30%', flex: 1 },
  typeCardSelected: { borderColor: '#6c5ce7', backgroundColor: '#1a0a2e' },
  typeIcon: { fontSize: 24, marginBottom: 4 },
  typeLabel: { fontSize: 11, fontWeight: '600', color: '#a0a0b0', textAlign: 'center' },
  typeLabelSelected: { color: '#6c5ce7' },
  typeCost: { fontSize: 10, color: '#a0a0b0', marginTop: 2 },
  cityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#2a2a3e', backgroundColor: '#1a1a2e' },
  cityBtnSelected: { borderColor: '#6c5ce7', backgroundColor: '#1a0a2e' },
  cityBtnText: { fontSize: 13, fontWeight: '600', color: '#a0a0b0' },
  cityBtnTextSelected: { color: '#6c5ce7' },
  summary: { backgroundColor: '#1a1a2e', borderRadius: 10, padding: 16, marginTop: 20, borderWidth: 1, borderColor: '#2a2a3e', gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: '#a0a0b0' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: '#e0e0e0' },
  createBtn: { backgroundColor: '#6c5ce7', borderRadius: 10, padding: 16, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  createBtnDisabled: { backgroundColor: '#2a2a3e', opacity: 0.6 },
  createBtnText: { color: '#0a0a0f', fontSize: 16, fontWeight: '700' },
});
