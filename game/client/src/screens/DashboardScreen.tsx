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
import { Badge, HeatBadge, AlignmentBadge } from '../components/ui/Badge';
import { CurrencyText, formatCurrency } from '../components/ui/CurrencyText';
import { LoadingSkeleton } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { formatTimestamp, formatDaysRemaining } from '../lib/format';
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
const COLORS = {
  bg: '#0a0a0f',
  card: '#1a1a2e',
  cardBorder: '#2a2a3e',
  primary: '#6c5ce7',
  success: '#00d2d3',
  error: '#ff6b6b',
  warning: '#ffa502',
  text: '#e0e0e0',
  textDim: '#6b7280',
  textBright: '#f9fafb',
  accent: '#a29bfe',
};

const ALERT_ICONS: Record<AlertType, string> = {
  CONTRACT_SETTLED: '\u{1F91D}',
  CONTRACT_BREACHED: '\u{1F494}',
  EMPLOYEE_THEFT: '\u{1F575}\uFE0F',
  DETECTION_WARNING: '\u{1F6A8}',
  CRIME_COMPLETED: '\u{1F4B0}',
  CRIME_BUSTED: '\u{1F694}',
  LAUNDERING_COMPLETE: '\u2705',
  LAUNDERING_SEIZED: '\u26A0\uFE0F',
  BUSINESS_RAIDED: '\u{1F534}',
  SEASON_ENDING: '\u23F3',
  EMPLOYEE_QUIT: '\u{1F6AA}',
  MARKET_CONTRACT_OFFER: '\u{1F4CB}',
  REVENUE_REPORT: '\u{1F4C8}',
  HEAT_WARNING: '\u{1F525}',
  EVENT_STARTED: '\u26A1',
  SHIPMENT_ARRIVED: '\u{1F4E6}',
  SPY_DISCOVERED: '\u{1F440}',
  SPY_LOST: '\u{1F47B}',
  EMBEZZLEMENT_DETECTED: '\u{1F4B8}',
  BLOCKADE_COLLAPSED: '\u{1F6E1}\uFE0F',
};

const EVENT_CATEGORY_COLORS: Record<string, string> = {
  MARKET_CRASH: COLORS.error,
  SUPPLY_SURGE: COLORS.success,
  POLICE_CRACKDOWN: COLORS.warning,
  EMPLOYEE_STRIKE: COLORS.warning,
  RIVAL_COLLAPSE: COLORS.primary,
  DISASTER: COLORS.error,
  POLITICAL: COLORS.accent,
  BOOM: COLORS.success,
};

const HEAT_COLORS: Record<string, string> = {
  COLD: COLORS.success,
  WARM: '#ffd93d',
  HOT: COLORS.warning,
  BURNING: '#ff6348',
  FUGITIVE: COLORS.error,
};

// ─── Player Stats Header ──────────────────────────────────────

function PlayerStatsHeader({ data }: { data: DashboardData }) {
  const { player, rank } = data;
  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.playerName}>{player.username}</Text>
          <AlignmentBadge alignment={player.alignment} />
        </View>
        <View style={styles.rankBadge}>
          <Text style={styles.rankLabel}>RANK</Text>
          <Text style={styles.rankValue}>#{rank}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Cash</Text>
          <CurrencyText amount={player.cash} variant="clean" size="md" />
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Net Worth</Text>
          <CurrencyText amount={player.net_worth} variant="clean" size="md" style={{ color: COLORS.primary }} />
        </View>
      </View>
    </Card>
  );
}

// ─── Income Summary Card ──────────────────────────────────────

function IncomeSummaryCard({ data }: { data: DashboardData }) {
  const { income } = data;
  if (!income) return null;
  const { daily_revenue, daily_expenses, daily_net, per_tick_net, cash_trend } = income;
  const netColor = daily_net >= 0 ? COLORS.success : COLORS.error;
  const trendIcon = cash_trend === 'growing' ? '\u2191' : cash_trend === 'declining' ? '\u2193' : '\u2192';

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Daily Income</Text>
        <Text style={[styles.trendBadge, { color: netColor }]}>{trendIcon} {cash_trend}</Text>
      </View>
      <View style={styles.incomeRow}>
        <View style={styles.incomeItem}>
          <Text style={styles.incomeLabel}>Revenue</Text>
          <Text style={[styles.incomeValue, { color: COLORS.success }]}>
            +{formatCurrency(daily_revenue)}
          </Text>
        </View>
        <View style={styles.incomeItem}>
          <Text style={styles.incomeLabel}>Expenses</Text>
          <Text style={[styles.incomeValue, { color: COLORS.error }]}>
            -{formatCurrency(daily_expenses)}
          </Text>
        </View>
        <View style={styles.incomeItem}>
          <Text style={styles.incomeLabel}>Net/Day</Text>
          <Text style={[styles.incomeValue, { color: netColor, fontWeight: '800' }]}>
            {daily_net >= 0 ? '+' : ''}{formatCurrency(daily_net)}
          </Text>
        </View>
      </View>
      <Text style={styles.perTickNote}>({formatCurrency(per_tick_net)}/tick)</Text>
    </Card>
  );
}

