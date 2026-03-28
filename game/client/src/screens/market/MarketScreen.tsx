import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../lib/api';
import { useMarketStore } from '../../stores/marketStore';
import { useWebSocketChannel } from '../../hooks/useWebSocket';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { formatCurrency } from '../../components/ui/CurrencyText';
import type { MarketListing, ResourceCategory } from '@economy-game/shared';
import { CITIES } from '@economy-game/shared';

export type MarketStackParamList = {
  MarketMain: undefined;
  CreateListing: undefined;
  ContractScreen: undefined;
};

type NavProp = StackNavigationProp<MarketStackParamList, 'MarketMain'>;

// ─── Theme ─────────────────────────────────────────────────
const T = {
  bg: '#0a0a0f',
  card: '#1a1a2e',
  cardBorder: '#2d2d4a',
  primary: '#6c5ce7',
  success: '#00d2d3',
  error: '#ff6b6b',
  text: '#e0e0e0',
  muted: '#a0a0b0',
  dimmed: '#5a5a70',
  surface: '#12121e',
};

// ─── Types ─────────────────────────────────────────────────
interface MarketStat {
  resource_id: string;
  resource_name: string;
  category: string;
  base_value: number;
  current_price: number;
  price_24h_ago?: number;
  direction?: 'up' | 'down' | 'stable';
  volume_24h: number;
  price_change_percent: number;
  high_24h: number;
  low_24h: number;
  value_signal?: 'underpriced' | 'fair' | 'overpriced';
  price_vs_fair_pct?: number;
}

interface RecentTrade {
  id: string;
  resource_name: string;
  traded_quantity: number;
  price_per_unit: number;
  listing_type: string;
  filled_at: string;
  city: string;
  trader: string;
}

const CATEGORIES: Array<{ label: string; value: ResourceCategory | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Raw', value: 'RAW_MATERIAL' },
  { label: 'Processed', value: 'PROCESSED_GOOD' },
  { label: 'Luxury', value: 'LUXURY' },
  { label: 'Illegal', value: 'ILLEGAL' },
];

// ─── Utility ───────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function categoryBadgeColor(cat: string): string {
  switch (cat) {
    case 'RAW_MATERIAL': return '#f59e0b';
    case 'PROCESSED_GOOD': return '#3b82f6';
    case 'LUXURY': return '#a855f7';
    case 'ILLEGAL': return '#ef4444';
    case 'SERVICE': return '#10b981';
    default: return T.muted;
  }
}

function categoryShortLabel(cat: string): string {
  switch (cat) {
    case 'RAW_MATERIAL': return 'RAW';
    case 'PROCESSED_GOOD': return 'MFG';
    case 'LUXURY': return 'LUX';
    case 'ILLEGAL': return 'ILL';
    case 'SERVICE': return 'SVC';
    default: return cat;
  }
}

