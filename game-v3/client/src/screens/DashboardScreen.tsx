import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useWebSocketChannel } from '../hooks/useWebSocket';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { CurrencyText, formatCurrencyCompact } from '../components/ui/CurrencyText';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingScreen } from '../components/ui/LoadingScreen';

interface DashboardBusiness {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  employee_count: number;
  total_inventory: number;
  storage_cap: number;
  production_per_tick: number;
  location_name: string;
  emoji: string;
  output_item: string | null;
  output_price: number;
  daily_cost: number;
  estimated_daily_revenue: number;
  estimated_daily_profit: number;
  max_employees: number;
}

interface ActivityEntry {
  type: string;
  message: string;
  amount: number | null;
  time: string;
}

interface DashboardData {
  player: {
    cash: number;
    bank_balance: number;
    level: number;
    xp: number;
    xpCurrent: number;
    xpForNext: number;
    unlock_phase: number;
    rank: string;
    dirty_money: number;
    heat_police: number;
    heat_rival: number;
    rep_street: number;
    rep_business: number;
    rep_underworld: number;
  };
  businesses: DashboardBusiness[];
  activity: ActivityEntry[];
  earnings: { income: number; expenses: number; profit: number };
  dailyCosts: { locations: number; salaries: number; total: number };
  suggestions: string[];
  tick: { interval_ms: number; last_tick_at: string | null };
  stats: { total_businesses: number; total_employees: number; total_inventory_value: number };
  events: { type: string; title: string; description: string; icon: string; ends_at: string }[];
  season: { number: number; name: string; ends_at: string } | null;
}

interface DiscoveryHint {
  id: string;
  key: string;
  ui_surface: string;
  reward_type: string;
  reward_payload: { message: string };
}