// ─── Business Overview Card ───────────────────────────────────

function BusinessOverviewCard({ data }: { data: DashboardData }) {
  const { businesses } = data;
  if (!businesses || businesses.total === 0) return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Your Businesses</Text>
      <View style={styles.bizStatsRow}>
        <View style={styles.bizStatBox}>
          <Text style={styles.bizStatValue}>{businesses.total}</Text>
          <Text style={styles.bizStatLabel}>Businesses</Text>
        </View>
        <View style={styles.bizStatBox}>
          <Text style={styles.bizStatValue}>{businesses.total_employees}</Text>
          <Text style={styles.bizStatLabel}>Employees</Text>
        </View>
        <View style={styles.bizStatBox}>
          <Text style={styles.bizStatValue}>{businesses.avg_efficiency}%</Text>
          <Text style={styles.bizStatLabel}>Avg Efficiency</Text>
        </View>
      </View>

      {/* Per-business breakdown */}
      {businesses.list.map((biz: BusinessDetail) => (
        <View key={biz.id} style={styles.bizCard}>
          <View style={styles.bizCardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bizCardName}>{biz.name}</Text>
              <Text style={styles.bizCardMeta}>
                {biz.type.replace(/_/g, ' ')} \u00B7 Tier {biz.tier} \u00B7 {biz.city}
              </Text>
            </View>
            <View style={[styles.profitBadge, { backgroundColor: biz.profitable ? COLORS.success + '22' : COLORS.error + '22' }]}>
              <Text style={[styles.profitBadgeText, { color: biz.profitable ? COLORS.success : COLORS.error }]}>
                {biz.daily_net >= 0 ? '+' : ''}{formatCurrency(biz.daily_net)}/d
              </Text>
            </View>
          </View>

          <View style={styles.bizCardStats}>
            <Text style={styles.bizCardStat}>{biz.employees} workers</Text>
            <Text style={styles.bizCardStat}>{biz.efficiency}% eff</Text>
            {biz.inventory_count > 0 && (
              <Text style={[styles.bizCardStat, { color: COLORS.warning }]}>
                {biz.inventory_count} items (${formatCurrency(biz.inventory_value)})
              </Text>
            )}
          </View>

          {/* Production info */}
          {biz.production && (
            <View style={styles.productionRow}>
              {biz.production.status === 'idle_no_workers' ? (
                <Text style={[styles.productionText, { color: COLORS.error }]}>
                  No workers - not producing
                </Text>
              ) : (
                <Text style={[styles.productionText, { color: COLORS.success }]}>
                  Producing: {biz.production.produces.map(p =>
                    `${p.per_tick} ${p.resource}/tick`
                  ).join(', ')}
                </Text>
              )}
            </View>
          )}
        </View>
      ))}
    </Card>
  );
}

// ─── Next Actions Card ───────────────────────────────────────

const ACTION_CATEGORY_COLORS: Record<string, string> = {
  getting_started: COLORS.primary,
  growth: COLORS.success,
  revenue: COLORS.warning,
  expansion: COLORS.accent,
  optimization: '#00cec9',
  warning: COLORS.error,
};

const ACTION_CATEGORY_ICONS: Record<string, string> = {
  getting_started: '\u{1F680}',
  growth: '\u{1F4C8}',
  revenue: '\u{1F4B0}',
  expansion: '\u{1F3D7}\uFE0F',
  optimization: '\u2699\uFE0F',
  warning: '\u26A0\uFE0F',
};

