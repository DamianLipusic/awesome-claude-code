import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../components/ui/CurrencyText';

// ─── Types ─────────────────────────────────────────

interface PriceItem {
  key: string;
  name: string;
  base_price: string;
  current_price: string;
  category: string;
  production_stage: number;
}

interface MarketListing {
  id: string;
  seller_type: string;
  quantity: string;
  price_per_unit: string;
  created_at: string;
  item_key: string;
  item_name: string;
  category: string;
  base_price: string;
  production_stage: number;
}

interface Business {
  id: string;
  name: string;
  type: string;
  tier: number;
  recipe_id: string | null;
  output_item_key: string | null;
  output_item_name: string | null;
}

interface InventoryItem {
  item_id: string;
  amount: string;
  reserved: string;
  dirty_amount: string;
  key: string;
  name: string;
  category: string;
  base_price: string;
}

interface BusinessInventory {
  inventory: InventoryItem[];
  logs: unknown[];
}

interface RecipeInputInfo {
  item: string;
  name: string;
  basePrice: number;
  qtyPerUnit: number;
}

interface RecipeInfo {
  businessType: string;
  outputItem: string;
  outputName: string;
  outputPrice: number;
  baseRate: number;
  inputs: RecipeInputInfo[];
  profitPerUnit: number;
}

interface GameInfo {
  recipes: RecipeInfo[];
}

interface MyListing {
  id: string;
  quantity: string;
  price_per_unit: string;
  status: string;
  item_name: string;
  item_key: string;
  category: string;
  created_at: string;
  expires_at: string;
}

interface Contract {
  id: string;
  supplier_id: string;
  buyer_id: string;
  item_name: string;
  supplier_name: string;
  buyer_name: string;
  quantity_per_cycle: number;
  cycle_hours: number;
  price_per_unit: number;
  penalty_per_miss: number;
  cycles_completed: number;
  cycles_missed: number;
  status: string;
  next_delivery_at: string | null;
}

interface IntelPlayer {
  id: string;
  username: string;
}

interface GameItem {
  id: string;
  key: string;
  name: string;
  category: string;
}

interface BulkOrder {
  id: string;
  business_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  quantity_remaining: number;
  max_price_per_unit: number;
  buyer_name: string;
  status: string;
  created_at: string;
}

type SectionKey = 'prices' | 'buy' | 'sell' | 'listings' | 'contracts' | 'orders';

const STAGE_LABELS: Record<number, string> = {
  1: 'Raw Materials',
  2: 'Processed Goods',
  3: 'Finished Products',
};