// ─── Price Ticker Bar ──────────────────────────────────────
function PriceTickerBar({ stats }: { stats: MarketStat[] }) {
  if (!stats.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tickerContainer}
    >
      {stats.map((s) => {
        const isUp = s.price_change_percent >= 0;
        return (
          <View key={s.resource_id} style={styles.tickerItem}>
            <Text style={styles.tickerName} numberOfLines={1}>{s.resource_name}</Text>
            <Text style={styles.tickerPrice}>{formatCurrency(s.current_price)}</Text>
            <Text style={[styles.tickerChange, { color: isUp ? T.success : T.error }]}>
              {isUp ? '\u25B2' : '\u25BC'} {Math.abs(s.price_change_percent).toFixed(1)}%
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

// ─── City Selector ─────────────────────────────────────────
function CitySelector() {
  const { selectedCity, setCity } = useMarketStore();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.citiesContainer}
    >
      {CITIES.map((city) => (
        <TouchableOpacity
          key={city.name}
          style={[styles.cityBtn, selectedCity === city.name && styles.cityBtnActive]}
          onPress={() => setCity(city.name)}
        >
          <Text style={[styles.cityBtnText, selectedCity === city.name && styles.cityBtnTextActive]}>
            {city.name}
          </Text>
          <Text style={styles.citySize}>{city.size}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Resource Card ─────────────────────────────────────────
function ResourceCard({ stat, onBuy, onSell }: { stat: MarketStat; onBuy: () => void; onSell: () => void }) {
  const isUp = stat.price_change_percent >= 0;
  const lowPct = 25;
  const avgPct = 50;
  const highPct = 25;

  return (
    <View style={styles.resourceCard}>
      <View style={styles.resourceHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.resourceTitleRow}>
            <Text style={styles.resourceName}>{stat.resource_name}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: categoryBadgeColor(stat.category) + '22', borderColor: categoryBadgeColor(stat.category) }]}>
              <Text style={[styles.categoryBadgeText, { color: categoryBadgeColor(stat.category) }]}>
                {categoryShortLabel(stat.category)}
              </Text>
            </View>
          </View>
          <Text style={[styles.priceChange, { color: isUp ? T.success : T.error }]}>
            {isUp ? '+' : ''}{stat.price_change_percent.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.resourcePriceBlock}>
          <Text style={styles.resourceCurrentPrice}>{formatCurrency(stat.current_price)}</Text>
        </View>
      </View>

      <View style={styles.resourceMeta}>
        <Text style={styles.metaText}>Vol: {stat.volume_24h.toLocaleString()}</Text>
        <Text style={styles.metaDivider}>|</Text>
        <Text style={styles.metaText}>H: {formatCurrency(stat.high_24h)}</Text>
        <Text style={styles.metaDivider}>/</Text>
        <Text style={styles.metaText}>L: {formatCurrency(stat.low_24h)}</Text>
        {stat.value_signal && stat.value_signal !== 'fair' && (
          <>
            <Text style={styles.metaDivider}>|</Text>
            <Text style={[styles.metaText, {
              color: stat.value_signal === 'underpriced' ? T.success : T.error,
              fontWeight: '700',
            }]}>
              {stat.value_signal === 'underpriced' ? 'BUY' : 'SELL'}
            </Text>
          </>
        )}
      </View>

      {/* Mini bar indicator */}
      <View style={styles.miniBarContainer}>
        <View style={[styles.miniBar, styles.miniBarLow, { flex: lowPct }]} />
        <View style={[styles.miniBar, styles.miniBarAvg, { flex: avgPct }]} />
        <View style={[styles.miniBar, styles.miniBarHigh, { flex: highPct }]} />
      </View>

      <View style={styles.resourceActions}>
        <TouchableOpacity style={styles.buyBtn} onPress={onBuy}>
          <Text style={styles.buyBtnText}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.sellBtn} onPress={onSell}>
          <Text style={styles.sellBtnText}>Sell</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Listing Card ──────────────────────────────────────────
function ListingCard({
  listing,
  onBuy,
}: {
  listing: MarketListing;
  onBuy: (listing: MarketListing) => void;
}) {
  const isAI = listing.listing_type === 'AI_SELL' || listing.listing_type === 'AI_BUY';
  const isBuyOrder = listing.listing_type === 'AI_BUY' || listing.listing_type === 'PLAYER_BUY';

  const expiresIn = listing.expires_at
    ? timeAgo(listing.expires_at).replace(' ago', ' left').replace('just now', 'expiring')
    : '';

  return (
    <View style={styles.listingCard}>
      <View style={styles.listingHeader}>
        <View style={styles.listingLeft}>
          <Text style={styles.listingResource}>{listing.resource_name ?? listing.resource_id}</Text>
          <Text style={styles.listingSeller}>
            {isAI ? 'AI Market' : (listing.is_anonymous ? 'Anonymous' : (listing.seller_username ?? 'Unknown'))}
          </Text>
        </View>
        <View style={styles.listingRight}>
          <Text style={styles.listingPrice}>{formatCurrency(listing.price_per_unit)}/u</Text>
          <Text style={styles.listingQty}>{listing.quantity_remaining.toLocaleString()} avail</Text>
          {expiresIn ? <Text style={styles.listingExpiry}>{expiresIn}</Text> : null}
        </View>
      </View>
      {!isBuyOrder && listing.status === 'OPEN' && (
        <TouchableOpacity style={styles.listingBuyBtn} onPress={() => onBuy(listing)}>
          <Text style={styles.listingBuyBtnText}>Buy</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Recent Trade Item ─────────────────────────────────────
function TradeItem({ trade }: { trade: RecentTrade }) {
  const isSell = trade.listing_type === 'AI_SELL' || trade.listing_type === 'PLAYER_SELL';
  return (
    <View style={styles.tradeItem}>
      <Text style={styles.tradeText} numberOfLines={1}>
        <Text style={{ color: T.text, fontWeight: '600' }}>{trade.trader}</Text>
        {' '}{isSell ? 'sold' : 'bought'}{' '}
        <Text style={{ color: T.success, fontWeight: '600' }}>{trade.traded_quantity}</Text>
        {' '}{trade.resource_name} @ {formatCurrency(trade.price_per_unit)}
      </Text>
      <Text style={styles.tradeTime}>{timeAgo(trade.filled_at)}</Text>
    </View>
  );
}

// ─── Buy Modal ─────────────────────────────────────────────
function BuyModal({
  visible,
  listing,
  onClose,
  onConfirm,
  isPending,
}: {
  visible: boolean;
  listing: MarketListing | null;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  isPending: boolean;
}) {
  const [qty, setQty] = useState('1');

  useEffect(() => {
    if (visible) setQty('1');
  }, [visible]);

  const parsedQty = parseInt(qty, 10) || 0;
  const total = (listing?.price_per_unit ?? 0) * parsedQty;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Buy {listing?.resource_name ?? 'Resource'}</Text>

          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Price per unit</Text>
            <Text style={styles.modalValue}>{formatCurrency(listing?.price_per_unit ?? 0)}</Text>
          </View>
          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Available</Text>
            <Text style={styles.modalValue}>{listing?.quantity_remaining?.toLocaleString() ?? 0}</Text>
          </View>

          <Text style={styles.modalInputLabel}>Quantity</Text>
          <TextInput
            style={styles.modalInput}
            value={qty}
            onChangeText={setQty}
            keyboardType="number-pad"
            placeholder="Enter quantity"
            placeholderTextColor={T.dimmed}
            autoFocus
          />

          <View style={styles.modalRow}>
            <Text style={styles.modalLabel}>Total cost</Text>
            <Text style={[styles.modalValue, { color: T.success }]}>{formatCurrency(total)}</Text>
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, isPending && { opacity: 0.5 }]}
              onPress={() => { if (parsedQty > 0) onConfirm(parsedQty); }}
              disabled={isPending || parsedQty <= 0}
            >
              {isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalConfirmText}>Confirm Buy</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────
export function MarketScreen() {
  const navigation = useNavigation<NavProp>();
  const { selectedCity, selectedCategory, setCategory, updatePrices } = useMarketStore();
  const queryClient = useQueryClient();

  const [listingTab, setListingTab] = useState<'SELL' | 'BUY'>('SELL');
  const [buyModalListing, setBuyModalListing] = useState<MarketListing | null>(null);

  // WebSocket
  useWebSocketChannel(`market:${selectedCity}`, (data) => {
    updatePrices(data as Parameters<typeof updatePrices>[0]);
    queryClient.invalidateQueries({ queryKey: ['listings', selectedCity] });
    queryClient.invalidateQueries({ queryKey: ['market-stats', selectedCity] });
  });

  // ── Queries ──
  const statsQuery = useQuery<MarketStat[]>({
    queryKey: ['market-stats', selectedCity],
    queryFn: async () => {
      const res = await api.get<MarketStat[]>(`/market/stats?city=${selectedCity}`);
      return res ?? [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const listingsQuery = useQuery<MarketListing[]>({
    queryKey: ['listings', selectedCity],
    queryFn: async () => {
      const res = await api.get<MarketListing[]>(`/market/listings?city=${selectedCity}`);
      return res ?? [];
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const tradesQuery = useQuery<RecentTrade[]>({
    queryKey: ['recent-trades', selectedCity],
    queryFn: async () => {
      const res = await api.get<RecentTrade[]>(`/market/recent-trades?city=${selectedCity}&limit=10`);
      return res ?? [];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // ── Mutations ──
  const buyMutation = useMutation({
    mutationFn: ({ listingId, quantity }: { listingId: string; quantity: number }) =>
      api.post(`/market/listings/${listingId}/buy`, { quantity }),
    onSuccess: () => {
      setBuyModalListing(null);
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['market-stats'] });
      queryClient.invalidateQueries({ queryKey: ['recent-trades'] });
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
    },
  });

  const handleBuyListing = useCallback((listing: MarketListing) => {
    setBuyModalListing(listing);
  }, []);

  const handleConfirmBuy = useCallback((quantity: number) => {
    if (!buyModalListing) return;
    buyMutation.mutate({ listingId: buyModalListing.id, quantity });
  }, [buyModalListing, buyMutation]);

  // ── Derived data ──
  const allStats = statsQuery.data ?? [];
  const filteredStats = selectedCategory === 'ALL'
    ? allStats
    : allStats.filter((s) => s.category === selectedCategory);

  const allListings = listingsQuery.data ?? [];
  const filteredListings = allListings.filter((l) => {
    const matchesTab = listingTab === 'SELL'
      ? (l.listing_type === 'AI_SELL' || l.listing_type === 'PLAYER_SELL')
      : (l.listing_type === 'AI_BUY' || l.listing_type === 'PLAYER_BUY');
    const matchesCategory = selectedCategory === 'ALL' || (l as any).resource_category === selectedCategory;
    return matchesTab && matchesCategory;
  });

  const trades = tradesQuery.data ?? [];
  const isLoading = statsQuery.isLoading && listingsQuery.isLoading;

  return (
    <View style={styles.screen}>
      {/* Price Ticker */}
      <PriceTickerBar stats={allStats} />

      {/* City Selector */}
      <CitySelector />

      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.categoryTab, selectedCategory === cat.value && styles.categoryTabActive]}
            onPress={() => setCategory(cat.value)}
          >
            <Text style={[styles.categoryTabText, selectedCategory === cat.value && styles.categoryTabTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <LoadingSkeleton rows={6} />
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={statsQuery.isRefetching || listingsQuery.isRefetching}
              onRefresh={() => {
                statsQuery.refetch();
                listingsQuery.refetch();
                tradesQuery.refetch();
              }}
              tintColor={T.primary}
            />
          }
        >
          {/* Section: Resource Cards */}
          <Text style={styles.sectionTitle}>Resources</Text>
          {filteredStats.length === 0 ? (
            <Text style={styles.emptyText}>No resource data available</Text>
          ) : (
            filteredStats.map((stat) => (
              <ResourceCard
                key={stat.resource_id}
                stat={stat}
                onBuy={() => {
                  const sellListing = allListings.find(
                    (l) =>
                      l.resource_id === stat.resource_id &&
                      (l.listing_type === 'AI_SELL' || l.listing_type === 'PLAYER_SELL') &&
                      l.status === 'OPEN',
                  );
                  if (sellListing) setBuyModalListing(sellListing);
                }}
                onSell={() => navigation.navigate('CreateListing')}
              />
            ))
          )}

          {/* Section: Active Listings */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Listings</Text>
            <View style={styles.listingToggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, listingTab === 'SELL' && styles.toggleBtnActive]}
                onPress={() => setListingTab('SELL')}
              >
                <Text style={[styles.toggleBtnText, listingTab === 'SELL' && styles.toggleBtnTextActive]}>Sell Orders</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, listingTab === 'BUY' && styles.toggleBtnActive]}
                onPress={() => setListingTab('BUY')}
              >
                <Text style={[styles.toggleBtnText, listingTab === 'BUY' && styles.toggleBtnTextActive]}>Buy Orders</Text>
              </TouchableOpacity>
            </View>
          </View>

          {filteredListings.length === 0 ? (
            <Text style={styles.emptyText}>No {listingTab.toLowerCase()} orders in {selectedCity}</Text>
          ) : (
            filteredListings.slice(0, 20).map((listing) => (
              <ListingCard key={listing.id} listing={listing} onBuy={handleBuyListing} />
            ))
          )}

          {/* Section: Recent Trades */}
          <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Recent Trades</Text>
          {trades.length === 0 ? (
            <Text style={styles.emptyText}>No recent trades</Text>
          ) : (
            trades.map((trade) => <TradeItem key={trade.id} trade={trade} />)
          )}

          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      {/* Buy Modal */}
      <BuyModal
        visible={buyModalListing !== null}
        listing={buyModalListing}
        onClose={() => setBuyModalListing(null)}
        onConfirm={handleConfirmBuy}
        isPending={buyMutation.isPending}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateListing')}>
        <Text style={styles.fabText}>+ List Item</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bg,
  },

  // Ticker
  tickerContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 2,
    borderBottomWidth: 1,
    borderBottomColor: T.cardBorder,
  },
  tickerItem: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    minWidth: 80,
  },
  tickerName: {
    fontSize: 10,
    fontWeight: '600',
    color: T.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tickerPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: T.text,
    marginTop: 1,
  },
  tickerChange: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },

  // Cities
  citiesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  cityBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.cardBorder,
    alignItems: 'center',
    minWidth: 80,
  },
  cityBtnActive: {
    backgroundColor: T.primary + '20',
    borderColor: T.primary,
  },
  cityBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.muted,
  },
  cityBtnTextActive: {
    color: T.primary,
  },
  citySize: {
    fontSize: 9,
    color: T.dimmed,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  // Categories
  categoriesContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  categoryTabActive: {
    backgroundColor: T.primary + '20',
    borderColor: T.primary,
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: T.dimmed,
  },
  categoryTabTextActive: {
    color: T.primary,
  },

  // Scroll content
  scrollContent: {
    padding: 12,
    paddingBottom: 80,
  },

  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: T.text,
    marginBottom: 10,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 13,
    color: T.dimmed,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Resource Cards
  resourceCard: {
    backgroundColor: T.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  resourceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  resourceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  resourceName: {
    fontSize: 15,
    fontWeight: '700',
    color: T.text,
  },
  categoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  priceChange: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  resourcePriceBlock: {
    alignItems: 'flex-end',
  },
  resourceCurrentPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: T.text,
  },
  resourceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: T.muted,
  },
  metaDivider: {
    fontSize: 11,
    color: T.dimmed,
    marginHorizontal: 2,
  },

  // Mini bar
  miniBarContainer: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
    gap: 2,
  },
  miniBar: {
    height: 4,
    borderRadius: 2,
  },
  miniBarLow: {
    backgroundColor: T.error + '60',
  },
  miniBarAvg: {
    backgroundColor: T.primary + '80',
  },
  miniBarHigh: {
    backgroundColor: T.success + '60',
  },

  // Resource actions
  resourceActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  buyBtn: {
    flex: 1,
    backgroundColor: T.success + '20',
    borderWidth: 1,
    borderColor: T.success,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buyBtnText: {
    color: T.success,
    fontSize: 14,
    fontWeight: '700',
  },
  sellBtn: {
    flex: 1,
    backgroundColor: T.error + '20',
    borderWidth: 1,
    borderColor: T.error,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sellBtnText: {
    color: T.error,
    fontSize: 14,
    fontWeight: '700',
  },

  // Listing toggle
  listingToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  toggleBtnActive: {
    backgroundColor: T.primary + '20',
    borderColor: T.primary,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: T.dimmed,
  },
  toggleBtnTextActive: {
    color: T.primary,
  },

  // Listing cards
  listingCard: {
    backgroundColor: T.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  listingLeft: {
    flex: 1,
    marginRight: 12,
  },
  listingResource: {
    fontSize: 14,
    fontWeight: '700',
    color: T.text,
  },
  listingSeller: {
    fontSize: 11,
    color: T.muted,
    marginTop: 2,
  },
  listingRight: {
    alignItems: 'flex-end',
  },
  listingPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: T.success,
  },
  listingQty: {
    fontSize: 11,
    color: T.muted,
    marginTop: 1,
  },
  listingExpiry: {
    fontSize: 10,
    color: T.dimmed,
    marginTop: 1,
  },
  listingBuyBtn: {
    marginTop: 8,
    backgroundColor: T.primary,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: 'center',
  },
  listingBuyBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Trade feed
  tradeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  tradeText: {
    flex: 1,
    fontSize: 12,
    color: T.muted,
  },
  tradeTime: {
    fontSize: 10,
    color: T.dimmed,
    minWidth: 40,
    textAlign: 'right',
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: T.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: T.cardBorder,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: T.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: T.muted,
  },
  modalValue: {
    fontSize: 14,
    fontWeight: '700',
    color: T.text,
  },
  modalInputLabel: {
    fontSize: 12,
    color: T.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: T.bg,
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    color: T.text,
    borderWidth: 1,
    borderColor: T.cardBorder,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: T.cardBorder,
    alignItems: 'center',
  },
  modalCancelText: {
    color: T.muted,
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: T.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    backgroundColor: T.primary,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: T.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