function NextActionsCard({ data }: { data: DashboardData }) {
  const actions = data.next_actions;
  if (!actions || actions.length === 0) return null;

  return (
    <Card style={{...styles.card, ...styles.nextActionsCard}}>
      <Text style={styles.cardTitle}>What To Do Next</Text>
      {actions.map((action: NextAction, idx: number) => {
        const color = ACTION_CATEGORY_COLORS[action.category] ?? COLORS.primary;
        const icon = ACTION_CATEGORY_ICONS[action.category] ?? '\u27A1\uFE0F';
        return (
          <View key={idx} style={[styles.actionRow, idx === 0 && styles.actionRowFirst]}>
            <Text style={styles.actionIcon}>{icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionTitle, { color }]}>{action.action}</Text>
              <Text style={styles.actionDetail}>{action.detail}</Text>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

// ─── Active Events Banner ─────────────────────────────────────

function ActiveEventsBanner({ data }: { data: DashboardData & { active_events?: Array<{ id: string; category: string; title: string; description: string }> } }) {
  const events = data.active_events;
  if (!events || events.length === 0) return null;

  return (
    <View style={styles.eventsContainer}>
      {events.map((evt) => {
        const color = EVENT_CATEGORY_COLORS[evt.category] ?? COLORS.primary;
        return (
          <View key={evt.id} style={[styles.eventBanner, { borderLeftColor: color }]}>
            <View style={[styles.eventDot, { backgroundColor: color }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.eventTitle}>{evt.title}</Text>
              <Text style={styles.eventDesc} numberOfLines={1}>{evt.description}</Text>
            </View>
            <Text style={[styles.eventCategory, { color }]}>
              {evt.category.replace(/_/g, ' ')}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Progression Card ────────────────────────────────────────

function ProgressionCard({ data }: { data: DashboardData }) {
  const { progression } = data;
  if (!progression || !progression.next_upgrade) return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Upgrade Available</Text>
      <View style={styles.actionRow}>
        <Text style={styles.actionIcon}>{'\u2B06\uFE0F'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.actionTitle, { color: COLORS.success }]}>
            {progression.next_upgrade.business_name} → Tier {progression.next_upgrade.next_tier}
          </Text>
          <Text style={styles.actionDetail}>
            Cost: {formatCurrency(progression.next_upgrade.cost)}
            {progression.can_afford_upgrade ? ' (can afford!)' : ''}
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Heat Level Indicator ─────────────────────────────────────

function HeatIndicator({ data }: { data: DashboardData }) {
  const heat = data.crime?.heat;
  if (!heat) return null;

  const level = heat.level ?? 'COLD';
  const score = Number(heat.score ?? 0);
  const color = HEAT_COLORS[level] ?? COLORS.success;
  const pct = Math.min(100, (score / 1000) * 100);

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Heat Level</Text>
        <View style={[styles.heatBadge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.heatBadgeText, { color }]}>{level}</Text>
        </View>
      </View>
      <View style={styles.heatBarTrack}>
        <View style={[styles.heatBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.heatMeta}>
        <Text style={styles.heatMetaText}>Score: {score.toFixed(0)}/1000</Text>
        {heat.under_investigation && (
          <Text style={[styles.heatMetaText, { color: COLORS.error }]}>
            UNDER INVESTIGATION
          </Text>
        )}
      </View>
    </Card>
  );
}

// ─── Season Countdown ─────────────────────────────────────────

function SeasonCountdown({ data }: { data: DashboardData }) {
  const { season } = data;
  const daysLeft = formatDaysRemaining(season.ends_at);
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Season {season.season_number}</Text>
        <Badge
          label={season.status}
          variant={season.status === 'ENDING' ? 'orange' : 'green'}
        />
      </View>
      <Text style={styles.seasonName}>{season.name}</Text>
      <View style={styles.seasonRow}>
        <View>
          <Text style={styles.statLabel}>Days Remaining</Text>
          <Text style={styles.daysLeft}>{daysLeft}d</Text>
        </View>
        {season.special_rule && (
          <View style={styles.specialRule}>
            <Text style={styles.specialRuleText}>{season.special_rule}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

// ─── Quick Actions Grid ───────────────────────────────────────

function QuickActionsGrid() {
  const navigation = useNavigation<NavProp>();

  const actions = [
    { icon: '\u{1F3E2}', label: 'Create\nBusiness', tab: 'Business' as const },
    { icon: '\u{1F477}', label: 'Hire\nEmployee', tab: 'Business' as const },
    { icon: '\u{1F4CA}', label: 'Market', tab: 'Market' as const },
    { icon: '\u{1F525}', label: 'Crime\nOps', tab: 'Crime' as const },
  ];

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Quick Actions</Text>
      <View style={styles.quickActionsGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.quickBtn}
            onPress={() => navigation.navigate(action.tab)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickBtnIcon}>{action.icon}</Text>
            <Text style={styles.quickBtnLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </Card>
  );
}

// ─── Alert Row ────────────────────────────────────────────────

function AlertRow({ alert, onPress }: { alert: GameAlert; onPress: () => void }) {
  const icon = ALERT_ICONS[alert.type] ?? '\u{1F4E3}';
  return (
    <TouchableOpacity
      style={[styles.alertRow, !alert.read && styles.alertUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.alertIcon}>{icon}</Text>
      <View style={styles.alertContent}>
        <Text style={[styles.alertMessage, alert.read && styles.alertMessageRead]} numberOfLines={2}>
          {alert.message}
        </Text>
        <Text style={styles.alertTime}>{formatTimestamp(alert.created_at)}</Text>
      </View>
      {!alert.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

// ─── Alerts Feed ──────────────────────────────────────────────

function AlertsFeed({ data }: { data: DashboardData }) {
  const { alerts: storeAlerts, markRead, markAllRead, setAlerts } = useAlertStore();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (data.alerts?.length) {
      setAlerts(data.alerts);
    }
  }, [data.alerts, setAlerts]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.post(`/players/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/players/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
  });

  const alerts = storeAlerts.length > 0 ? storeAlerts.slice(0, 8) : (data.alerts ?? []).slice(0, 8);
  const unread = alerts.filter((a) => !a.read).length;

  const handleMarkRead = (id: string) => {
    markRead(id);
    markReadMutation.mutate(id);
  };

  const handleMarkAllRead = () => {
    markAllRead();
    markAllReadMutation.mutate();
  };

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Recent Activity</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      {alerts.length === 0 ? (
        <Text style={styles.emptyText}>No activity yet</Text>
      ) : (
        alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} onPress={() => handleMarkRead(alert.id)} />
        ))
      )}
    </Card>
  );
}

// ─── Main Dashboard Screen ────────────────────────────────────

export function DashboardScreen() {
  const navigation = useNavigation<NavProp>();

  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardData>('/players/dashboard'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  if (isLoading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <LoadingSkeleton rows={5} />
      </ScrollView>
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon="\u26A0\uFE0F"
        title="Failed to load dashboard"
        subtitle="Pull down to try again"
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    >
      <Text style={styles.screenTitle}>
        Welcome back, {data.player.username}
      </Text>

      {/* Next Actions - HIGHEST PRIORITY - tell the player what to do */}
      <NextActionsCard data={data} />

      {/* Player Stats Header */}
      <PlayerStatsHeader data={data} />

      {/* Income Summary */}
      <IncomeSummaryCard data={data} />

      {/* Business Overview with per-business breakdown */}
      <BusinessOverviewCard data={data} />

      {/* Heat Level Indicator */}
      <HeatIndicator data={data} />

      {/* Quick Actions */}
      <QuickActionsGrid />

      {/* Season Info */}
      <SeasonCountdown data={data} />

      {/* Recent Activity Feed */}
      <AlertsFeed data={data} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textBright,
    marginBottom: 4,
  },

  // Card base
  card: {
    marginBottom: 0,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textBright,
  },

  // Player Stats Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textBright,
    marginBottom: 4,
  },
  rankBadge: {
    backgroundColor: COLORS.primary + '22',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
  },
  rankLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  rankValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: 12,
  },

  // Next Actions Card
  nextActionsCard: {
    borderColor: COLORS.primary + '44',
    borderWidth: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  actionRowFirst: {
    borderTopWidth: 0,
    paddingTop: 4,
  },
  actionIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
    marginTop: 1,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionDetail: {
    fontSize: 12,
    color: COLORS.textDim,
    lineHeight: 17,
  },

  // Trend badge
  trendBadge: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  perTickNote: {
    fontSize: 11,
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 6,
  },

  // Income Summary
  incomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  incomeItem: {
    flex: 1,
    alignItems: 'center',
  },
  incomeLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  incomeValue: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Business Overview
  bizStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 8,
  },
  bizStatBox: {
    alignItems: 'center',
  },
  bizStatValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  bizStatLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  bizCard: {
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  bizCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  bizCardName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textBright,
  },
  bizCardMeta: {
    fontSize: 11,
    color: COLORS.textDim,
    marginTop: 1,
  },
  profitBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  profitBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  bizCardStats: {
    flexDirection: 'row',
    gap: 12,
  },
  bizCardStat: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
  },
  productionRow: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  productionText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Events Banner
  eventsContainer: {
    gap: 6,
  },
  eventBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderLeftWidth: 4,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textBright,
  },
  eventDesc: {
    fontSize: 11,
    color: COLORS.textDim,
    marginTop: 1,
  },
  eventCategory: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },


  // Heat Indicator
  heatBadge: {
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
  },
  heatBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heatBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1f1f3a',
    overflow: 'hidden',
    marginTop: 8,
  },
  heatBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  heatMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  heatMetaText: {
    fontSize: 11,
    color: COLORS.textDim,
    fontWeight: '600',
  },

  // Season
  seasonName: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  seasonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daysLeft: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.warning,
  },
  specialRule: {
    backgroundColor: COLORS.primary + '1a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '60%',
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
  },
  specialRuleText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  quickBtnIcon: {
    fontSize: 24,
  },
  quickBtnLabel: {
    fontSize: 10,
    color: COLORS.textDim,
    textAlign: 'center',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },

  // Alerts
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    gap: 10,
  },
  alertUnread: {},
  alertIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
    marginTop: 1,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },
  alertMessageRead: {
    color: COLORS.textDim,
  },
  alertTime: {
    fontSize: 11,
    color: '#4b5563',
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  emptyText: {
    color: COLORS.textDim,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  markAllRead: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },

});
