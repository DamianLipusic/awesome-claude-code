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
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { api } from '../lib/api';
import { useAlertStore } from '../stores/alertStore';
import { useAuthStore } from '../stores/authStore';
import { Card } from '../components/ui/Card';
import { CurrencyText, formatCurrency } from '../components/ui/CurrencyText';
import { LoadingSkeleton } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { formatTimestamp } from '../lib/format';
import type {
  DashboardData,
  GameAlert,
  AlertType,
  NextAction,
  BusinessDetail,
} from '@economy-game/shared';
import type { MainTabParamList } from '../navigation/MainTabs';

type NavProp = BottomTabNavigationProp<MainTabParamList>;

// ─── Theme Colors ─────────────────────────────────────────────
const C = {
  bg: '#0a0a0f',
  card: '#1a1a2e',
  cardBorder: '#2a2a3e',
  primary: '#6c5ce7',
  success: '#00d2d3',
  error: '#ff6b6b',
  warning: '#ffa502',
  text: '#e0e0e0',
  dim: '#6b7280',
  bright: '#f9fafb',
  accent: '#a29bfe',
};

const HEAT_COLORS: Record<string, string> = {
  COLD: C.success, WARM: '#ffd93d', HOT: C.warning, BURNING: '#ff6348', FUGITIVE: C.error,
};

const ALERT_ICONS: Record<AlertType, string> = {
  CONTRACT_SETTLED: '\u{1F91D}', CONTRACT_BREACHED: '\u{1F494}',
  EMPLOYEE_THEFT: '\u{1F575}\uFE0F', DETECTION_WARNING: '\u{1F6A8}',
  CRIME_COMPLETED: '\u{1F4B0}', CRIME_BUSTED: '\u{1F694}',
  LAUNDERING_COMPLETE: '\u2705', LAUNDERING_SEIZED: '\u26A0\uFE0F',
  BUSINESS_RAIDED: '\u{1F534}', SEASON_ENDING: '\u23F3',
  EMPLOYEE_QUIT: '\u{1F6AA}', MARKET_CONTRACT_OFFER: '\u{1F4CB}',
  REVENUE_REPORT: '\u{1F4C8}', HEAT_WARNING: '\u{1F525}',
  EVENT_STARTED: '\u26A1', SHIPMENT_ARRIVED: '\u{1F4E6}',
  SPY_DISCOVERED: '\u{1F440}', SPY_LOST: '\u{1F47B}',
  EMBEZZLEMENT_DETECTED: '\u{1F4B8}', BLOCKADE_COLLAPSED: '\u{1F6E1}\uFE0F',
  EVENT_ENDED: '\u{1F3C1}',
};

// ─── Hero: Cash + Trend + Key Stats ─────────────────────────

