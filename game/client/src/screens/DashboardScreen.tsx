import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
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
import type { DashboardData, GameAlert, AlertType, CriminalOperation, LaunderingProcess } from '@economy-game/shared';
import type { MainTabParamList } from '../navigation/MainTabs';

type NavProp = BottomTabNavigationProp<MainTabParamList>;

const ALERT_ICONS: Record<AlertType, string> = {
  CONTRACT_SETTLED: '🤝',
  CONTRACT_BREACHED: '💔',
  EMPLOYEE_THEFT: '🕵️',
  DETECTION_WARNING: '🚨',
  CRIME_COMPLETED: '💰',
  CRIME_BUSTED: '🚔',
  LAUNDERING_COMPLETE: '✅',
  LAUNDERING_SEIZED: '⚠️',
  BUSINESS_RAIDED: '🔴',
  SEASON_ENDING: '⏳',
  EMPLOYEE_QUIT: '🚪',
  MARKET_CONTRACT_OFFER: '📋',
};

function NetWorthCard({ data }: { data: DashboardData }) {
  const { player, rank } = data;
  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Net Worth</Text>
        <AlignmentBadge alignment={player.alignment} />
      </View>
      <CurrencyText amount={player.net_worth} variant="clean" size="xl" style={styles.netWorth} />
      <View style={styles.row}>
        <View style={styles.moneyItem}>
          <Text style={styles.moneyLabel}>Clean Cash</Text>
          <CurrencyText amount={player.cash} variant="clean" size="md" />
        </View>
        <View style={styles.divider} />
        <View style={styles.moneyItem}>
          <Text style={styles.moneyLabel}>Season Rank</Text>
          <Text style={styles.rankText}>#{rank}</Text>
        </View>
      </View>
    </Card>
  );
}

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
          <Text style={styles.moneyLabel}>Days Remaining</Text>
          <Text style={styles.daysLeft}>{daysLeft}d</Text>
        </View>
        {season.special_rule && (
          <View style={styles.specialRule}>
            <Text style={styles.specialRuleText}>⚡ {season.special_rule}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

function AlertRow({ alert, onPress }: { alert: GameAlert; onPress: () => void }) {
  const icon = ALERT_ICONS[alert.type] ?? '📣';
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

function AlertsFeed({ data }: { data: DashboardData }) {
  const { alerts: storeAlerts, markRead, markAllRead, setAlerts } = useAlertStore();

  React.useEffect(() => {
    if (data.alerts?.length) {
      setAlerts(data.alerts);
    }
  }, [data.alerts, setAlerts]);

  const alerts = storeAlerts.length > 0 ? storeAlerts.slice(0, 10) : (data.alerts ?? []).slice(0, 10);
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Alerts</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllRead}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>
      {alerts.length === 0 ? (
        <Text style={styles.emptyText}>No alerts yet</Text>
      ) : (
        alerts.map((alert) => (
          <AlertRow key={alert.id} alert={alert} onPress={() => markRead(alert.id)} />
        ))
      )}
    </Card>
  );
}

function ActiveOpRow({ op }: { op: CriminalOperation }) {
  const riskColor = op.risk_level >= 7 ? '#ef4444' : op.risk_level >= 4 ? '#f97316' : '#22c55e';
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
        icon="⚠️"
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
          tintColor="#22c55e"
        />
      }
    >
      <Text style={styles.screenTitle}>
        Welcome back, {data.player.username}
      </Text>

      <NetWorthCard data={data} />
      <SeasonCountdown data={data} />
      <AlertsFeed data={data} />

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

      {/* Quick Actions */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('Market')}
          >
            <Text style={styles.quickBtnIcon}>📊</Text>
            <Text style={styles.quickBtnLabel}>Buy Resources</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('Business')}
          >
            <Text style={styles.quickBtnIcon}>🏢</Text>
            <Text style={styles.quickBtnLabel}>Manage Business</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => navigation.navigate('Business')}
          >
            <Text style={styles.quickBtnIcon}>👷</Text>
            <Text style={styles.quickBtnLabel}>Hire Staff</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#030712',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  card: {
    marginBottom: 0,
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
    color: '#f9fafb',
  },
  netWorth: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moneyItem: {
    flex: 1,
  },
  moneyLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: '#1f2937',
    marginHorizontal: 12,
  },
  rankText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3b82f6',
  },
  seasonName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d1d5db',
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
    color: '#f97316',
  },
  specialRule: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '60%',
  },
  specialRuleText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '600',
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    gap: 10,
  },
  alertUnread: {
    // highlighted by unread dot
  },
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
    color: '#d1d5db',
    lineHeight: 18,
  },
  alertMessageRead: {
    color: '#6b7280',
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
    backgroundColor: '#3b82f6',
    marginTop: 4,
  },
  emptyText: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  markAllRead: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  opRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  opInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  opName: {
    fontSize: 13,
    color: '#d1d5db',
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
    borderTopColor: '#1f2937',
  },
  launderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  launderAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ef4444',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#22c55e',
  },
  progressLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  quickBtnIcon: {
    fontSize: 22,
  },
  quickBtnLabel: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    fontWeight: '600',
  },
});
