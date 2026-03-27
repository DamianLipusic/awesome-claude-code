import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatCurrency } from '../components/ui/CurrencyText';
import { LoadingSkeleton } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';

// ─── V2 Types (match /game/dashboard response) ──────────────
interface V2Business {
  id: string;
  name: string;
  type: 'FARM' | 'MINE' | 'RETAIL';
  tier: number;
  inventory: number;
  efficiency: number;
  workers: number;
  product: string;
  prod_per_tick: number;
  sell_price: number;
  upgrade_cost: number;
  emoji: string;
}

interface V2Dashboard {
  player: { cash: number; net_worth: number; joined: string };
  businesses: V2Business[];
  activity: { type: string; message: string; amount: number | null; time: string }[];
  stats: { total_businesses: number; total_workers: number; income_per_tick: number };
  next_action: string;
}

// ─── Theme ───────────────────────────────────────────────────
const C = {
  bg: '#0a0a0f',
  card: '#1a1a2e',
  cardBorder: '#2a2a3e',
  primary: '#6c5ce7',
  success: '#22c55e',
  error: '#ff6b6b',
  warning: '#ffa502',
  text: '#e0e0e0',
  dim: '#6b7280',
  bright: '#f9fafb',
  accent: '#a29bfe',
};

// ─── Hero: Cash (BIG) + Stats ────────────────────────────────
function HeroSection({ data }: { data: V2Dashboard }) {
  const { player, stats } = data;
  const incomeColor = stats.income_per_tick > 0 ? C.success : C.dim;

  return (
    <View style={s.hero}>
      <Text style={s.cashLabel}>CASH</Text>
      <Text style={s.cashAmount}>{formatCurrency(player.cash)}</Text>

      {stats.income_per_tick > 0 && (
        <View style={[s.trendPill, { backgroundColor: incomeColor + '22' }]}>
          <Text style={[s.trendText, { color: incomeColor }]}>
            +{formatCurrency(stats.income_per_tick)}/tick
          </Text>
        </View>
      )}

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>NET WORTH</Text>
          <Text style={[s.statValue, { color: C.primary }]}>{formatCurrency(player.net_worth)}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statLabel}>BUSINESSES</Text>
          <Text style={[s.statValue, { color: C.accent }]}>{stats.total_businesses}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statLabel}>WORKERS</Text>
          <Text style={[s.statValue, { color: C.success }]}>{stats.total_workers}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Next Action Banner ──────────────────────────────────────
function NextActionBanner({ action }: { action: string }) {
  return (
    <View style={s.nextAction}>
      <Text style={s.nextActionIcon}>💡</Text>
      <Text style={s.nextActionText}>{action}</Text>
    </View>
  );
}