function HeroSection({ data }: { data: DashboardData }) {
  const { player, rank, income } = data;
  const netColor = income.daily_net >= 0 ? C.success : C.error;
  const trendArrow = income.cash_trend === 'growing' ? '\u25B2' : income.cash_trend === 'declining' ? '\u25BC' : '\u25B6';
  const heat = data.crime?.heat;
  const heatLevel = heat?.level ?? 'COLD';
  const heatColor = HEAT_COLORS[heatLevel] ?? C.success;

  return (
    <View style={s.hero}>
      {/* Cash - BIG */}
      <View style={s.cashRow}>
        <CurrencyText amount={player.cash} variant="clean" size="lg" style={s.cashAmount} />
        <View style={[s.trendPill, { backgroundColor: netColor + '22' }]}>
          <Text style={[s.trendText, { color: netColor }]}>
            {trendArrow} {income.daily_net >= 0 ? '+' : ''}{formatCurrency(income.per_tick_net)}/tick
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>NET WORTH</Text>
          <Text style={[s.statValue, { color: C.primary }]}>{formatCurrency(player.net_worth)}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statLabel}>RANK</Text>
          <Text style={[s.statValue, { color: C.accent }]}>#{rank}</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statBox}>
          <Text style={s.statLabel}>INCOME</Text>
          <Text style={[s.statValue, { color: netColor }]}>
            {income.daily_net >= 0 ? '+' : ''}{formatCurrency(income.daily_net)}/d
          </Text>
        </View>
        {heatLevel !== 'COLD' && (
          <>
            <View style={s.statDivider} />
            <View style={s.statBox}>
              <Text style={s.statLabel}>HEAT</Text>
              <Text style={[s.statValue, { color: heatColor }]}>{heatLevel}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ─── Getting Started (new players only) ─────────────────────

function GettingStartedCard() {
  const navigation = useNavigation<NavProp>();
  return (
    <Card style={{...s.card, borderColor: C.primary + '66', borderWidth: 1}}>
      <Text style={[s.cardTitle, { color: C.primary, marginBottom: 8 }]}>Build Your Empire</Text>
      <Text style={s.tipText}>1. Create a business  2. Hire workers  3. Produce & sell  4. Upgrade</Text>
      <TouchableOpacity style={s.ctaBtn} onPress={() => navigation.navigate('Business')}>
        <Text style={s.ctaBtnText}>Create Your First Business</Text>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Next Action (single most important) ────────────────────

const ACTION_COLORS: Record<string, string> = {
  getting_started: C.primary, growth: C.success, revenue: C.warning,
  expansion: C.accent, optimization: '#00cec9', warning: C.error,
};

function NextActionBanner({ data }: { data: DashboardData }) {
  const actions = data.next_actions;
  if (!actions || actions.length === 0) return null;

  // Show top 2 actions max
  const top = actions.slice(0, 2);
  return (
    <View style={s.nextActionContainer}>
      {top.map((action: NextAction, idx: number) => {
        const color = ACTION_COLORS[action.category] ?? C.primary;
        return (
          <View key={idx} style={[s.nextActionBanner, { borderLeftColor: color }]}>
            <View style={{ flex: 1 }}>
              <Text style={[s.nextActionTitle, { color }]}>{action.action}</Text>
              <Text style={s.nextActionDetail} numberOfLines={1}>{action.detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ─── Empire Actions Bar ─────────────────────────────────────

function EmpireBar() {
  const queryClient = useQueryClient();

  const produceMut = useMutation({
    mutationFn: () => api.post('/businesses/batch-produce', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const sellMut = useMutation({
    mutationFn: () => api.post('/market/batch-quick-sell', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const maintainMut = useMutation({
    mutationFn: () => api.post('/businesses/batch-maintain', {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  return (
    <View style={s.empireBar}>
      <TouchableOpacity style={s.empireBtn} onPress={() => produceMut.mutate()} disabled={produceMut.isPending}>
        <Text style={s.empireBtnIcon}>{'\u2699\uFE0F'}</Text>
        <Text style={s.empireBtnLabel}>{produceMut.isPending ? '...' : 'Produce All'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.empireBtn} onPress={() => sellMut.mutate()} disabled={sellMut.isPending}>
        <Text style={s.empireBtnIcon}>{'\u{1F4B0}'}</Text>
        <Text style={s.empireBtnLabel}>{sellMut.isPending ? '...' : 'Sell All'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.empireBtn} onPress={() => maintainMut.mutate()} disabled={maintainMut.isPending}>
        <Text style={s.empireBtnIcon}>{'\u{1F527}'}</Text>
        <Text style={s.empireBtnLabel}>{maintainMut.isPending ? '...' : 'Maintain'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Business Card (simplified) ─────────────────────────────

function BusinessCard({ biz }: { biz: BusinessDetail }) {
  const queryClient = useQueryClient();

  const hireMut = useMutation({
    mutationFn: () => api.post('/employees/quick-hire', { business_id: biz.id, count: 1 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const sellMut = useMutation({
    mutationFn: () => api.post('/market/quick-sell', { business_id: biz.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const autoSellMut = useMutation({
    mutationFn: () => api.post(`/businesses/${biz.id}/auto-sell`, { enabled: !biz.auto_sell }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const profitColor = biz.profitable ? C.success : C.error;
  const hasInventory = biz.inventory_count > 0;
  const needsWorkers = biz.production?.status === 'idle_no_workers';

  return (
    <View style={s.bizCard}>
      {/* Header: name + profit */}
      <View style={s.bizHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.bizName}>{biz.name}</Text>
          <Text style={s.bizMeta}>
            {biz.type.replace(/_/g, ' ')} T{biz.tier} \u00B7 {biz.city} \u00B7 {biz.employees}W
          </Text>
        </View>
        <View style={[s.profitPill, { backgroundColor: profitColor + '22' }]}>
          <Text style={[s.profitText, { color: profitColor }]}>
            {biz.daily_net >= 0 ? '+' : ''}{formatCurrency(biz.daily_net)}/d
          </Text>
        </View>
      </View>

      {/* Production status */}
      {biz.production && (
        <Text style={[s.prodText, { color: needsWorkers ? C.error : C.success }]}>
          {needsWorkers ? 'No workers!' :
            `Producing: ${biz.production.produces.map(p => `${p.per_tick} ${p.resource}/tick`).join(', ')}`}
        </Text>
      )}

      {/* Inventory indicator */}
      {hasInventory && (
        <Text style={[s.invText, { color: C.warning }]}>
          {biz.inventory_count} items ({formatCurrency(biz.inventory_value)})
          {biz.auto_sell ? ' \u2022 AUTO-SELL' : ''}
        </Text>
      )}

      {/* Actions - contextual, only show what matters */}
      <View style={s.bizActions}>
        {needsWorkers && (
          <TouchableOpacity style={[s.actionBtn, { borderColor: C.success + '66' }]} onPress={() => hireMut.mutate()} disabled={hireMut.isPending}>
            <Text style={[s.actionBtnText, { color: C.success }]}>{hireMut.isPending ? '...' : '+ Hire'}</Text>
          </TouchableOpacity>
        )}
        {hasInventory && !biz.auto_sell && (
          <TouchableOpacity style={[s.actionBtn, { borderColor: C.warning + '66' }]} onPress={() => sellMut.mutate()} disabled={sellMut.isPending}>
            <Text style={[s.actionBtnText, { color: C.warning }]}>{sellMut.isPending ? '...' : 'Sell'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.actionBtn, biz.auto_sell && { borderColor: C.success + '66', backgroundColor: C.success + '11' }]}
          onPress={() => autoSellMut.mutate()} disabled={autoSellMut.isPending}
        >
          <Text style={[s.actionBtnText, { color: biz.auto_sell ? C.success : C.dim }]}>
            Auto: {biz.auto_sell ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>
        {!needsWorkers && (
          <TouchableOpacity style={s.actionBtn} onPress={() => hireMut.mutate()} disabled={hireMut.isPending}>
            <Text style={s.actionBtnText}>{hireMut.isPending ? '...' : '+ Hire'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function BusinessList({ data }: { data: DashboardData }) {
  const { businesses } = data;
  if (!businesses || businesses.total === 0) return null;

  return (
    <View>
      <Text style={s.sectionTitle}>
        Businesses ({businesses.total}) \u00B7 {businesses.total_employees} workers
      </Text>
      {businesses.list.map((biz: BusinessDetail) => (
        <BusinessCard key={biz.id} biz={biz} />
      ))}
    </View>
  );
}

// ─── Alerts (compact) ───────────────────────────────────────

function AlertsFeed({ data }: { data: DashboardData }) {
  const { alerts: storeAlerts, markRead, markAllRead, setAlerts } = useAlertStore();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (data.alerts?.length) setAlerts(data.alerts);
  }, [data.alerts, setAlerts]);

  const markReadMut = useMutation({
    mutationFn: (id: string) => api.post(`/players/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });
  const markAllMut = useMutation({
    mutationFn: () => api.post('/players/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const alerts = storeAlerts.length > 0 ? storeAlerts.slice(0, 6) : (data.alerts ?? []).slice(0, 6);
  const unread = alerts.filter(a => !a.read).length;

  return (
    <Card style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>Activity</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={() => { markAllRead(); markAllMut.mutate(); }}>
            <Text style={s.markAllRead}>Clear ({unread})</Text>
          </TouchableOpacity>
        )}
      </View>
      {alerts.length === 0 ? (
        <Text style={s.emptyText}>No activity yet</Text>
      ) : (
        alerts.map(alert => (
          <TouchableOpacity
            key={alert.id}
            style={[s.alertRow, !alert.read && s.alertUnread]}
            onPress={() => { markRead(alert.id); markReadMut.mutate(alert.id); }}
          >
            <Text style={s.alertIcon}>{ALERT_ICONS[alert.type] ?? '\u{1F4E3}'}</Text>
            <Text style={[s.alertMsg, alert.read && { color: C.dim }]} numberOfLines={1}>
              {alert.message}
            </Text>
            <Text style={s.alertTime}>{formatTimestamp(alert.created_at)}</Text>
          </TouchableOpacity>
        ))
      )}
    </Card>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────

export function DashboardScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/players/dashboard'),
    refetchInterval: 30_000,
    staleTime: 15_000,
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
    return <EmptyState icon="\u26A0\uFE0F" title="Failed to load" subtitle="Pull down to retry" />;
  }

  const isNewPlayer = data.businesses.total === 0;

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} tintColor={C.primary} />
      }
    >
      {/* Hero: Cash + Stats */}
      <HeroSection data={data} />

      {/* New player tutorial */}
      {isNewPlayer && <GettingStartedCard />}

      {/* What to do next */}
      <NextActionBanner data={data} />

      {/* Empire batch actions */}
      {!isNewPlayer && <EmpireBar />}

      {/* Business list */}
      <BusinessList data={data} />

      {/* Recent activity */}
      <AlertsFeed data={data} />
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { padding: 16, paddingBottom: 32, gap: 12 },

  // Hero
  hero: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cashAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: C.bright,
  },
  trendPill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trendText: {
    fontSize: 13,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 14,
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: C.cardBorder,
    marginHorizontal: 4,
  },

  // Card base
  card: {
    backgroundColor: C.card,
    borderColor: C.cardBorder,
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: C.bright,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 13,
    color: C.dim,
    lineHeight: 20,
    marginBottom: 10,
  },
  ctaBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaBtnText: {
    color: '#0a0a0f',
    fontSize: 14,
    fontWeight: '700',
  },

  // Next Action
  nextActionContainer: { gap: 6 },
  nextActionBanner: {
    backgroundColor: C.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  nextActionTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  nextActionDetail: {
    fontSize: 11,
    color: C.dim,
    marginTop: 2,
  },

  // Empire Bar
  empireBar: { flexDirection: 'row', gap: 8 },
  empireBtn: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 2,
  },
  empireBtnIcon: { fontSize: 16 },
  empireBtnLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: C.dim,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Business Card
  bizCard: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  bizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bizName: {
    fontSize: 14,
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
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  invText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  bizActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    flexWrap: 'wrap',
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.dim,
  },

  // Alerts
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    gap: 8,
  },
  alertUnread: { backgroundColor: C.primary + '08' },
  alertIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  alertMsg: { flex: 1, fontSize: 12, color: C.text, lineHeight: 16 },
  alertTime: { fontSize: 10, color: '#4b5563' },
  markAllRead: { color: C.primary, fontSize: 12, fontWeight: '600' },
  emptyText: { color: C.dim, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
});
