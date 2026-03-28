import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CurrencyText, formatCurrency } from '../components/ui/CurrencyText';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';

// ─── Types ─────────────────────────────────────────

interface PlayerEntry {
  id: string;
  username: string;
  level: number;
  business_count: number;
}

interface SpyReport {
  username: string;
  level: number;
  estimated_wealth: number;
  business_count: number;
  employee_count: number;
  business_types: string[];
  heat_level: string;
  reputation: string;
  criminal_activity: string;
  accuracy: number;
}

interface SpyResult {
  report: SpyReport;
  cost: number;
}

interface IntelReport {
  id: string;
  target_username: string;
  report_data: SpyReport;
  cost: number;
  created_at: string;
}

// ─── Helpers ───────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getHeatVariant(heat: string): 'gray' | 'yellow' | 'orange' | 'red' | 'purple' {
  switch (heat.toUpperCase()) {
    case 'HOT':
    case 'BURNING':
      return 'red';
    case 'WARM':
      return 'orange';
    case 'FUGITIVE':
      return 'purple';
    default:
      return 'gray';
  }
}

function getActivityVariant(activity: string): 'gray' | 'yellow' | 'orange' | 'red' {
  switch (activity.toLowerCase()) {
    case 'heavy':
      return 'red';
    case 'moderate':
      return 'orange';
    case 'light':
      return 'yellow';
    default:
      return 'gray';
  }
}

// ─── Report Card Component ─────────────────────────

function ReportCard({ report }: { report: SpyReport }) {
  return (
    <View style={styles.reportGrid}>
      <ReportRow label="Level" value={`${report.level}`} />
      <ReportRow label="Est. Wealth" value={formatCurrency(report.estimated_wealth)} valueColor="#22c55e" />
      <ReportRow label="Businesses" value={`${report.business_count}`} />
      <ReportRow label="Employees" value={`${report.employee_count}`} />
      {report.business_types.length > 0 && (
        <ReportRow label="Biz Types" value={report.business_types.join(', ')} />
      )}
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>Heat</Text>
        <Badge label={report.heat_level} variant={getHeatVariant(report.heat_level)} size="sm" />
      </View>
      <ReportRow label="Reputation" value={report.reputation} />
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>Crime</Text>
        <Badge label={report.criminal_activity} variant={getActivityVariant(report.criminal_activity)} size="sm" />
      </View>
      <View style={styles.reportRow}>
        <Text style={styles.reportLabel}>Accuracy</Text>
        <View style={styles.accuracyBarContainer}>
          <View style={[styles.accuracyBar, { width: `${report.accuracy}%` }]} />
        </View>
        <Text style={styles.accuracyText}>{report.accuracy}%</Text>
      </View>
    </View>
  );
}

function ReportRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.reportRow}>
      <Text style={styles.reportLabel}>{label}</Text>
      <Text style={[styles.reportValue, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
    </View>
  );
}

// ─── Component ──────────────────────────────────────