export function MarketScreen() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [activeSection, setActiveSection] = useState<SectionKey>('prices');

  // Buy modal state
  const [buyListing, setBuyListing] = useState<MarketListing | null>(null);
  const [buyQty, setBuyQty] = useState('');
  const [buyBizId, setBuyBizId] = useState<string | null>(null);

  // Sell modal state
  const [sellBizId, setSellBizId] = useState<string | null>(null);
  const [sellItem, setSellItem] = useState<InventoryItem | null>(null);
  const [sellQty, setSellQty] = useState('');

  // Create listing modal state
  const [showCreateListing, setShowCreateListing] = useState(false);
  const [listBizId, setListBizId] = useState<string | null>(null);
  const [listItem, setListItem] = useState<InventoryItem | null>(null);
  const [listQty, setListQty] = useState('');
  const [listPrice, setListPrice] = useState('');

  // Contract modal state
  const [showCreateContract, setShowCreateContract] = useState(false);
  const [contractBuyerId, setContractBuyerId] = useState<string | null>(null);
  const [contractItemId, setContractItemId] = useState<string | null>(null);
  const [contractSupplierBizId, setContractSupplierBizId] = useState<string | null>(null);
  const [contractQty, setContractQty] = useState('');
  const [contractCycleHours, setContractCycleHours] = useState('24');
  const [contractPrice, setContractPrice] = useState('');
  const [contractPenalty, setContractPenalty] = useState('');
  const [acceptBizId, setAcceptBizId] = useState<string | null>(null);
  const [acceptContractId, setAcceptContractId] = useState<string | null>(null);

  // Bulk order state
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orderItemId, setOrderItemId] = useState<string | null>(null);
  const [orderQty, setOrderQty] = useState('');
  const [orderMaxPrice, setOrderMaxPrice] = useState('');
  const [orderBizId, setOrderBizId] = useState<string | null>(null);
  const [fillOrderId, setFillOrderId] = useState<string | null>(null);
  const [fillBizId, setFillBizId] = useState<string | null>(null);
  const [fillQty, setFillQty] = useState('');

  // ─── Queries ─────────────────────────────────────

  const { data: prices, isLoading: pricesLoading, refetch: refetchPrices, isRefetching: pricesRefetching } =
    useQuery<PriceItem[]>({
      queryKey: ['marketPrices'],
      queryFn: () => api.get<PriceItem[]>('/market/prices'),
      refetchInterval: 30000,
    });

  const { data: listings, isLoading: listingsLoading, refetch: refetchListings, isRefetching: listingsRefetching } =
    useQuery<MarketListing[]>({
      queryKey: ['marketListings'],
      queryFn: () => api.get<MarketListing[]>('/market'),
      refetchInterval: 30000,
    });

  const { data: businesses } = useQuery<Business[]>({
    queryKey: ['businesses'],
    queryFn: () => api.get<Business[]>('/businesses'),
    refetchInterval: 30000,
  });

  const { data: gameInfo } = useQuery<GameInfo>({
    queryKey: ['gameInfo'],
    queryFn: () => api.get<GameInfo>('/game/info'),
    staleTime: 5 * 60 * 1000, // static data, cache 5 min
  });

  // Inventory for the selected sell business
  const { data: sellInventory } = useQuery<BusinessInventory>({
    queryKey: ['sellInventory', sellBizId],
    queryFn: () => api.get<BusinessInventory>(`/inventory/businesses/${sellBizId}/inventory`),
    enabled: !!sellBizId,
  });

  // My listings
  const { data: myListings, isLoading: myListingsLoading, refetch: refetchMyListings, isRefetching: myListingsRefetching } =
    useQuery<MyListing[]>({
      queryKey: ['myListings'],
      queryFn: () => api.get<MyListing[]>('/market/my-listings'),
      refetchInterval: 30000,
    });

  // Inventory for create-listing modal
  const { data: listInventory } = useQuery<BusinessInventory>({
    queryKey: ['listInventory', listBizId],
    queryFn: () => api.get<BusinessInventory>(`/inventory/businesses/${listBizId}/inventory`),
    enabled: !!listBizId,
  });

  // Contracts
  const { data: myContracts, isLoading: contractsLoading, refetch: refetchContracts, isRefetching: contractsRefetching } =
    useQuery<Contract[]>({
      queryKey: ['contracts'],
      queryFn: () => api.get<Contract[]>('/contracts'),
      refetchInterval: 30000,
    });

  const { data: incomingContracts, refetch: refetchIncoming, isRefetching: incomingRefetching } =
    useQuery<Contract[]>({
      queryKey: ['contractsIncoming'],
      queryFn: () => api.get<Contract[]>('/contracts/incoming'),
      refetchInterval: 30000,
    });

  // Bulk orders
  const { data: openOrders, isLoading: ordersLoading, refetch: refetchOrders, isRefetching: ordersRefetching } =
    useQuery<BulkOrder[]>({
      queryKey: ['bulkOrders'],
      queryFn: () => api.get<BulkOrder[]>('/market/bulk-orders'),
      refetchInterval: 30000,
    });

  const { data: myOrders, refetch: refetchMyOrders, isRefetching: myOrdersRefetching } =
    useQuery<BulkOrder[]>({
      queryKey: ['myBulkOrders'],
      queryFn: () => api.get<BulkOrder[]>('/market/my-bulk-orders'),
      refetchInterval: 30000,
    });

  // Players list for contract creation
  const { data: intelPlayers } = useQuery<IntelPlayer[]>({
    queryKey: ['intelPlayers'],
    queryFn: () => api.get<IntelPlayer[]>('/intel/players'),
    enabled: showCreateContract,
  });

  // Items list for contract/order creation (from game info items)
  const { data: gameItems } = useQuery<GameItem[]>({
    queryKey: ['gameItems'],
    queryFn: async () => {
      const info = await api.get<{ items: GameItem[] }>('/game/info');
      return info.items ?? [];
    },
    enabled: showCreateContract || showCreateOrder,
  });

  const isRefetching = pricesRefetching || listingsRefetching || myListingsRefetching || contractsRefetching || incomingRefetching || ordersRefetching || myOrdersRefetching;

  const refetchAll = () => {
    refetchPrices();
    refetchListings();
    refetchMyListings();
    refetchContracts();
    refetchIncoming();
    refetchOrders();
    refetchMyOrders();
  };

  // ─── Mutations ───────────────────────────────────

  const buyMutation = useMutation({
    mutationFn: (body: { listing_id: string; quantity: number; business_id: string }) =>
      api.post<{ bought: number; total_cost: number; item_name: string }>('/market/buy', body),
    onSuccess: (data) => {
      show(`Bought ${data.bought} ${data.item_name} for ${formatCurrency(data.total_cost)}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['marketListings'] });
      queryClient.invalidateQueries({ queryKey: ['marketPrices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['sellInventory'] });
      setBuyListing(null);
      setBuyQty('');
      setBuyBizId(null);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const sellMutation = useMutation({
    mutationFn: (body: { business_id: string; item_id: string; quantity: number }) =>
      api.post<{ sold: number; revenue: number; price_per_unit: number }>('/market/sell', body),
    onSuccess: (data) => {
      show(`Sold ${data.sold} items for ${formatCurrency(data.revenue)}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['marketListings'] });
      queryClient.invalidateQueries({ queryKey: ['marketPrices'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['sellInventory'] });
      setSellItem(null);
      setSellQty('');
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const createListingMutation = useMutation({
    mutationFn: (body: { business_id: string; item_id: string; quantity: number; price_per_unit: number }) =>
      api.post<{ listing_id: string; item: string; quantity: number; price_per_unit: number }>('/market/list', body),
    onSuccess: (data) => {
      show(`Listed ${data.quantity} ${data.item} at ${formatCurrency(data.price_per_unit)}/ea`, 'success');
      queryClient.invalidateQueries({ queryKey: ['myListings'] });
      queryClient.invalidateQueries({ queryKey: ['marketListings'] });
      queryClient.invalidateQueries({ queryKey: ['listInventory'] });
      queryClient.invalidateQueries({ queryKey: ['sellInventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowCreateListing(false);
      setListItem(null);
      setListQty('');
      setListPrice('');
      setListBizId(null);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const cancelListingMutation = useMutation({
    mutationFn: (listingId: string) => api.delete(`/market/listings/${listingId}`),
    onSuccess: () => {
      show('Listing cancelled', 'success');
      queryClient.invalidateQueries({ queryKey: ['myListings'] });
      queryClient.invalidateQueries({ queryKey: ['marketListings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  // ─── Contract Mutations ─────────────────────────

  const createContractMutation = useMutation({
    mutationFn: (body: { buyer_id: string; item_id: string; supplier_business_id: string; quantity_per_cycle: number; cycle_hours: number; price_per_unit: number; penalty_per_miss: number }) =>
      api.post('/contracts/offer', body),
    onSuccess: () => {
      show('Contract offer sent!', 'success');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setShowCreateContract(false);
      setContractBuyerId(null);
      setContractItemId(null);
      setContractSupplierBizId(null);
      setContractQty('');
      setContractPrice('');
      setContractPenalty('');
      setContractCycleHours('24');
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const acceptContractMutation = useMutation({
    mutationFn: ({ contractId, business_id }: { contractId: string; business_id: string }) =>
      api.post(`/contracts/${contractId}/accept`, { business_id }),
    onSuccess: () => {
      show('Contract accepted!', 'success');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contractsIncoming'] });
      setAcceptContractId(null);
      setAcceptBizId(null);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const cancelContractMutation = useMutation({
    mutationFn: (contractId: string) => api.post(`/contracts/${contractId}/cancel`),
    onSuccess: () => {
      show('Contract declined', 'success');
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contractsIncoming'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  // ─── Bulk Order Mutations ──────────────────────────

  const createOrderMutation = useMutation({
    mutationFn: (body: { business_id: string; item_id: string; quantity: number; max_price_per_unit: number }) =>
      api.post('/market/bulk-order', body),
    onSuccess: () => {
      show('Buy order created!', 'success');
      queryClient.invalidateQueries({ queryKey: ['bulkOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myBulkOrders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowCreateOrder(false);
      setOrderItemId(null);
      setOrderQty('');
      setOrderMaxPrice('');
      setOrderBizId(null);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const fillOrderMutation = useMutation({
    mutationFn: ({ orderId, business_id, quantity }: { orderId: string; business_id: string; quantity: number }) =>
      api.post(`/market/bulk-orders/${orderId}/fill`, { business_id, quantity }),
    onSuccess: () => {
      show('Order filled!', 'success');
      queryClient.invalidateQueries({ queryKey: ['bulkOrders'] });
      queryClient.invalidateQueries({ queryKey: ['myBulkOrders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      setFillOrderId(null);
      setFillBizId(null);
      setFillQty('');
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  // ─── Loading ─────────────────────────────────────

  if (pricesLoading || listingsLoading) {
    return <LoadingScreen message="Loading market..." />;
  }

  // ─── Computed: production chain lookups ─────────

  // Map item key -> which recipes consume it (and what they produce)
  const itemUsedIn: Record<string, { recipeName: string; businessType: string; outputName: string; outputPrice: number; qtyPerUnit: number; inputCostPerUnit: number; profitPerUnit: number }[]> = {};
  // Map item key -> recipe that produces it
  const itemProducedBy: Record<string, { businessType: string; inputs: RecipeInputInfo[] }> = {};

  if (gameInfo?.recipes) {
    for (const recipe of gameInfo.recipes) {
      itemProducedBy[recipe.outputItem] = { businessType: recipe.businessType, inputs: recipe.inputs };
      for (const inp of recipe.inputs) {
        if (!itemUsedIn[inp.item]) itemUsedIn[inp.item] = [];
        const inputCostPerUnit = recipe.inputs.reduce((sum, i) => sum + i.basePrice * i.qtyPerUnit, 0);
        itemUsedIn[inp.item].push({
          recipeName: recipe.outputName,
          businessType: recipe.businessType,
          outputName: recipe.outputName,
          outputPrice: recipe.outputPrice,
          qtyPerUnit: inp.qtyPerUnit,
          inputCostPerUnit,
          profitPerUnit: recipe.profitPerUnit,
        });
      }
    }
  }

  // Converter businesses (FACTORY/SHOP with a recipe) and what inputs they need
  const converterNeeds: { business: Business; recipe: RecipeInfo; inputs: RecipeInputInfo[] }[] = [];
  if (businesses && gameInfo?.recipes) {
    for (const biz of businesses) {
      if ((biz.type === 'FACTORY' || biz.type === 'SHOP') && biz.output_item_key) {
        const recipe = gameInfo.recipes.find(r => r.outputItem === biz.output_item_key);
        if (recipe && recipe.inputs.length > 0) {
          converterNeeds.push({ business: biz, recipe, inputs: recipe.inputs });
        }
      }
    }
  }

  // Map: item_key -> list of converter businesses that need this input
  const inputNeededBy: Record<string, { bizId: string; bizName: string; bizType: string }[]> = {};
  for (const cn of converterNeeds) {
    for (const inp of cn.inputs) {
      if (!inputNeededBy[inp.item]) inputNeededBy[inp.item] = [];
      inputNeededBy[inp.item].push({ bizId: cn.business.id, bizName: cn.business.name, bizType: cn.business.type });
    }
  }

  // ─── Section: Price Index ────────────────────────

  const renderPrices = () => {
    if (!prices || prices.length === 0) {
      return <EmptyState icon="$" title="No price data" subtitle="Check back later" />;
    }

    // Group by production_stage
    const grouped: Record<number, PriceItem[]> = {};
    for (const p of prices) {
      const stage = p.production_stage;
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(p);
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([stage, items]) => (
        <View key={stage}>
          <Text style={styles.groupTitle}>{STAGE_LABELS[Number(stage)] ?? `Stage ${stage}`}</Text>
          {items.map((item) => {
            const base = Number(item.base_price);
            const current = Number(item.current_price);
            const diff = current - base;
            const trendColor = diff > 0.01 ? '#22c55e' : diff < -0.01 ? '#ef4444' : '#6b7280';
            const trendSymbol = diff > 0.01 ? '\u2191' : diff < -0.01 ? '\u2193' : '\u2192';

            // Production chain context
            const usedInChains = itemUsedIn[item.key] ?? [];
            const producedBy = itemProducedBy[item.key];

            return (
              <Card key={item.key} style={styles.priceCard}>
                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.priceName}>{item.name}</Text>
                    <Text style={styles.priceCategory}>{item.category}</Text>
                    {/* Show what this item is used in */}
                    {usedInChains.length > 0 && (
                      <Text style={styles.chainContext}>
                        {'\u2192'} used in: {usedInChains.map(c => `${c.outputName} (${c.businessType})`).join(', ')}
                      </Text>
                    )}
                    {/* Show where this item comes from */}
                    {producedBy && (
                      <Text style={styles.chainContext}>
                        {'\u2190'} made by: {producedBy.businessType}{producedBy.inputs.length > 0 ? ` from ${producedBy.inputs.map(i => i.name).join(' + ')}` : ''}
                      </Text>
                    )}
                    {/* Show profit margin if processed at current market price */}
                    {usedInChains.length > 0 && usedInChains.map((chain, idx) => {
                      // Recalculate input cost using current market price instead of base
                      const marginAtMarket = chain.outputPrice - (chain.inputCostPerUnit - chain.qtyPerUnit * Number(item.base_price) + chain.qtyPerUnit * current);
                      const marginColor = marginAtMarket > 0 ? '#22c55e' : '#ef4444';
                      return (
                        <Text key={idx} style={[styles.profitHint, { color: marginColor }]}>
                          Process {'\u2192'} {chain.outputName}: {formatCurrency(chain.outputPrice)} - {chain.qtyPerUnit}x{formatCurrency(current)} = {formatCurrency(marginAtMarket)}/unit
                        </Text>
                      );
                    })}
                  </View>
                  <View style={styles.priceValues}>
                    <Text style={[styles.priceCurrentVal, { color: trendColor }]}>
                      {trendSymbol} {formatCurrency(current)}
                    </Text>
                    <Text style={styles.priceBaseVal}>
                      Base: {formatCurrency(base)}
                    </Text>
                  </View>
                </View>
              </Card>
            );
          })}
        </View>
      ));
  };

  // ─── Section: Buy ───────────────────────────────

  const renderBuy = () => {
    if (!listings || listings.length === 0) {
      return <EmptyState icon="$" title="No listings available" subtitle="The market is empty" />;
    }

    // "Your Businesses Need" section
    const needsSection = converterNeeds.length > 0 ? (
      <View style={styles.needsSection}>
        <Text style={styles.needsTitle}>Your Businesses Need</Text>
        {converterNeeds.map((cn) => {
          const typeEmoji = cn.business.type === 'FACTORY' ? '\uD83C\uDFED' : '\uD83C\uDFEA';
          return (
            <View key={cn.business.id} style={styles.needsCard}>
              <Text style={styles.needsText}>
                {typeEmoji} <Text style={styles.needsBizName}>{cn.business.name}</Text> needs{' '}
                <Text style={styles.needsItemName}>{cn.inputs.map(i => `${i.qtyPerUnit}x ${i.name}`).join(', ')}</Text>
                {' '}{'\u2192'} {cn.recipe.outputName}
              </Text>
              <Text style={styles.needsProfit}>
                Profit: {formatCurrency(cn.recipe.profitPerUnit)}/unit
              </Text>
            </View>
          );
        })}
      </View>
    ) : null;

    // Group by stage
    const grouped: Record<number, MarketListing[]> = {};
    for (const l of listings) {
      const stage = l.production_stage;
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(l);
    }

    return (
      <View>
        {needsSection}
        {Object.entries(grouped)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([stage, items]) => (
            <View key={stage}>
              <Text style={styles.groupTitle}>{STAGE_LABELS[Number(stage)] ?? `Stage ${stage}`}</Text>
              {items.map((listing) => {
                const neededByBizzes = inputNeededBy[listing.item_key] ?? [];
                return (
                  <Card key={listing.id} style={styles.listingCard}>
                    <View style={styles.listingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listingName}>{listing.item_name}</Text>
                        <Text style={styles.listingMeta}>
                          {Math.floor(Number(listing.quantity))} available
                          {listing.seller_type === 'ai' ? ' (AI)' : ' (Player)'}
                        </Text>
                        {/* Production chain context on listings */}
                        {(itemUsedIn[listing.item_key] ?? []).length > 0 && (
                          <Text style={styles.chainContext}>
                            {'\u2192'} {(itemUsedIn[listing.item_key] ?? []).map(c => c.outputName).join(', ')}
                          </Text>
                        )}
                      </View>
                      <View style={styles.listingRight}>
                        <Text style={styles.listingPrice}>
                          {formatCurrency(Number(listing.price_per_unit))}/ea
                        </Text>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => {
                            setBuyListing(listing);
                            setBuyQty('1');
                            setBuyBizId(null);
                          }}
                        >
                          <Text style={styles.actionBtnText}>Buy</Text>
                        </TouchableOpacity>
                        {/* Quick Buy shortcuts for factories that need this input */}
                        {neededByBizzes.map((nb) => (
                          <TouchableOpacity
                            key={nb.bizId}
                            style={styles.quickBuyBtn}
                            onPress={() => {
                              setBuyListing(listing);
                              setBuyQty(String(Math.min(10, Math.floor(Number(listing.quantity)))));
                              setBuyBizId(nb.bizId);
                            }}
                          >
                            <Text style={styles.quickBuyText}>
                              {'\u26A1'} Buy for {nb.bizName}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          ))}
      </View>
    );
  };

  // ─── Section: Sell ──────────────────────────────

  const renderSell = () => {
    if (!businesses || businesses.length === 0) {
      return <EmptyState icon="$" title="No businesses" subtitle="Create a business first to sell items" />;
    }

    return (
      <View>
        {/* Business selector */}
        <Text style={styles.selectLabel}>Select Business:</Text>
        <View style={styles.bizSelector}>
          {businesses.map((biz) => (
            <TouchableOpacity
              key={biz.id}
              style={[styles.bizChip, sellBizId === biz.id && styles.bizChipActive]}
              onPress={() => setSellBizId(biz.id)}
            >
              <Text style={[styles.bizChipText, sellBizId === biz.id && styles.bizChipTextActive]}>
                {biz.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Inventory for selected business */}
        {sellBizId && sellInventory ? (
          sellInventory.inventory.length === 0 ? (
            <EmptyState icon="$" title="No inventory" subtitle="This business has no items to sell" />
          ) : (
            sellInventory.inventory
              .filter((inv) => Number(inv.amount) - Number(inv.reserved) > 0)
              .map((inv) => {
                const sellable = Number(inv.amount) - Number(inv.reserved);
                return (
                  <Card key={inv.item_id} style={styles.invCard}>
                    <View style={styles.invRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.invName}>{inv.name}</Text>
                        <Text style={styles.invMeta}>
                          {Math.floor(sellable)} sellable (of {Math.floor(Number(inv.amount))})
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          setSellItem(inv);
                          setSellQty(String(Math.floor(sellable)));
                        }}
                      >
                        <Text style={styles.actionBtnText}>Sell</Text>
                      </TouchableOpacity>
                    </View>
                  </Card>
                );
              })
          )
        ) : sellBizId ? (
          <Text style={styles.hintText}>Loading inventory...</Text>
        ) : (
          <Text style={styles.hintText}>Select a business to see sellable items</Text>
        )}
      </View>
    );
  };

  // ─── Section: My Listings ──────────────────────────

  const renderMyListings = () => {
    const statusVariant: Record<string, 'green' | 'blue' | 'gray' | 'orange'> = {
      open: 'blue',
      sold: 'green',
      expired: 'gray',
      cancelled: 'orange',
    };

    return (
      <View>
        {/* Create Listing Button */}
        <TouchableOpacity
          style={styles.createListingBtn}
          onPress={() => {
            setShowCreateListing(true);
            setListBizId(null);
            setListItem(null);
            setListQty('');
            setListPrice('');
          }}
        >
          <Text style={styles.createListingBtnText}>+ Create Listing</Text>
        </TouchableOpacity>

        {/* My Listings */}
        {myListingsLoading ? (
          <Text style={styles.hintText}>Loading your listings...</Text>
        ) : !myListings || myListings.length === 0 ? (
          <EmptyState icon="$" title="No listings" subtitle="Create a listing to sell items to other players" />
        ) : (
          myListings.map((listing) => {
            const isOpen = listing.status === 'open';
            return (
              <Card key={listing.id} style={styles.myListingCard}>
                <View style={styles.myListingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.myListingName}>{listing.item_name}</Text>
                    <Text style={styles.myListingMeta}>
                      {Math.floor(Number(listing.quantity))} x {formatCurrency(Number(listing.price_per_unit))}/ea
                    </Text>
                    <Text style={styles.myListingDate}>
                      Listed: {new Date(listing.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.myListingRight}>
                    <Badge
                      label={listing.status}
                      variant={statusVariant[listing.status] ?? 'gray'}
                      size="sm"
                    />
                    {isOpen && (
                      <TouchableOpacity
                        style={styles.cancelListingBtn}
                        onPress={() => cancelListingMutation.mutate(listing.id)}
                        disabled={cancelListingMutation.isPending}
                      >
                        <Text style={styles.cancelListingBtnText}>
                          {cancelListingMutation.isPending ? '...' : 'Cancel'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </View>
    );
  };

  // ─── Section: Contracts ─────────────────────────

  const renderContracts = () => {
    const statusVariant: Record<string, 'green' | 'blue' | 'gray' | 'orange'> = {
      active: 'green',
      pending: 'orange',
      completed: 'blue',
      cancelled: 'gray',
      breached: 'gray',
    };

    const incoming = incomingContracts ?? [];
    const all = myContracts ?? [];

    return (
      <View>
        {/* Create Offer Button */}
        <TouchableOpacity
          style={styles.createListingBtn}
          onPress={() => {
            setShowCreateContract(true);
            setContractBuyerId(null);
            setContractItemId(null);
            setContractSupplierBizId(null);
            setContractQty('');
            setContractPrice('');
            setContractPenalty('');
            setContractCycleHours('24');
          }}
        >
          <Text style={styles.createListingBtnText}>+ Create Offer</Text>
        </TouchableOpacity>

        {/* Incoming Offers */}
        {incoming.length > 0 && (
          <>
            <Text style={styles.groupTitle}>Incoming Offers</Text>
            {incoming.map((c) => (
              <Card key={c.id} style={styles.myListingCard}>
                <View style={styles.myListingRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.myListingName}>{c.supplier_name}</Text>
                    <Text style={styles.myListingMeta}>
                      {c.item_name}: {c.quantity_per_cycle}/cycle @ {formatCurrency(c.price_per_unit)}/ea
                    </Text>
                    <Text style={styles.myListingDate}>
                      Every {c.cycle_hours}h | Penalty: {formatCurrency(c.penalty_per_miss)}
                    </Text>
                  </View>
                  <View style={styles.myListingRight}>
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => { setAcceptContractId(c.id); setAcceptBizId(null); }}
                    >
                      <Text style={styles.actionBtnText}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelListingBtn}
                      onPress={() => cancelContractMutation.mutate(c.id)}
                      disabled={cancelContractMutation.isPending}
                    >
                      <Text style={styles.cancelListingBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </>
        )}

        {/* My Contracts */}
        <Text style={styles.groupTitle}>My Contracts</Text>
        {contractsLoading ? (
          <Text style={styles.hintText}>Loading contracts...</Text>
        ) : all.length === 0 ? (
          <EmptyState icon="$" title="No contracts" subtitle="Create an offer or wait for incoming offers" />
        ) : (
          all.map((c) => (
            <Card key={c.id} style={styles.myListingCard}>
              <View style={styles.myListingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myListingName}>
                    {c.supplier_name} {'\u2192'} {c.buyer_name}
                  </Text>
                  <Text style={styles.myListingMeta}>
                    {c.item_name}: {c.quantity_per_cycle}/cycle @ {formatCurrency(c.price_per_unit)}/ea
                  </Text>
                  <Text style={styles.myListingDate}>
                    {c.cycles_completed} cycles done{c.cycles_missed > 0 ? ` | ${c.cycles_missed} missed` : ''}
                  </Text>
                </View>
                <View style={styles.myListingRight}>
                  <Badge
                    label={c.status}
                    variant={statusVariant[c.status] ?? 'gray'}
                    size="sm"
                  />
                </View>
              </View>
            </Card>
          ))
        )}
      </View>
    );
  };

  // ─── Section: Orders ──────────────────────────────

  const renderOrders = () => {
    const statusVariant: Record<string, 'green' | 'blue' | 'gray' | 'orange'> = {
      open: 'blue',
      filled: 'green',
      partial: 'orange',
      cancelled: 'gray',
    };

    return (
      <View>
        {/* Create Buy Order Button */}
        <TouchableOpacity
          style={styles.createListingBtn}
          onPress={() => {
            setShowCreateOrder(true);
            setOrderItemId(null);
            setOrderQty('');
            setOrderMaxPrice('');
            setOrderBizId(null);
          }}
        >
          <Text style={styles.createListingBtnText}>+ Create Buy Order</Text>
        </TouchableOpacity>

        {/* Open Orders */}
        <Text style={styles.groupTitle}>Open Orders</Text>
        {ordersLoading ? (
          <Text style={styles.hintText}>Loading orders...</Text>
        ) : !openOrders || openOrders.length === 0 ? (
          <EmptyState icon="$" title="No open orders" subtitle="No bulk buy orders from any players yet" />
        ) : (
          openOrders.map((order) => (
            <Card key={order.id} style={styles.myListingCard}>
              <View style={styles.myListingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myListingName}>{order.item_name}</Text>
                  <Text style={styles.myListingMeta}>
                    {order.quantity_remaining} remaining (of {order.quantity}) @ max {formatCurrency(order.max_price_per_unit)}/ea
                  </Text>
                  <Text style={styles.myListingDate}>Buyer: {order.buyer_name}</Text>
                </View>
                <View style={styles.myListingRight}>
                  <Badge label={order.status} variant={statusVariant[order.status] ?? 'gray'} size="sm" />
                  {order.status === 'open' && (
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        setFillOrderId(order.id);
                        setFillBizId(null);
                        setFillQty(String(order.quantity_remaining));
                      }}
                    >
                      <Text style={styles.actionBtnText}>Fill</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Card>
          ))
        )}

        {/* My Orders */}
        <Text style={[styles.groupTitle, { marginTop: 16 }]}>My Orders</Text>
        {!myOrders || myOrders.length === 0 ? (
          <EmptyState icon="$" title="No orders" subtitle="Create a buy order to request items from other players" />
        ) : (
          myOrders.map((order) => (
            <Card key={order.id} style={styles.myListingCard}>
              <View style={styles.myListingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myListingName}>{order.item_name}</Text>
                  <Text style={styles.myListingMeta}>
                    {order.quantity_remaining}/{order.quantity} remaining @ max {formatCurrency(order.max_price_per_unit)}/ea
                  </Text>
                  <Text style={styles.myListingDate}>
                    Created: {new Date(order.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Badge label={order.status} variant={statusVariant[order.status] ?? 'gray'} size="sm" />
              </View>
            </Card>
          ))
        )}
      </View>
    );
  };

  // ─── Computed values for modals ───────────────────

  const buyQtyNum = Math.max(1, parseInt(buyQty, 10) || 0);
  const buyTotal = buyListing ? buyQtyNum * Number(buyListing.price_per_unit) : 0;
  const buyMaxQty = buyListing ? Math.floor(Number(buyListing.quantity)) : 0;

  const sellQtyNum = Math.max(1, parseInt(sellQty, 10) || 0);
  const sellMaxQty = sellItem ? Math.floor(Number(sellItem.amount) - Number(sellItem.reserved)) : 0;
  // Sell price estimate (95% of base for display; actual uses server-computed avg)
  const sellPriceEstimate = sellItem ? Number(sellItem.base_price) * 0.95 : 0;
  const sellRevEstimate = sellQtyNum * sellPriceEstimate;

  // ─── Section tabs ─────────────────────────────────

  // ─── Computed values for create-listing modal ───

  const listQtyNum = Math.max(1, parseInt(listQty, 10) || 0);
  const listPriceNum = Math.max(0, parseFloat(listPrice) || 0);
  const listMaxQty = listItem ? Math.floor(Number(listItem.amount) - Number(listItem.reserved)) : 0;
  const listTotal = listQtyNum * listPriceNum;

  const sections: { key: SectionKey; label: string }[] = [
    { key: 'prices', label: 'Prices' },
    { key: 'buy', label: 'Buy' },
    { key: 'sell', label: 'Sell' },
    { key: 'listings', label: 'Listings' },
    { key: 'contracts', label: 'Contracts' },
    { key: 'orders', label: 'Orders' },
  ];

  const sectionContent: Record<SectionKey, () => React.ReactNode> = {
    prices: renderPrices,
    buy: renderBuy,
    sell: renderSell,
    listings: renderMyListings,
    contracts: renderContracts,
    orders: renderOrders,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchAll} tintColor="#22c55e" colors={['#22c55e']} />
        }
      >
        <Text style={styles.title}>Market</Text>

        {/* Section Tabs */}
        <View style={styles.sectionBar}>
          {sections.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.sectionTab, activeSection === s.key && styles.sectionTabActive]}
              onPress={() => setActiveSection(s.key)}
            >
              <Text style={[styles.sectionTabText, activeSection === s.key && styles.sectionTabTextActive]}>
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {sectionContent[activeSection]()}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ─── Buy Modal ─────────────────────────────── */}
      <Modal visible={buyListing !== null} transparent animationType="fade" onRequestClose={() => setBuyListing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Buy {buyListing?.item_name}</Text>
            <Text style={styles.modalSub}>
              Price: {formatCurrency(Number(buyListing?.price_per_unit ?? 0))}/ea
            </Text>
            <Text style={styles.modalSub}>
              Available: {buyMaxQty}
            </Text>

            <Text style={styles.inputLabel}>Quantity:</Text>
            <TextInput
              style={styles.input}
              value={buyQty}
              onChangeText={setBuyQty}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#4b5563"
            />

            <Text style={styles.modalSub}>Select target business:</Text>
            {businesses && businesses.length > 0 ? (
              businesses.map((biz) => (
                <TouchableOpacity
                  key={biz.id}
                  style={[styles.bizOption, buyBizId === biz.id && styles.bizOptionSelected]}
                  onPress={() => setBuyBizId(biz.id)}
                >
                  <Text style={styles.bizOptionName}>{biz.name}</Text>
                  <Text style={styles.bizOptionMeta}>{biz.type} T{biz.tier}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.modalSub}>No businesses. Create one first.</Text>
            )}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Cost:</Text>
              <Text style={styles.totalValue}>{formatCurrency(buyTotal)}</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setBuyListing(null); setBuyQty(''); setBuyBizId(null); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (!buyBizId || buyQtyNum <= 0 || buyQtyNum > buyMaxQty) && { opacity: 0.5 }]}
                disabled={!buyBizId || buyQtyNum <= 0 || buyQtyNum > buyMaxQty || buyMutation.isPending}
                onPress={() => {
                  if (buyListing && buyBizId && buyQtyNum > 0) {
                    buyMutation.mutate({
                      listing_id: buyListing.id,
                      quantity: buyQtyNum,
                      business_id: buyBizId,
                    });
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {buyMutation.isPending ? 'Buying...' : 'Confirm Buy'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Sell Modal ────────────────────────────── */}
      <Modal visible={sellItem !== null} transparent animationType="fade" onRequestClose={() => setSellItem(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sell {sellItem?.name}</Text>
            <Text style={styles.modalSub}>
              Price: ~{formatCurrency(sellPriceEstimate)}/ea (95% of market)
            </Text>
            <Text style={styles.modalSub}>
              Sellable: {sellMaxQty}
            </Text>

            <Text style={styles.inputLabel}>Quantity:</Text>
            <TextInput
              style={styles.input}
              value={sellQty}
              onChangeText={setSellQty}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#4b5563"
            />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Est. Revenue:</Text>
              <Text style={[styles.totalValue, { color: '#22c55e' }]}>{formatCurrency(sellRevEstimate)}</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setSellItem(null); setSellQty(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (sellQtyNum <= 0 || sellQtyNum > sellMaxQty) && { opacity: 0.5 }]}
                disabled={sellQtyNum <= 0 || sellQtyNum > sellMaxQty || sellMutation.isPending}
                onPress={() => {
                  if (sellItem && sellBizId && sellQtyNum > 0) {
                    sellMutation.mutate({
                      business_id: sellBizId,
                      item_id: sellItem.item_id,
                      quantity: sellQtyNum,
                    });
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {sellMutation.isPending ? 'Selling...' : 'Confirm Sell'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Accept Contract Modal ─────────────────── */}
      <Modal visible={acceptContractId !== null} transparent animationType="fade" onRequestClose={() => setAcceptContractId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Accept Contract</Text>
            <Text style={styles.modalSub}>Select a business to fulfill this contract:</Text>
            {businesses && businesses.length > 0 ? (
              businesses.map((biz) => (
                <TouchableOpacity
                  key={biz.id}
                  style={[styles.bizOption, acceptBizId === biz.id && styles.bizOptionSelected]}
                  onPress={() => setAcceptBizId(biz.id)}
                >
                  <Text style={styles.bizOptionName}>{biz.name}</Text>
                  <Text style={styles.bizOptionMeta}>{biz.type} T{biz.tier}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.modalSub}>No businesses available.</Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setAcceptContractId(null); setAcceptBizId(null); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !acceptBizId && { opacity: 0.5 }]}
                disabled={!acceptBizId || acceptContractMutation.isPending}
                onPress={() => {
                  if (acceptContractId && acceptBizId) {
                    acceptContractMutation.mutate({ contractId: acceptContractId, business_id: acceptBizId });
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {acceptContractMutation.isPending ? 'Accepting...' : 'Accept'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Create Contract Offer Modal ─────────────── */}
      <Modal visible={showCreateContract} transparent animationType="fade" onRequestClose={() => setShowCreateContract(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.createListingModalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Contract Offer</Text>

              {/* Target player */}
              <Text style={styles.inputLabel}>Target Player (Buyer):</Text>
              {intelPlayers && intelPlayers.length > 0 ? (
                <View style={styles.bizSelector}>
                  {intelPlayers.map((p) => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.bizChip, contractBuyerId === p.id && styles.bizChipActive]}
                      onPress={() => setContractBuyerId(p.id)}
                    >
                      <Text style={[styles.bizChipText, contractBuyerId === p.id && styles.bizChipTextActive]}>
                        {p.username}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.modalSub}>Loading players...</Text>
              )}

              {/* Item */}
              <Text style={styles.inputLabel}>Item:</Text>
              {gameItems && gameItems.length > 0 ? (
                <View style={styles.bizSelector}>
                  {gameItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.bizChip, contractItemId === item.id && styles.bizChipActive]}
                      onPress={() => setContractItemId(item.id)}
                    >
                      <Text style={[styles.bizChipText, contractItemId === item.id && styles.bizChipTextActive]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.modalSub}>Loading items...</Text>
              )}

              {/* Supplier business */}
              <Text style={styles.inputLabel}>Your Business (Supplier):</Text>
              {businesses && businesses.length > 0 ? (
                <View style={styles.bizSelector}>
                  {businesses.map((biz) => (
                    <TouchableOpacity
                      key={biz.id}
                      style={[styles.bizChip, contractSupplierBizId === biz.id && styles.bizChipActive]}
                      onPress={() => setContractSupplierBizId(biz.id)}
                    >
                      <Text style={[styles.bizChipText, contractSupplierBizId === biz.id && styles.bizChipTextActive]}>
                        {biz.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.modalSub}>No businesses available.</Text>
              )}

              {/* Qty / Cycle / Price / Penalty */}
              <Text style={styles.inputLabel}>Quantity per cycle:</Text>
              <TextInput
                style={styles.input}
                value={contractQty}
                onChangeText={setContractQty}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor="#4b5563"
              />

              <Text style={styles.inputLabel}>Cycle hours:</Text>
              <TextInput
                style={styles.input}
                value={contractCycleHours}
                onChangeText={setContractCycleHours}
                keyboardType="number-pad"
                placeholder="24"
                placeholderTextColor="#4b5563"
              />

              <Text style={styles.inputLabel}>Price per unit:</Text>
              <TextInput
                style={styles.input}
                value={contractPrice}
                onChangeText={setContractPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#4b5563"
              />

              <Text style={styles.inputLabel}>Penalty per miss:</Text>
              <TextInput
                style={styles.input}
                value={contractPenalty}
                onChangeText={setContractPenalty}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#4b5563"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowCreateContract(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalConfirm,
                    (!contractBuyerId || !contractItemId || !contractSupplierBizId || !contractQty || !contractPrice) && { opacity: 0.5 },
                  ]}
                  disabled={!contractBuyerId || !contractItemId || !contractSupplierBizId || !contractQty || !contractPrice || createContractMutation.isPending}
                  onPress={() => {
                    if (contractBuyerId && contractItemId && contractSupplierBizId) {
                      createContractMutation.mutate({
                        buyer_id: contractBuyerId,
                        item_id: contractItemId,
                        supplier_business_id: contractSupplierBizId,
                        quantity_per_cycle: parseInt(contractQty, 10) || 1,
                        cycle_hours: parseInt(contractCycleHours, 10) || 24,
                        price_per_unit: parseFloat(contractPrice) || 0,
                        penalty_per_miss: parseFloat(contractPenalty) || 0,
                      });
                    }
                  }}
                >
                  <Text style={styles.modalConfirmText}>
                    {createContractMutation.isPending ? 'Sending...' : 'Send Offer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Create Listing Modal ──────────────────── */}
      <Modal visible={showCreateListing} transparent animationType="fade" onRequestClose={() => setShowCreateListing(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.createListingModalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Listing</Text>

              {/* Business selector */}
              <Text style={styles.inputLabel}>Select Business:</Text>
              {businesses && businesses.length > 0 ? (
                <View style={styles.bizSelector}>
                  {businesses.map((biz) => (
                    <TouchableOpacity
                      key={biz.id}
                      style={[styles.bizChip, listBizId === biz.id && styles.bizChipActive]}
                      onPress={() => {
                        setListBizId(biz.id);
                        setListItem(null);
                        setListQty('');
                      }}
                    >
                      <Text style={[styles.bizChipText, listBizId === biz.id && styles.bizChipTextActive]}>
                        {biz.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.modalSub}>No businesses available.</Text>
              )}

              {/* Item selector */}
              {listBizId && (
                <>
                  <Text style={styles.inputLabel}>Select Item:</Text>
                  {listInventory ? (
                    listInventory.inventory
                      .filter((inv) => Number(inv.amount) - Number(inv.reserved) > 0)
                      .length === 0 ? (
                      <Text style={styles.modalSub}>No items available in this business.</Text>
                    ) : (
                      listInventory.inventory
                        .filter((inv) => Number(inv.amount) - Number(inv.reserved) > 0)
                        .map((inv) => {
                          const available = Math.floor(Number(inv.amount) - Number(inv.reserved));
                          const isSelected = listItem?.item_id === inv.item_id;
                          return (
                            <TouchableOpacity
                              key={inv.item_id}
                              style={[styles.bizOption, isSelected && styles.bizOptionSelected]}
                              onPress={() => {
                                setListItem(inv);
                                setListQty(String(available));
                                setListPrice(inv.base_price);
                              }}
                            >
                              <Text style={styles.bizOptionName}>{inv.name}</Text>
                              <Text style={styles.bizOptionMeta}>
                                {available} available (base: {formatCurrency(Number(inv.base_price))})
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                    )
                  ) : (
                    <Text style={styles.modalSub}>Loading inventory...</Text>
                  )}
                </>
              )}

              {/* Quantity & Price */}
              {listItem && (
                <>
                  <Text style={styles.inputLabel}>Quantity (max {listMaxQty}):</Text>
                  <TextInput
                    style={styles.input}
                    value={listQty}
                    onChangeText={setListQty}
                    keyboardType="number-pad"
                    placeholder="1"
                    placeholderTextColor="#4b5563"
                  />

                  <Text style={styles.inputLabel}>Price per unit:</Text>
                  <TextInput
                    style={styles.input}
                    value={listPrice}
                    onChangeText={setListPrice}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#4b5563"
                  />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total Value:</Text>
                    <Text style={[styles.totalValue, { color: '#22c55e' }]}>{formatCurrency(listTotal)}</Text>
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => {
                    setShowCreateListing(false);
                    setListBizId(null);
                    setListItem(null);
                    setListQty('');
                    setListPrice('');
                  }}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalConfirm,
                    (!listBizId || !listItem || listQtyNum <= 0 || listQtyNum > listMaxQty || listPriceNum <= 0) && { opacity: 0.5 },
                  ]}
                  disabled={!listBizId || !listItem || listQtyNum <= 0 || listQtyNum > listMaxQty || listPriceNum <= 0 || createListingMutation.isPending}
                  onPress={() => {
                    if (listBizId && listItem && listQtyNum > 0 && listPriceNum > 0) {
                      createListingMutation.mutate({
                        business_id: listBizId,
                        item_id: listItem.item_id,
                        quantity: listQtyNum,
                        price_per_unit: listPriceNum,
                      });
                    }
                  }}
                >
                  <Text style={styles.modalConfirmText}>
                    {createListingMutation.isPending ? 'Creating...' : 'Create Listing'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Create Bulk Order Modal ──────────────────── */}
      <Modal visible={showCreateOrder} transparent animationType="fade" onRequestClose={() => setShowCreateOrder(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.createListingModalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Create Buy Order</Text>

              {/* Item selector */}
              <Text style={styles.inputLabel}>Item:</Text>
              {gameItems && gameItems.length > 0 ? (
                <View style={styles.bizSelector}>
                  {gameItems.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.bizChip, orderItemId === item.id && styles.bizChipActive]}
                      onPress={() => setOrderItemId(item.id)}
                    >
                      <Text style={[styles.bizChipText, orderItemId === item.id && styles.bizChipTextActive]}>
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.modalSub}>Loading items...</Text>
              )}

              {/* Quantity */}
              <Text style={styles.inputLabel}>Quantity:</Text>
              <TextInput
                style={styles.input}
                value={orderQty}
                onChangeText={setOrderQty}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor="#4b5563"
              />

              {/* Max price per unit */}
              <Text style={styles.inputLabel}>Max Price per Unit:</Text>
              <TextInput
                style={styles.input}
                value={orderMaxPrice}
                onChangeText={setOrderMaxPrice}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#4b5563"
              />

              {/* Business to receive items */}
              <Text style={styles.inputLabel}>Receive at Business:</Text>
              {businesses && businesses.length > 0 ? (
                <View style={styles.bizSelector}>
                  {businesses.map((biz) => (
                    <TouchableOpacity
                      key={biz.id}
                      style={[styles.bizChip, orderBizId === biz.id && styles.bizChipActive]}
                      onPress={() => setOrderBizId(biz.id)}
                    >
                      <Text style={[styles.bizChipText, orderBizId === biz.id && styles.bizChipTextActive]}>
                        {biz.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.modalSub}>No businesses available.</Text>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowCreateOrder(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalConfirm,
                    (!orderItemId || !orderBizId || !orderQty || !orderMaxPrice) && { opacity: 0.5 },
                  ]}
                  disabled={!orderItemId || !orderBizId || !orderQty || !orderMaxPrice || createOrderMutation.isPending}
                  onPress={() => {
                    if (orderItemId && orderBizId) {
                      createOrderMutation.mutate({
                        business_id: orderBizId,
                        item_id: orderItemId,
                        quantity: parseInt(orderQty, 10) || 1,
                        max_price_per_unit: parseFloat(orderMaxPrice) || 0,
                      });
                    }
                  }}
                >
                  <Text style={styles.modalConfirmText}>
                    {createOrderMutation.isPending ? 'Creating...' : 'Create Order'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ─── Fill Order Modal ─────────────────────────── */}
      <Modal visible={fillOrderId !== null} transparent animationType="fade" onRequestClose={() => setFillOrderId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Fill Order</Text>
            <Text style={styles.modalSub}>Select a business to fill from:</Text>
            {businesses && businesses.length > 0 ? (
              businesses.map((biz) => (
                <TouchableOpacity
                  key={biz.id}
                  style={[styles.bizOption, fillBizId === biz.id && styles.bizOptionSelected]}
                  onPress={() => setFillBizId(biz.id)}
                >
                  <Text style={styles.bizOptionName}>{biz.name}</Text>
                  <Text style={styles.bizOptionMeta}>{biz.type} T{biz.tier}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.modalSub}>No businesses available.</Text>
            )}

            <Text style={styles.inputLabel}>Quantity to fill:</Text>
            <TextInput
              style={styles.input}
              value={fillQty}
              onChangeText={setFillQty}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor="#4b5563"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setFillOrderId(null); setFillBizId(null); setFillQty(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (!fillBizId || !fillQty) && { opacity: 0.5 }]}
                disabled={!fillBizId || !fillQty || fillOrderMutation.isPending}
                onPress={() => {
                  if (fillOrderId && fillBizId) {
                    fillOrderMutation.mutate({
                      orderId: fillOrderId,
                      business_id: fillBizId,
                      quantity: parseInt(fillQty, 10) || 1,
                    });
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {fillOrderMutation.isPending ? 'Filling...' : 'Fill Order'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 52 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb', marginBottom: 16 },

  sectionBar: { flexDirection: 'row', marginBottom: 16, gap: 6 },
  sectionTab: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#1f2937', alignItems: 'center',
  },
  sectionTabActive: { backgroundColor: '#22c55e' },
  sectionTabText: { color: '#9ca3af', fontSize: 11, fontWeight: '700' },
  sectionTabTextActive: { color: '#030712' },

  groupTitle: {
    fontSize: 14, fontWeight: '700', color: '#d1d5db',
    marginTop: 12, marginBottom: 8,
    paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },

  // Price cards
  priceCard: { marginBottom: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  priceName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  priceCategory: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  priceValues: { alignItems: 'flex-end', marginLeft: 8 },
  priceCurrentVal: { fontSize: 14, fontWeight: '700' },
  priceBaseVal: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  chainContext: { fontSize: 11, color: '#60a5fa', marginTop: 3 },
  profitHint: { fontSize: 11, marginTop: 2, fontWeight: '600' },

  // "Your Businesses Need" section
  needsSection: {
    backgroundColor: '#1e293b', borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: '#334155',
  },
  needsTitle: {
    fontSize: 13, fontWeight: '800', color: '#fbbf24',
    marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1,
  },
  needsCard: {
    backgroundColor: '#0f172a', borderRadius: 8, padding: 10,
    marginBottom: 6, borderWidth: 1, borderColor: '#1f2937',
  },
  needsText: { fontSize: 13, color: '#e2e8f0', lineHeight: 20 },
  needsBizName: { fontWeight: '700', color: '#f9fafb' },
  needsItemName: { fontWeight: '700', color: '#fbbf24' },
  needsProfit: { fontSize: 11, color: '#22c55e', marginTop: 4, fontWeight: '600' },

  // Listing cards
  listingCard: { marginBottom: 8 },
  listingRow: { flexDirection: 'row', alignItems: 'flex-start' },
  listingName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  listingMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  listingRight: { alignItems: 'flex-end', gap: 6 },
  listingPrice: { fontSize: 13, fontWeight: '700', color: '#f9fafb' },

  // Quick Buy button
  quickBuyBtn: {
    backgroundColor: '#1e3a5f', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: '#2563eb',
  },
  quickBuyText: { color: '#60a5fa', fontSize: 11, fontWeight: '700' },

  // Action button
  actionBtn: {
    backgroundColor: '#22c55e', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  actionBtnText: { color: '#030712', fontSize: 13, fontWeight: '700' },

  // Sell section
  selectLabel: { color: '#9ca3af', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  bizSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  bizChip: {
    backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#374151',
  },
  bizChipActive: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  bizChipText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  bizChipTextActive: { color: '#22c55e' },
  hintText: { color: '#6b7280', fontSize: 13, textAlign: 'center', paddingVertical: 20 },

  // Inventory cards
  invCard: { marginBottom: 8 },
  invRow: { flexDirection: 'row', alignItems: 'center' },
  invName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  invMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Modal styles
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: '#111827', borderRadius: 14, padding: 24,
    width: '100%', maxWidth: 380, borderWidth: 1, borderColor: '#1f2937',
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#9ca3af', marginBottom: 4 },

  inputLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#1f2937', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
    color: '#f9fafb', fontSize: 16, fontWeight: '700', borderWidth: 1, borderColor: '#374151',
    marginBottom: 12,
  },

  bizOption: {
    backgroundColor: '#1f2937', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#374151',
  },
  bizOptionSelected: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  bizOptionName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  bizOptionMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1f2937',
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#ef4444' },

  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', alignItems: 'center',
  },
  modalCancelText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  modalConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#22c55e', alignItems: 'center',
  },
  modalConfirmText: { color: '#030712', fontSize: 14, fontWeight: '700' },

  // Create Listing button
  createListingBtn: {
    backgroundColor: '#22c55e', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginBottom: 16,
  },
  createListingBtnText: { color: '#030712', fontSize: 14, fontWeight: '700' },

  // My Listings cards
  myListingCard: { marginBottom: 8 },
  myListingRow: { flexDirection: 'row', alignItems: 'flex-start' },
  myListingName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  myListingMeta: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  myListingDate: { fontSize: 11, color: '#4b5563', marginTop: 2 },
  myListingRight: { alignItems: 'flex-end', gap: 8 },
  cancelListingBtn: {
    backgroundColor: '#1f2937', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#374151',
  },
  cancelListingBtnText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },

  // Create Listing modal scroll wrapper
  createListingModalScroll: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
});
