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
import { CountdownTimer } from '../components/ui/CountdownTimer';
import { CurrencyText, formatCurrency } from '../components/ui/CurrencyText';
import { LoadingSkeleton } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { formatTimestamp, formatDaysRemaining } from '../lib/format';
import type {
  DashboardData,
  GameAlert,
  AlertType,
  CriminalOperation,
  LaunderingProcess,
  ReputationProfile,
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
  const { income_summary } = data;
  if (!income_summary) return null;
  const { revenue_per_tick, expenses_per_tick, net_per_tick } = income_summary;
  const netColor = net_per_tick >= 0 ? COLORS.success : COLORS.error;

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Income per Tick</Text>
      <View style={styles.incomeRow}>
        <View style={styles.incomeItem}>
          <Text style={styles.incomeLabel}>Revenue</Text>
          <Text style={[styles.incomeValue, { color: COLORS.success }]}>
            +{formatCurrency(revenue_per_tick)}
          </Text>
        </View>
        <View style={styles.incomeItem}>
          <Text style={styles.incomeLabel}>Expenses</Text>
          <Text style={[styles.incomeValue, { color: COLORS.error }]}>
            -{formatCurrency(expenses_per_tick)}
          </Text>
        </View>
        <View style={styles.incomeItem}>
          <Text style={styles.incomeLabel}>Net</Text>
          <Text style={[styles.incomeValue, { color: netColor, fontWeight: '800' }]}>
            {net_per_tick >= 0 ? '+' : ''}{formatCurrency(net_per_tick)}
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ─── Business Overview Card ───────────────────────────────────

function BusinessOverviewCard({ data }: { data: DashboardData }) {
  const { business_overview } = data;
  if (!business_overview || business_overview.total === 0) return null;

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Business Overview</Text>
      <View style={styles.bizStatsRow}>
        <View style={styles.bizStatBox}>
          <Text style={styles.bizStatValue}>{business_overview.total}</Text>
          <Text style={styles.bizStatLabel}>Businesses</Text>
        </View>
        <View style={styles.bizStatBox}>
          <Text style={styles.bizStatValue}>{business_overview.total_employees}</Text>
          <Text style={styles.bizStatLabel}>Employees</Text>
        </View>
        <View style={styles.bizStatBox}>
          <Text style={styles.bizStatValue}>{business_overview.avg_efficiency}%</Text>
          <Text style={styles.bizStatLabel}>Avg Efficiency</Text>
        </View>
      </View>
      {Object.keys(business_overview.by_type).length > 0 && (
        <View style={styles.bizTypeRow}>
          {Object.entries(business_overview.by_type).map(([type, count]) => (
            <View key={type} style={styles.bizTypeChip}>
              <Text style={styles.bizTypeText}>
                {type.replace(/_/g, ' ')} x{count}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// ─── Active Events Banner ─────────────────────────────────────

function ActiveEventsBanner({ data }: { data: DashboardData }) {
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

// ─── Reputation Mini-Chart ────────────────────────────────────

function ReputationChart({ data }: { data: DashboardData }) {
  const reputation = data.reputation;
  if (!reputation || reputation.length === 0) return null;

  const axisLabels: Record<string, string> = {
    BUSINESS: 'Business',
    CRIMINAL: 'Criminal',
    NEGOTIATION: 'Negotiation',
    EMPLOYEE: 'Employee',
    COMMUNITY: 'Community',
    RELIABILITY: 'Reliability',
  };

  const axisColors: Record<string, string> = {
    BUSINESS: COLORS.primary,
    CRIMINAL: COLORS.error,
    NEGOTIATION: COLORS.warning,
    EMPLOYEE: COLORS.success,
    COMMUNITY: COLORS.accent,
    RELIABILITY: '#00cec9',
  };

  return (
    <Card style={styles.card}>
      <Text style={styles.cardTitle}>Reputation</Text>
      {reputation.map((rep) => (
        <View key={rep.axis} style={styles.repRow}>
          <Text style={styles.repLabel}>{axisLabels[rep.axis] ?? rep.axis}</Text>
          <View style={styles.repBarTrack}>
            <View
              style={[
                styles.repBarFill,
                {
                  width: `${rep.score}%`,
                  backgroundColor: axisColors[rep.axis] ?? COLORS.primary,
                },
              ]}
            />
          </View>
          <Text style={styles.repScore}>{rep.score}</Text>
        </View>
      ))}
    </Card>
  );
}

// ─── Heat Level Indicator ─────────────────────────────────────

function HeatIndicator({ data }: { data: DashboardData }) {
  const heat = data.heat;
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

// ─── Active Operations ────────────────────────────────────────

function ActiveOpRow({ op }: { op: CriminalOperation }) {
  const riskColor = op.risk_level >= 7 ? COLORS.error : op.risk_level >= 4 ? COLORS.warning : COLORS.success;
  return (
    <View style={styles.opRow}>
      <View style={styles.opInfo}>
        <Text style={styles.opName}>{op.op_type.replace(/_/g, ' ')}</Text>
        <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
      </View>
      <CountdownTimer target={op.completes_at} style={styles.opTimer} />
    </View>
  );
}

function LaunderRow({ process }: { process: LaunderingProcess }) {
  const now = Date.now();
  const total = new Date(process.completes_at).getTime() - new Date(process.started_at).getTime();
  const elapsed = now - new Date(process.started_at).getTime();
  const progress = Math.min(1, Math.max(0, elapsed / total));

  return (
    <View style={styles.launderRow}>
      <View style={styles.launderHeader}>
        <Text style={styles.opName}>{process.method.replace(/_/g, ' ')}</Text>
        <Text style={styles.launderAmount}>{formatCurrency(process.dirty_amount)}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{Math.round(progress * 100)}% complete</Text>
    </View>
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

      {/* Active Events Banner - top priority */}
      <ActiveEventsBanner data={data} />

      {/* Player Stats Header */}
      <PlayerStatsHeader data={data} />

      {/* Income Summary */}
      <IncomeSummaryCard data={data} />

      {/* Business Overview */}
      <BusinessOverviewCard data={data} />

      {/* Heat Level Indicator */}
      <HeatIndicator data={data} />

      {/* Season Info */}
      <SeasonCountdown data={data} />

      {/* Reputation Chart */}
      <ReputationChart data={data} />

      {/* Quick Actions */}
      <QuickActionsGrid />

      {/* Active Crime Operations */}
      {data.active_ops.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Active Operations</Text>
          {data.active_ops.map((op) => (
            <ActiveOpRow key={op.id} op={op} />
          ))}
        </Card>
      )}

      {/* Active Laundering */}
      {data.active_laundering.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Laundering in Progress</Text>
          {data.active_laundering.map((p) => (
            <LaunderRow key={p.id} process={p} />
          ))}
        </Card>
      )}

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
  bizTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  bizTypeChip: {
    backgroundColor: COLORS.primary + '1a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.primary + '33',
  },
  bizTypeText: {
    fontSize: 10,
    color: COLORS.accent,
    fontWeight: '600',
    textTransform: 'capitalize',
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

  // Reputation Chart
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  repLabel: {
    width: 80,
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '600',
  },
  repBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1f1f3a',
    overflow: 'hidden',
  },
  repBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  repScore: {
    width: 28,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
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

  // Operations
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  opInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  opName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  riskDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  opTimer: {
    fontSize: 13,
    fontWeight: '700',
  },
  launderRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  launderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  launderAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.error,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1f1f3a',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: COLORS.success,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.textDim,
    marginTop: 4,
  },
});