export function IntelScreen() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [confirmTarget, setConfirmTarget] = useState<PlayerEntry | null>(null);
  const [latestReport, setLatestReport] = useState<SpyResult | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Queries ─────────────────────────────────────

  const {
    data: players,
    isLoading: playersLoading,
    refetch: refetchPlayers,
  } = useQuery<PlayerEntry[]>({
    queryKey: ['intelPlayers'],
    queryFn: () => api.get<PlayerEntry[]>('/intel/players'),
    refetchInterval: 30000,
  });

  const {
    data: reports,
    isLoading: reportsLoading,
    refetch: refetchReports,
  } = useQuery<IntelReport[]>({
    queryKey: ['intelReports'],
    queryFn: () => api.get<IntelReport[]>('/intel/reports'),
    refetchInterval: 30000,
  });

  // ─── Mutations ───────────────────────────────────

  const spyMutation = useMutation({
    mutationFn: (targetId: string) =>
      api.post<SpyResult>('/intel/spy', { target_id: targetId }),
    onSuccess: (data) => {
      setLatestReport(data);
      show(`Intel gathered on ${data.report.username} for ${formatCurrency(data.cost)}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['intelReports'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setConfirmTarget(null);
    },
    onError: (err: Error) => {
      show(err.message, 'error');
      setConfirmTarget(null);
    },
  });

  // ─── Refresh ─────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refetchPlayers(), refetchReports()]);
    setIsRefreshing(false);
  }, [refetchPlayers, refetchReports]);

  // ─── Loading ─────────────────────────────────────

  if (playersLoading && reportsLoading) {
    return <LoadingScreen message="Gathering intel..." />;
  }

  // ─── Render ──────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
      >
        {/* Header */}
        <Text style={styles.title}>{'\uD83D\uDD75\uFE0F'} Intelligence</Text>

        {/* ─── Section 1: Spy on Player ─────────────── */}
        <Text style={styles.sectionTitle}>Spy on Player</Text>

        {/* Latest Report Result */}
        {latestReport && (
          <Card style={styles.latestReportCard}>
            <View style={styles.latestReportHeader}>
              <Text style={styles.latestReportTitle}>
                {'\uD83D\uDCCB'} Report: {latestReport.report.username}
              </Text>
              <TouchableOpacity onPress={() => setLatestReport(null)}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
            <ReportCard report={latestReport.report} />
            <Text style={styles.costLine}>
              Cost: <Text style={styles.costValue}>{formatCurrency(latestReport.cost)}</Text>
            </Text>
          </Card>
        )}

        {/* Player List */}
        {!players || players.length === 0 ? (
          <EmptyState
            icon={'\uD83D\uDC64'}
            title="No players found"
            subtitle="No other players to spy on yet"
          />
        ) : (
          <View style={styles.playerList}>
            {players.map((player) => (
              <View key={player.id} style={styles.playerRow}>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{player.username}</Text>
                  <View style={styles.playerMeta}>
                    <Badge label={`Lv.${player.level}`} variant="blue" size="sm" />
                    <Text style={styles.playerBizCount}>
                      {player.business_count} {player.business_count === 1 ? 'biz' : 'biz'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.spyButton}
                  onPress={() => setConfirmTarget(player)}
                  disabled={spyMutation.isPending}
                >
                  <Text style={styles.spyButtonText}>Spy ($2,000)</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ─── Section 2: Intel Reports ─────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Intel Reports</Text>

        {reportsLoading ? (
          <Text style={styles.loadingText}>Loading reports...</Text>
        ) : !reports || reports.length === 0 ? (
          <EmptyState
            icon={'\uD83D\uDCC1'}
            title="No reports yet"
            subtitle="Spy on a player to generate your first intel report"
          />
        ) : (
          <View style={styles.reportsList}>
            {reports.map((report) => {
              const isExpanded = expandedReportId === report.id;
              return (
                <TouchableOpacity
                  key={report.id}
                  style={styles.reportItem}
                  onPress={() => setExpandedReportId(isExpanded ? null : report.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.reportItemHeader}>
                    <View style={styles.reportItemLeft}>
                      <Text style={styles.reportTargetName}>{report.target_username}</Text>
                      <Text style={styles.reportDate}>{formatDate(report.created_at)}</Text>
                    </View>
                    <View style={styles.reportItemRight}>
                      <Text style={styles.reportCost}>{formatCurrency(report.cost)}</Text>
                      <Text style={styles.expandIcon}>{isExpanded ? '\u25B2' : '\u25BC'}</Text>
                    </View>
                  </View>
                  {isExpanded && (
                    <View style={styles.expandedReport}>
                      <ReportCard report={report.report_data} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Confirm Spy Modal */}
      <ConfirmModal
        visible={!!confirmTarget}
        title="Confirm Spy Operation"
        message={
          confirmTarget
            ? `Spend $2,000 to gather intel on ${confirmTarget.username}?`
            : ''
        }
        confirmLabel="Spy"
        onConfirm={() => {
          if (confirmTarget) {
            spyMutation.mutate(confirmTarget.id);
          }
        }}
        onCancel={() => setConfirmTarget(null)}
        isLoading={spyMutation.isPending}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────

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
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f9fafb',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 16,
  },

  // ─── Latest Report Card ──────────────────────────
  latestReportCard: {
    borderColor: '#3b82f6',
    borderWidth: 1.5,
    marginBottom: 16,
  },
  latestReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  latestReportTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  dismissText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  costLine: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 10,
    textAlign: 'right',
  },
  costValue: {
    color: '#ef4444',
    fontWeight: '700',
  },

  // ─── Player List ─────────────────────────────────
  playerList: {
    gap: 6,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerBizCount: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  spyButton: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginLeft: 12,
  },
  spyButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
  },

  // ─── Report Card (shared) ────────────────────────
  reportGrid: {
    gap: 6,
  },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  reportLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    width: 90,
  },
  reportValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d1d5db',
    flex: 1,
    textAlign: 'right',
  },

  // ─── Accuracy Bar ────────────────────────────────
  accuracyBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#1f2937',
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  accuracyBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  accuracyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3b82f6',
    width: 36,
    textAlign: 'right',
  },

  // ─── Reports List ────────────────────────────────
  reportsList: {
    gap: 6,
  },
  reportItem: {
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  reportItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportItemLeft: {
    flex: 1,
  },
  reportTargetName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },
  reportDate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  reportItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportCost: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
  },
  expandIcon: {
    fontSize: 10,
    color: '#6b7280',
  },
  expandedReport: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
});