// ─── Business Card ───────────────────────────────────────────
function BusinessCard({ biz, onHire, onSell }: {
  biz: V2Business;
  onHire: () => void;
  onSell: () => void;
}) {
  const hasInventory = biz.inventory > 0;
  const revenuePerTick = biz.prod_per_tick * biz.sell_price;

  return (
    <View style={s.bizCard}>
      <View style={s.bizHeader}>
        <Text style={s.bizEmoji}>{biz.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={s.bizName}>{biz.name}</Text>
          <Text style={s.bizMeta}>
            {biz.type} T{biz.tier} · {biz.workers} workers · {biz.product}
          </Text>
        </View>
        {biz.prod_per_tick > 0 && (
          <View style={[s.profitPill, { backgroundColor: C.success + '22' }]}>
            <Text style={[s.profitText, { color: C.success }]}>
              +{formatCurrency(revenuePerTick)}/tick
            </Text>
          </View>
        )}
      </View>

      {/* Production info */}
      {biz.workers > 0 ? (
        <Text style={[s.prodText, { color: C.success }]}>
          Produces {biz.prod_per_tick} {biz.product}/tick · Sells at ${biz.sell_price}/unit
        </Text>
      ) : (
        <Text style={[s.prodText, { color: C.error }]}>No workers — not producing!</Text>
      )}

      {/* Inventory */}
      {hasInventory && (
        <Text style={[s.invText, { color: C.warning }]}>
          📦 {biz.inventory} {biz.product} in stock ({formatCurrency(biz.inventory * biz.sell_price)})
        </Text>
      )}

      {/* Actions */}
      <View style={s.bizActions}>
        <TouchableOpacity
          style={[s.actionBtn, { borderColor: C.success + '66' }]}
          onPress={onHire}
        >
          <Text style={[s.actionBtnText, { color: C.success }]}>+ Hire ($2,000)</Text>
        </TouchableOpacity>

        {hasInventory && (
          <TouchableOpacity
            style={[s.actionBtn, { borderColor: C.warning + '66' }]}
            onPress={onSell}
          >
            <Text style={[s.actionBtnText, { color: C.warning }]}>
              Sell {biz.inventory} ({formatCurrency(biz.inventory * biz.sell_price)})
            </Text>
          </TouchableOpacity>
        )}

        <View style={s.upgradeInfo}>
          <Text style={s.upgradeText}>
            Upgrade T{biz.tier + 1}: {formatCurrency(biz.upgrade_cost)}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Create Business ─────────────────────────────────────────
function CreateBusinessSection() {
  const queryClient = useQueryClient();

  const types = [
    { type: 'FARM', emoji: '🌾', cost: 5000, product: 'Food' },
    { type: 'MINE', emoji: '⛏️', cost: 8000, product: 'Ore' },
    { type: 'RETAIL', emoji: '🏪', cost: 10000, product: 'Goods' },
  ] as const;

  const createMut = useMutation({
    mutationFn: ({ name, type }: { name: string; type: string }) =>
      api.post('/game/businesses', { name, type }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  return (
    <View style={s.createSection}>
      <Text style={s.sectionTitle}>CREATE BUSINESS</Text>
      <View style={s.createRow}>
        {types.map((t) => (
          <TouchableOpacity
            key={t.type}
            style={s.createBtn}
            onPress={() => createMut.mutate({ name: `My ${t.type.charAt(0) + t.type.slice(1).toLowerCase()}`, type: t.type })}
            disabled={createMut.isPending}
          >
            <Text style={s.createEmoji}>{t.emoji}</Text>
            <Text style={s.createType}>{t.type}</Text>
            <Text style={s.createCost}>{formatCurrency(t.cost)}</Text>
            <Text style={s.createProduct}>{t.product}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Sell All Button ─────────────────────────────────────────
function SellAllButton({ totalInventory }: { totalInventory: number }) {
  const queryClient = useQueryClient();
  const sellAllMut = useMutation({
    mutationFn: () => api.post('/game/sell-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  if (totalInventory === 0) return null;

  return (
    <TouchableOpacity
      style={s.sellAllBtn}
      onPress={() => sellAllMut.mutate()}
      disabled={sellAllMut.isPending}
    >
      <Text style={s.sellAllText}>
        {sellAllMut.isPending ? 'Selling...' : `💰 Sell All Inventory (${totalInventory} items)`}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Activity Feed ───────────────────────────────────────────
function ActivityFeed({ activity }: { activity: V2Dashboard['activity'] }) {
  if (!activity.length) return null;

  const typeIcons: Record<string, string> = {
    PRODUCTION: '⚙️',
    SALE: '💰',
    HIRE: '👤',
    CREATE_BIZ: '🏗️',
    UPGRADE: '⬆️',
    TICK: '🔄',
  };

  return (
    <View style={s.activitySection}>
      <Text style={s.sectionTitle}>RECENT ACTIVITY</Text>
      {activity.slice(0, 8).map((a, i) => (
        <View key={i} style={s.activityRow}>
          <Text style={s.activityIcon}>{typeIcons[a.type] ?? '📋'}</Text>
          <Text style={s.activityMsg} numberOfLines={1}>{a.message}</Text>
          {a.amount !== null && (
            <Text style={[s.activityAmount, { color: a.amount >= 0 ? C.success : C.error }]}>
              {a.amount >= 0 ? '+' : ''}{formatCurrency(a.amount)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────
export function DashboardScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery<V2Dashboard>({
    queryKey: ['dashboard'],
    queryFn: () => api.get<V2Dashboard>('/game/dashboard'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const hireMut = useMutation({
    mutationFn: (bizId: string) => api.post(`/game/businesses/${bizId}/hire`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const sellMut = useMutation({
    mutationFn: ({ bizId, qty }: { bizId: string; qty: number }) =>
      api.post('/game/sell', { business_id: bizId, quantity: qty }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const onRefresh = useCallback(() => { refetch(); }, [refetch]);

  if (isLoading) {
    return (
      <ScrollView style={s.screen} contentContainerStyle={s.content}>
        <LoadingSkeleton rows={4} />
      </ScrollView>
    );
  }

  if (!data) {
    return <EmptyState icon="⚠️" title="Failed to load" subtitle="Pull down to retry" />;
  }

  const isNewPlayer = data.businesses.length === 0;
  const totalInventory = data.businesses.reduce((sum, b) => sum + b.inventory, 0);

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={C.primary} />
      }
    >
      {/* Cash + Stats */}
      <HeroSection data={data} />

      {/* What to do next */}
      <NextActionBanner action={data.next_action} />

      {/* Sell All (if has inventory) */}
      <SellAllButton totalInventory={totalInventory} />

      {/* Businesses */}
      {data.businesses.length > 0 && (
        <View>
          <Text style={s.sectionTitle}>
            YOUR BUSINESSES ({data.stats.total_businesses})
          </Text>
          {data.businesses.map((biz) => (
            <BusinessCard
              key={biz.id}
              biz={biz}
              onHire={() => hireMut.mutate(biz.id)}
              onSell={() => sellMut.mutate({ bizId: biz.id, qty: biz.inventory })}
            />
          ))}
        </View>
      )}

      {/* Create Business (always visible) */}
      <CreateBusinessSection />

      {/* Activity Feed */}
      <ActivityFeed activity={data.activity} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 40, gap: 12 },

  // Hero
  hero: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    alignItems: 'center',
  },
  cashLabel: {
    fontSize: 11,
    color: C.dim,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  cashAmount: {
    fontSize: 38,
    fontWeight: '900',
    color: C.bright,
    marginBottom: 8,
  },
  trendPill: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 14,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: {
    fontSize: 9,
    color: C.dim,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.cardBorder,
    marginHorizontal: 4,
  },

  // Next Action
  nextAction: {
    backgroundColor: C.primary + '15',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: C.primary + '33',
  },
  nextActionIcon: { fontSize: 18 },
  nextActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.bright,
    flex: 1,
  },

  // Sell All
  sellAllBtn: {
    backgroundColor: C.warning + '22',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.warning + '44',
  },
  sellAllText: {
    fontSize: 14,
    fontWeight: '700',
    color: C.warning,
  },

  // Section
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },

  // Business Card
  bizCard: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  bizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  bizEmoji: { fontSize: 24 },
  bizName: {
    fontSize: 15,
    fontWeight: '700',
    color: C.bright,
  },
  bizMeta: {
    fontSize: 11,
    color: C.dim,
    marginTop: 1,
  },
  profitPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  profitText: {
    fontSize: 12,
    fontWeight: '800',
  },
  prodText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  invText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  bizActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: C.dim,
  },
  upgradeInfo: {
    marginLeft: 'auto',
  },
  upgradeText: {
    fontSize: 11,
    color: C.dim,
  },

  // Create Business
  createSection: {},
  createRow: {
    flexDirection: 'row',
    gap: 8,
  },
  createBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 4,
  },
  createEmoji: { fontSize: 28 },
  createType: {
    fontSize: 12,
    fontWeight: '700',
    color: C.bright,
  },
  createCost: {
    fontSize: 11,
    fontWeight: '700',
    color: C.success,
  },
  createProduct: {
    fontSize: 10,
    color: C.dim,
  },

  // Activity Feed
  activitySection: {},
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    gap: 8,
  },
  activityIcon: { fontSize: 14, width: 22, textAlign: 'center' },
  activityMsg: { flex: 1, fontSize: 12, color: C.text },
  activityAmount: {
    fontSize: 12,
    fontWeight: '700',
  },
});