const activityIcons: Record<string, string> = {
  business_created: '\u{1F3D7}',
  business_upgraded: '\u{2B06}',
  business_closed: '\u{1F6AA}',
  employee_hired: '\u{1F464}',
  employee_fired: '\u{1F44B}',
  production: '\u{2699}',
  sale: '\u{1F4B0}',
  SALE: '\u{1F4B0}',
  AUTOSELL: '\u{1F4B0}',
  purchase: '\u{1F6D2}',
  DAILY_COST: '\u{1F4C9}',
  WARNING: '\u{26A0}',
  UNLOCK: '\u{1F513}',
  LEVEL_UP: '\u{2B50}',
  training_started: '\u{1F4DA}',
  DISCOVERY: '\u{1F4A1}',
  default: '\u{1F4CB}',
};

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const { show } = useToast();

  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/dashboard'),
    refetchInterval: 30000,
  });

  const { data: hints } = useQuery<DiscoveryHint[]>({
    queryKey: ['discovery'],
    queryFn: () => api.get<DiscoveryHint[]>('/discovery'),
    refetchInterval: 30000,
  });

  const dismissHint = useMutation({
    mutationFn: (ruleId: string) => api.post(`/discovery/${ruleId}/done`),
    onSuccess: () => {
      show('New insight gained! +150 XP', 'success');
      queryClient.invalidateQueries({ queryKey: ['discovery'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  // ─── Quick Action mutations ────────────────────
  const sellAll = useMutation({
    mutationFn: () => api.post<{ data: { sold: number; total_revenue: number; items: unknown[] } }>('/actions/sell-all'),
    onSuccess: (res) => {
      const d = (res as any).data ?? res;
      show(`Sold ${d.sold} items for $${d.total_revenue.toLocaleString()}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const autoSupply = useMutation({
    mutationFn: () => api.post<{ data: { transfers_count: number; transfers: unknown[] } }>('/actions/auto-supply'),
    onSuccess: (res) => {
      const d = (res as any).data ?? res;
      show(`Supplied ${d.transfers_count} factories`, 'success');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const depositBank = useMutation({
    mutationFn: (amount: number) => api.post('/actions/deposit', { amount }),
    onSuccess: () => {
      show('Deposited to bank', 'success');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const withdrawBank = useMutation({
    mutationFn: (amount: number) => api.post('/actions/withdraw', { amount }),
    onSuccess: () => {
      show('Withdrawn from bank', 'success');
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  // ─── WebSocket tick handlers ─────────────────────
  useWebSocketChannel('tick:production', () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['businesses'] });
  });
  useWebSocketChannel('tick:economy', () => {
    queryClient.invalidateQueries({ queryKey: ['market'] });
    queryClient.invalidateQueries({ queryKey: ['marketPrices'] });
    queryClient.invalidateQueries({ queryKey: ['marketListings'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['discovery'] });
  });
  useWebSocketChannel('tick:autosell', () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['businesses'] });
  });
  useWebSocketChannel('tick:daily', () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    queryClient.invalidateQueries({ queryKey: ['employeePool'] });
    queryClient.invalidateQueries({ queryKey: ['businesses'] });
  });

  const dashboardHints = (hints ?? []).filter((h) => h.ui_surface === 'dashboard');

  // ─── Edge case: idle businesses ─────────────────
  const hasIdleBusiness = data?.businesses?.some((b) => b.status === 'idle') ?? false;
  const hasNoWorkerBusiness = data?.businesses?.some((b) => b.employee_count === 0 && b.status === 'active') ?? false;

  // ─── Tick Countdown ──────────────────────────────
  const [tickCountdown, setTickCountdown] = useState<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const lastTickAt = data?.tick?.last_tick_at ?? null;
    const intervalMs = data?.tick?.interval_ms ?? 60000;

    const update = () => {
      if (!lastTickAt) {
        setTickCountdown(null);
        return;
      }
      const remaining = new Date(lastTickAt).getTime() + intervalMs - Date.now();
      setTickCountdown(Math.max(0, Math.ceil(remaining / 1000)));
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [data?.tick?.last_tick_at, data?.tick?.interval_ms]);

  useEffect(() => {
    if (tickCountdown !== null && tickCountdown <= 10 && tickCountdown > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [tickCountdown !== null && tickCountdown <= 10]);

  if (isLoading) {
    return <LoadingScreen message="Loading dashboard..." />;
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="\u{26A0}"
          title="Failed to load dashboard"
          action={
            <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          }
        />
      </View>
    );
  }

  const { player, businesses, activity, earnings, dailyCosts, suggestions, stats } = data;
  const xpProgress = player.xpForNext === Infinity ? 1 : player.xpCurrent / player.xpForNext;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#22c55e"
            colors={['#22c55e']}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Dashboard</Text>
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Edge Case Banners */}
        {hasIdleBusiness && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              {'\u26A0\uFE0F'} Some businesses suspended — add funds to resume
            </Text>
          </View>
        )}
        {hasNoWorkerBusiness && !hasIdleBusiness && (
          <View style={styles.warningBannerOrange}>
            <Text style={styles.warningTextOrange}>
              {'\u{1F464}'} Some businesses have no workers — production halted
            </Text>
          </View>
        )}

        {/* Player Hero */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <CurrencyText amount={player.cash} variant="clean" size="xl" />
              <View style={styles.bankRow}>
                <Text style={styles.heroSubtext}>
                  Bank: {formatCurrencyCompact(player.bank_balance)}
                </Text>
                <TouchableOpacity
                  style={styles.bankButton}
                  onPress={() => {
                    const amt = Math.floor(player.cash / 2);
                    if (amt > 0) depositBank.mutate(amt);
                    else show('No cash to deposit', 'error');
                  }}
                  disabled={depositBank.isPending}
                >
                  <Text style={styles.bankButtonText}>{'\u2193'} Deposit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.bankButton}
                  onPress={() => {
                    const amt = Math.floor(player.bank_balance);
                    if (amt > 0) withdrawBank.mutate(amt);
                    else show('Nothing in bank', 'error');
                  }}
                  disabled={withdrawBank.isPending}
                >
                  <Text style={styles.bankButtonText}>{'\u2191'} Withdraw</Text>
                </TouchableOpacity>
              </View>
              {(player.dirty_money > 0 || player.heat_police > 0) && (
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
                  {player.dirty_money > 0 && (
                    <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '600' }}>
                      💰 Dirty: ${player.dirty_money.toLocaleString()}
                    </Text>
                  )}
                  {player.heat_police > 0 && (
                    <Text style={{ color: player.heat_police >= 70 ? '#ef4444' : player.heat_police >= 30 ? '#f59e0b' : '#22c55e', fontSize: 13, fontWeight: '600' }}>
                      🔥 Heat: {player.heat_police}%
                    </Text>
                  )}
                </View>
              )}
            </View>
            <TouchableOpacity style={styles.heroRight} onPress={() => navigation.navigate('Profile')}>
              <Badge label={player.rank} variant="purple" size="md" />
              <Badge label={`Phase ${player.unlock_phase}`} variant="blue" size="sm" />
              <Text style={{ color: '#6b7280', fontSize: 10, marginTop: 2 }}>Profile →</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.xpRow}>
            <Text style={styles.xpLabel}>
              Lv.{player.level} — {player.xpCurrent}/{player.xpForNext === Infinity ? 'MAX' : player.xpForNext} XP
            </Text>
            <ProgressBar progress={xpProgress} color="#a855f7" height={6} />
          </View>
          {data.season && (
            <Text style={{ color: '#6b7280', fontSize: 11, fontWeight: '600', marginTop: 6 }}>
              Season {data.season.number}: {data.season.name} — {Math.max(0, Math.ceil((new Date(data.season.ends_at).getTime() - Date.now()) / 86400000))} days left
            </Text>
          )}
          {(player.rep_street !== 50 || player.rep_business !== 50 || player.rep_underworld !== 50) && (
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
              <Text style={{ color: '#3b82f6', fontSize: 11, fontWeight: '600' }}>
                {'\uD83D\uDCCD'} Street: {player.rep_street}
              </Text>
              <Text style={{ color: '#22c55e', fontSize: 11, fontWeight: '600' }}>
                {'\uD83D\uDCBC'} Business: {player.rep_business}
              </Text>
              <Text style={{ color: '#a855f7', fontSize: 11, fontWeight: '600' }}>
                {'\uD83D\uDD2E'} Underworld: {player.rep_underworld}
              </Text>
            </View>
          )}
        </Card>

        {/* Active Events */}
        {data.events && data.events.length > 0 && (
          <View style={styles.eventsSection}>
            <Text style={styles.sectionTitle}>Active Events</Text>
            {data.events.map((event, idx) => {
              const endsAt = new Date(event.ends_at).getTime();
              const now = Date.now();
              const minutesLeft = Math.max(0, Math.round((endsAt - now) / 60000));
              return (
                <View key={idx} style={styles.eventCard}>
                  <View style={styles.eventHeader}>
                    <Text style={styles.eventIcon}>{event.icon}</Text>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                  </View>
                  <Text style={styles.eventDescription}>{event.description}</Text>
                  <Text style={styles.eventCountdown}>
                    Ends in {minutesLeft} minute{minutesLeft !== 1 ? 's' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Discovery Hints */}
        {dashboardHints.length > 0 && (
          <View style={styles.hintsSection}>
            {dashboardHints.map((hint) => (
              <View key={hint.id} style={styles.hintCard}>
                <Text style={styles.hintIcon}>{'\u{1F4A1}'}</Text>
                <View style={styles.hintContent}>
                  <Text style={styles.hintMessage}>{hint.reward_payload.message}</Text>
                </View>
                <TouchableOpacity
                  style={styles.hintDismiss}
                  onPress={() => dismissHint.mutate(hint.id)}
                  disabled={dismissHint.isPending}
                >
                  <Text style={styles.hintDismissText}>Got it</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Next Steps / Suggestions */}
        {suggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionTitle}>Next Steps</Text>
            {suggestions.map((suggestion, idx) => (
              <View key={idx} style={styles.suggestionCard}>
                <Text style={styles.suggestionIcon}>{'\u{1F4A1}'}</Text>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              styles.quickActionSell,
              (businesses.length === 0 || sellAll.isPending) && styles.quickActionDisabled,
            ]}
            onPress={() => sellAll.mutate()}
            disabled={businesses.length === 0 || sellAll.isPending}
          >
            <Text style={styles.quickActionText}>
              {sellAll.isPending ? 'Selling...' : 'Sell All Inventory'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.quickActionButton,
              styles.quickActionSupply,
              (businesses.length === 0 || autoSupply.isPending) && styles.quickActionDisabled,
            ]}
            onPress={() => autoSupply.mutate()}
            disabled={businesses.length === 0 || autoSupply.isPending}
          >
            <Text style={styles.quickActionText}>
              {autoSupply.isPending ? 'Supplying...' : 'Auto-Supply Factories'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.total_businesses}</Text>
            <Text style={styles.statLabel}>Businesses</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{stats.total_employees}</Text>
            <Text style={styles.statLabel}>Employees</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: earnings.profit >= 0 ? '#22c55e' : '#ef4444' }]}>
              {formatCurrencyCompact(earnings.profit)}
            </Text>
            <Text style={styles.statLabel}>Profit/hr</Text>
          </View>
        </View>

        {/* Tick Countdown */}
        <View style={styles.tickCountdownRow}>
          {data.tick.last_tick_at === null ? (
            <Text style={styles.tickCountdownText}>Waiting for first tick...</Text>
          ) : (
            <>
              {tickCountdown !== null && tickCountdown <= 10 ? (
                <Animated.View style={[styles.tickDot, styles.tickDotGreen, { opacity: pulseAnim }]} />
              ) : (
                <View style={[styles.tickDot, styles.tickDotGray]} />
              )}
              <Text style={styles.tickCountdownText}>
                Next production tick in {tickCountdown ?? 0}s
              </Text>
            </>
          )}
        </View>

        {/* Earnings Card */}
        <Card style={styles.earningsCard}>
          <Text style={styles.earningsTitle}>Earnings (Last Hour)</Text>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Income</Text>
            <Text style={[styles.earningsValue, { color: '#22c55e' }]}>
              +{formatCurrencyCompact(earnings.income)}
            </Text>
          </View>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>Expenses</Text>
            <Text style={[styles.earningsValue, { color: '#ef4444' }]}>
              -{formatCurrencyCompact(earnings.expenses)}
            </Text>
          </View>
          <View style={[styles.earningsRow, styles.earningsDivider]}>
            <Text style={[styles.earningsLabel, { fontWeight: '700', color: '#f9fafb' }]}>Net Profit</Text>
            <Text style={[styles.earningsValue, { color: earnings.profit >= 0 ? '#22c55e' : '#ef4444', fontWeight: '800' }]}>
              {earnings.profit >= 0 ? '+' : ''}{formatCurrencyCompact(earnings.profit)}
            </Text>
          </View>
        </Card>

        {/* Daily Costs */}
        {dailyCosts && (
          <Card style={[
            styles.dailyCostsCard,
            dailyCosts.total > earnings.income && styles.dailyCostsCardWarning,
          ]}>
            <View style={styles.dailyCostsHeader}>
              <Text style={styles.dailyCostsTitle}>Daily Costs</Text>
              <Text style={[
                styles.dailyCostsTotal,
                { color: dailyCosts.total > earnings.income ? '#f59e0b' : '#f9fafb' },
              ]}>
                {formatCurrencyCompact(dailyCosts.total)}
              </Text>
            </View>
            <Text style={styles.dailyCostsBreakdown}>
              Rent: {formatCurrencyCompact(dailyCosts.locations)}  |  Salaries: {formatCurrencyCompact(dailyCosts.salaries)}
            </Text>
          </Card>
        )}

        {/* Businesses */}
        <Text style={styles.sectionTitle}>
          Your Businesses ({businesses.length})
        </Text>
        {businesses.length === 0 ? (
          <EmptyState
            icon="\u{1F3ED}"
            title="No businesses yet"
            subtitle="Go to the Businesses tab to buy your first one!"
          />
        ) : (
          businesses.map((biz) => {
            const storageRatio = biz.storage_cap > 0 ? biz.total_inventory / biz.storage_cap : 0;
            const storageColor = storageRatio > 0.9 ? '#ef4444' : storageRatio > 0.6 ? '#f59e0b' : '#22c55e';
            const isIdle = biz.status === 'idle';
            const noWorkers = biz.employee_count === 0;

            return (
              <Card key={biz.id} style={styles.bizCard}>
                <View style={styles.bizHeader}>
                  <Text style={styles.bizEmoji}>{biz.emoji}</Text>
                  <View style={styles.bizInfo}>
                    <Text style={styles.bizName}>{biz.name}</Text>
                    <Text style={styles.bizMeta}>
                      {biz.type} T{biz.tier} — {biz.location_name}
                    </Text>
                  </View>
                  <View style={styles.bizStats}>
                    {isIdle ? (
                      <Badge label="IDLE" variant="orange" size="sm" />
                    ) : noWorkers ? (
                      <Text style={styles.bizNoWorkers}>No workers</Text>
                    ) : (
                      <Text style={styles.bizStatValue}>
                        {biz.employee_count}/{biz.max_employees} workers
                      </Text>
                    )}
                  </View>
                </View>
                {/* Output & Profit row */}
                <View style={styles.bizDetailsRow}>
                  {biz.output_item && (
                    <Text style={styles.bizOutput}>
                      Produces: {biz.output_item}
                    </Text>
                  )}
                  <Text style={[
                    styles.bizDailyProfit,
                    { color: biz.estimated_daily_profit >= 0 ? '#22c55e' : '#ef4444' },
                  ]}>
                    {biz.estimated_daily_profit >= 0 ? '+' : ''}{formatCurrencyCompact(biz.estimated_daily_profit)}/day
                  </Text>
                </View>
                <View style={styles.bizStorageRow}>
                  <Text style={styles.bizStorageLabel}>
                    Storage: {Math.round(biz.total_inventory)}/{biz.storage_cap}
                  </Text>
                  <ProgressBar
                    progress={storageRatio}
                    color={storageColor}
                    height={4}
                    style={styles.bizStorageBar}
                  />
                </View>
                {biz.production_per_tick > 0 && (
                  <Text style={styles.bizProduction}>
                    +{biz.production_per_tick}/tick
                  </Text>
                )}
              </Card>
            );
          })
        )}

        {/* Activity Feed */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {activity.length === 0 ? (
          <Text style={styles.emptyActivity}>No activity yet</Text>
        ) : (
          activity.map((entry, idx) => (
            <View key={idx} style={styles.activityRow}>
              <Text style={styles.activityIcon}>
                {activityIcons[entry.type] ?? activityIcons.default}
              </Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityMessage} numberOfLines={1}>
                  {entry.message}
                </Text>
                <Text style={styles.activityTime}>
                  {new Date(entry.time).toLocaleTimeString()}
                </Text>
              </View>
              {entry.amount != null && entry.amount !== 0 && (
                <Text
                  style={[
                    styles.activityAmount,
                    { color: entry.amount > 0 ? '#22c55e' : '#ef4444' },
                  ]}
                >
                  {entry.amount > 0 ? '+' : ''}
                  {formatCurrencyCompact(entry.amount)}
                </Text>
              )}
            </View>
          ))
        )}

        {/* Quick Nav */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#1e3a5f', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => navigation.navigate('Leaderboard')}>
            <Text style={{ color: '#3b82f6', fontWeight: '700', fontSize: 13 }}>🏆 Ranking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#1a2e1a', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => navigation.navigate('GameInfo')}>
            <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 13 }}>📚 Info</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#2a1a3a', borderRadius: 10, padding: 12, alignItems: 'center' }} onPress={() => navigation.navigate('Intel')}>
            <Text style={{ color: '#a855f7', fontWeight: '700', fontSize: 13 }}>🔍 Intel</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 52,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f9fafb',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  logoutText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  heroCard: {
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  heroSubtext: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 4,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  bankButton: {
    backgroundColor: '#1f2937',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#374151',
  },
  bankButtonText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '700',
  },
  heroRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  xpRow: {
    gap: 6,
  },
  xpLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f9fafb',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '600',
  },
  earningsCard: {
    marginBottom: 20,
  },
  earningsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
    marginBottom: 10,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  earningsLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  earningsValue: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  earningsDivider: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 8,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#d1d5db',
    marginBottom: 10,
    marginTop: 4,
  },
  bizCard: {
    marginBottom: 10,
  },
  bizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bizEmoji: {
    fontSize: 28,
  },
  bizInfo: {
    flex: 1,
  },
  bizName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  bizMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  bizStats: {
    alignItems: 'flex-end',
  },
  bizStatValue: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  bizStorageRow: {
    marginTop: 10,
  },
  bizStorageLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '600',
  },
  bizStorageBar: {
    width: '100%',
  },
  bizProduction: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '700',
    marginTop: 6,
  },
  emptyActivity: {
    color: '#6b7280',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 20,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    gap: 10,
  },
  activityIcon: {
    fontSize: 18,
    width: 28,
    textAlign: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 13,
    color: '#d1d5db',
  },
  activityTime: {
    fontSize: 11,
    color: '#4b5563',
    marginTop: 2,
  },
  activityAmount: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  retryButton: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#030712',
    fontWeight: '700',
    fontSize: 14,
  },
  hintsSection: {
    marginBottom: 16,
    gap: 8,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1400',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a16207',
    padding: 12,
    gap: 10,
  },
  hintIcon: {
    fontSize: 20,
  },
  hintContent: {
    flex: 1,
  },
  hintMessage: {
    fontSize: 13,
    color: '#fbbf24',
    fontWeight: '600',
    lineHeight: 18,
  },
  hintDismiss: {
    backgroundColor: '#422006',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#a16207',
  },
  hintDismissText: {
    fontSize: 11,
    color: '#fbbf24',
    fontWeight: '700',
  },
  warningBanner: {
    backgroundColor: '#1a0505',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ef4444',
    padding: 12,
    marginBottom: 12,
  },
  warningText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  warningBannerOrange: {
    backgroundColor: '#1a1400',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    padding: 12,
    marginBottom: 12,
  },
  warningTextOrange: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  bizNoWorkers: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '700',
  },
  bizDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  bizOutput: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  bizDailyProfit: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  suggestionsSection: {
    marginBottom: 16,
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#22c55e',
    borderWidth: 1,
    borderColor: '#1f2937',
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  suggestionIcon: {
    fontSize: 18,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: '#d1d5db',
    fontWeight: '600',
    lineHeight: 18,
  },
  dailyCostsCard: {
    marginBottom: 20,
  },
  dailyCostsCardWarning: {
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  dailyCostsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dailyCostsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
  },
  dailyCostsTotal: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  dailyCostsBreakdown: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  quickActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionSell: {
    backgroundColor: '#166534',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  quickActionSupply: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  quickActionDisabled: {
    opacity: 0.4,
  },
  quickActionText: {
    color: '#f9fafb',
    fontSize: 13,
    fontWeight: '700',
  },
  eventsSection: {
    marginBottom: 16,
  },
  eventCard: {
    backgroundColor: '#1a1400',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fbbf24',
    padding: 12,
    marginBottom: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  eventIcon: {
    fontSize: 18,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fbbf24',
  },
  eventDescription: {
    fontSize: 13,
    color: '#d1d5db',
    lineHeight: 18,
    marginBottom: 6,
  },
  eventCountdown: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
  },
  tickCountdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  tickCountdownText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    textAlign: 'center',
  },
  tickDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tickDotGreen: {
    backgroundColor: '#22c55e',
  },
  tickDotGray: {
    backgroundColor: '#4b5563',
  },
  footer: {
    height: 32,
  },
});
