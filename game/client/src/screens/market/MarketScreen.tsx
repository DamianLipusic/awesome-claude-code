import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { api } from '../../lib/api';
import { useMarketStore } from '../../stores/marketStore';
import { useWebSocketChannel } from '../../hooks/useWebSocket';
import { Card } from '../../components/ui/Card';
import { Badge, StatusBadge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import type { MarketListing, ResourceCategory, PaginatedResponse } from '@economy-game/shared';
import { CITIES } from '@economy-game/shared';

export type MarketStackParamList = {
  MarketMain: undefined;
  CreateListing: undefined;
  ContractScreen: undefined;
};

type NavProp = StackNavigationProp<MarketStackParamList, 'MarketMain'>;

const CATEGORIES: Array<{ label: string; value: ResourceCategory | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Raw', value: 'RAW_MATERIAL' },
  { label: 'Processed', value: 'PROCESSED_GOOD' },
  { label: 'Luxury', value: 'LUXURY' },
  { label: 'Illegal', value: 'ILLEGAL' },
];

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
          <Text
            style={[
              styles.cityBtnText,
              selectedCity === city.name && styles.cityBtnTextActive,
            ]}
          >
            {city.name}
          </Text>
          <Text style={styles.citySize}>{city.size}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function CategoryTabs() {
  const { selectedCategory, setCategory } = useMarketStore();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.categoriesContainer}
    >
      {CATEGORIES.map((cat) => (
        <TouchableOpacity
          key={cat.value}
          style={[
            styles.categoryTab,
            selectedCategory === cat.value && styles.categoryTabActive,
          ]}
          onPress={() => setCategory(cat.value)}
        >
          <Text
            style={[
              styles.categoryTabText,
              selectedCategory === cat.value && styles.categoryTabTextActive,
            ]}
          >
            {cat.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function ListingCard({
  listing,
  onBuy,
}: {
  listing: MarketListing;
  onBuy: (listing: MarketListing) => void;
}) {
  const isAI = listing.listing_type === 'AI_SELL' || listing.listing_type === 'AI_BUY';
  const isBuy = listing.listing_type === 'AI_BUY' || listing.listing_type === 'PLAYER_BUY';

  return (
    <View style={styles.listingCard}>
      <View style={styles.listingHeader}>
        <View style={styles.listingLeft}>
          <Text style={styles.resourceName}>{listing.resource_name ?? listing.resource_id}</Text>
          <View style={styles.listingMeta}>
            {isAI ? (
              <Badge label="SYSTEM" variant="gray" />
            ) : (
              <View style={styles.sellerInfo}>
                <Text style={styles.sellerName}>
                  {listing.is_anonymous ? 'Anonymous' : (listing.seller_username ?? 'Unknown')}
                </Text>
              </View>
            )}
            <StatusBadge status={listing.status} />
          </View>
        </View>
        <View style={styles.listingRight}>
          <Text style={styles.price}>{formatCurrency(listing.price_per_unit)}/unit</Text>
          <Text style={styles.quantity}>
            {listing.quantity_remaining.toLocaleString()} remaining
          </Text>
        </View>
      </View>

      {!isBuy && listing.status === 'OPEN' && (
        <TouchableOpacity
          style={styles.buyButton}
          onPress={() => onBuy(listing)}
        >
          <Text style={styles.buyButtonText}>Buy</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function MarketScreen() {
  const { selectedCity, selectedCategory, updatePrices } = useMarketStore();
  const queryClient = useQueryClient();

  // Listen for real-time price updates
  useWebSocketChannel(`market:${selectedCity}`, (data) => {
    updatePrices(data as Parameters<typeof updatePrices>[0]);
    queryClient.invalidateQueries({ queryKey: ['listings', selectedCity, selectedCategory] });
  });

  const { data, isLoading, refetch, isRefetching } = useQuery<PaginatedResponse<MarketListing>>({
    queryKey: ['listings', selectedCity, selectedCategory],
    queryFn: () =>
      api.get<PaginatedResponse<MarketListing>>(
        `/market/listings?city=${selectedCity}${selectedCategory !== 'ALL' ? `&category=${selectedCategory}` : ''}&limit=50`
      ),
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const buyMutation = useMutation({
    mutationFn: ({ listingId, quantity }: { listingId: string; quantity: number }) =>
      api.post(`/market/listings/${listingId}/buy`, { quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
    },
  });

  const handleBuy = useCallback(
    (listing: MarketListing) => {
      Alert.prompt(
        `Buy ${listing.resource_name}`,
        `Price: ${formatCurrency(listing.price_per_unit)}/unit\nAvailable: ${listing.quantity_remaining}\nEnter quantity:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Buy',
            onPress: (qty) => {
              const quantity = parseInt(qty ?? '0', 10);
              if (!quantity || quantity <= 0) return;
              buyMutation.mutate({ listingId: listing.id, quantity });
            },
          },
        ],
        'plain-text',
        '1'
      );
    },
    [buyMutation]
  );

  const listings = data?.items ?? [];

  return (
    <View style={styles.screen}>
      {/* Header controls */}
      <View style={styles.controls}>
        <CitySelector />
        <CategoryTabs />
      </View>

      {/* Listing count */}
      {!isLoading && (
        <Text style={styles.listingCount}>{listings.length} listings in {selectedCity}</Text>
      )}

      {isLoading ? (
        <ScrollView contentContainerStyle={styles.loadingContent}>
          <LoadingSkeleton rows={6} />
        </ScrollView>
      ) : listings.length === 0 ? (
        <EmptyState
          icon="🏪"
          title="No listings found"
          subtitle={`No ${selectedCategory !== 'ALL' ? selectedCategory.toLowerCase().replace('_', ' ') + ' ' : ''}listings in ${selectedCity}`}
        />
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListingCard listing={item} onBuy={handleBuy} />
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* FAB — Create Listing */}
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>＋ List Item</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030712',
  },
  controls: {
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    paddingBottom: 8,
  },
  citiesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  cityBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    alignItems: 'center',
    minWidth: 80,
  },
  cityBtnActive: {
    backgroundColor: '#052e16',
    borderColor: '#22c55e',
  },
  cityBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9ca3af',
  },
  cityBtnTextActive: {
    color: '#22c55e',
  },
  citySize: {
    fontSize: 9,
    color: '#4b5563',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  categoriesContainer: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 6,
  },
  categoryTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  categoryTabActive: {
    backgroundColor: '#0c1a2e',
    borderColor: '#3b82f6',
  },
  categoryTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  categoryTabTextActive: {
    color: '#3b82f6',
  },
  listingCount: {
    fontSize: 12,
    color: '#4b5563',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  loadingContent: {
    padding: 16,
  },
  separator: {
    height: 8,
  },
  listingCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
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
  resourceName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerName: {
    fontSize: 12,
    color: '#9ca3af',
  },
  listingRight: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#22c55e',
  },
  quantity: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  buyButton: {
    marginTop: 10,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  buyButtonText: {
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
