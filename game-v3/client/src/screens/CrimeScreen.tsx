import React, { useState, useMemo } from 'react';
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
import { Badge, StatusBadge } from '../components/ui/Badge';
import { CurrencyText, formatCurrency } from '../components/ui/CurrencyText';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CountdownTimer } from '../components/ui/CountdownTimer';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { StatBar } from '../components/ui/StatBar';

// ─── Types ─────────────────────────────────────────

interface CrimeStatus {
  dirty_money: string;
  heat_police: number;
  heat_rival: number;
  heat_fed: number;
  active_ops: number;
  active_laundering: number;
}

interface CrimeType {
  type: string;
  name: string;
  description: string;
  icon: string;
  duration_minutes: number;
  risk: number;
  reward_range: [number, number];
}

interface CrimeOperation {
  id: string;
  type: string;
  target_desc: string;
  risk_level: number;
  reward_min: string;
  reward_max: string;
  status: string;
  started_at: string;
  resolves_at: string;
  resolved_at: string | null;
  result_amount: string | null;
  result_message: string | null;
}

interface LaunderingJob {
  id: string;
  dirty_amount: string;
  clean_amount: string | null;
  efficiency: string;
  risk_level: number;
  status: string;
  started_at: string;
  resolves_at: string;
  resolved_at: string | null;
  business_name: string;
  business_type: string;
}

interface Business {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
}

interface ResolveResult {
  resolved: number;
  results: { id: string; success: boolean; amount?: number; clean_amount?: number; message: string }[];
}

interface StartOpResult {
  operation_id: string;
  type: string;
  name: string;
  risk_level: number;
  resolves_at: string;
  message: string;
}

interface LaunderResult {
  job_id: string;
  business: string;
  dirty_amount: number;
  efficiency: number;
  risk_level: number;
  resolves_at: string;
  duration_minutes: number;
  estimated_clean: number;
}

interface RivalPlayer {
  id: string;
  username: string;
  level: number;
  business_count: number;
}

interface SabotageResult {
  success: boolean;
  type?: string;
  target?: string;
  cost?: number;
  message: string;
}

interface SabotageDef {
  type: 'disruption' | 'arson' | 'data_leak';
  name: string;
  description: string;
  icon: string;
  cost: number;
}

const SABOTAGE_TYPES: SabotageDef[] = [
  {
    type: 'disruption',
    name: 'Supply Disruption',
    description: 'Disrupt supply lines, halting production for 30 minutes.',
    icon: '\u26A0\uFE0F',
    cost: 5000,
  },
  {
    type: 'arson',
    name: 'Arson',
    description: 'Set fire to downgrade a business tier. High heat gain.',
    icon: '\uD83D\uDD25',
    cost: 15000,
  },
  {
    type: 'data_leak',
    name: 'Data Leak',
    description: 'Hack systems to reveal inventory value and business details.',
    icon: '\uD83D\uDCBB',
    cost: 8000,
  },
];

// ─── Tab definition ─────────────────────────────────

type TabKey = 'operations' | 'laundering' | 'sabotage' | 'history';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'operations', label: 'Operations' },
  { key: 'laundering', label: 'Laundering' },
  { key: 'sabotage', label: 'Sabotage' },
  { key: 'history', label: 'History' },
];

// ─── Helpers ────────────────────────────────────────

function getStatusBadgeVariant(status: string): 'green' | 'red' | 'orange' | 'gray' | 'yellow' {
  switch (status) {
    case 'success':
    case 'completed':
      return 'green';
    case 'failed':
    case 'busted':
      return 'red';
    case 'detected':
      return 'orange';
    case 'active':
      return 'yellow';
    default:
      return 'gray';
  }
}

function heatColor(heat: number): string {
  if (heat >= 75) return '#ef4444';
  if (heat >= 50) return '#f97316';
  if (heat >= 25) return '#f59e0b';
  return '#22c55e';
}

function computeProgress(startedAt: string, resolvesAt: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(resolvesAt).getTime();
  const now = Date.now();
  if (now >= end) return 1;
  if (now <= start) return 0;
  return (now - start) / (end - start);
}

// ─── Component ──────────────────────────────────────

export function CrimeScreen() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('operations');

  // Launder modal state
  const [launderModalVisible, setLaunderModalVisible] = useState(false);
  const [launderBizId, setLaunderBizId] = useState<string | null>(null);
  const [launderAmount, setLaunderAmount] = useState('');

  // Confirm start crime
  const [confirmCrime, setConfirmCrime] = useState<CrimeType | null>(null);

  // Sabotage state
  const [selectedSabotageType, setSelectedSabotageType] = useState<SabotageDef | null>(null);
  const [selectedTargetPlayer, setSelectedTargetPlayer] = useState<RivalPlayer | null>(null);
  const [sabotageConfirmVisible, setSabotageConfirmVisible] = useState(false);

  // ─── Queries ─────────────────────────────────────

  const {
    data: status,
    isLoading: statusLoading,
    refetch: refetchStatus,
    isRefetching: statusRefetching,
  } = useQuery<CrimeStatus>({
    queryKey: ['crimeStatus'],
    queryFn: () => api.get<CrimeStatus>('/crime/status'),
    refetchInterval: 15000,
  });

  const {
    data: crimeTypes,
    isLoading: typesLoading,
  } = useQuery<CrimeType[]>({
    queryKey: ['crimeTypes'],
    queryFn: () => api.get<CrimeType[]>('/crime/types'),
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: activeOps,
    isLoading: opsLoading,
    refetch: refetchOps,
    isRefetching: opsRefetching,
  } = useQuery<CrimeOperation[]>({
    queryKey: ['crimeActive'],
    queryFn: () => api.get<CrimeOperation[]>('/crime/active'),
    refetchInterval: 10000,
  });

  const {
    data: launderingJobs,
    isLoading: launderingLoading,
    refetch: refetchLaundering,
    isRefetching: launderingRefetching,
  } = useQuery<LaunderingJob[]>({
    queryKey: ['crimeLaundering'],
    queryFn: () => api.get<LaunderingJob[]>('/crime/laundering'),
    refetchInterval: 10000,
  });

  const { data: businesses } = useQuery<Business[]>({
    queryKey: ['businesses'],
    queryFn: () => api.get<Business[]>('/businesses'),
    refetchInterval: 30000,
  });

  const {
    data: rivalPlayers,
    isLoading: rivalsLoading,
    refetch: refetchRivals,
  } = useQuery<RivalPlayer[]>({
    queryKey: ['rivalPlayers'],
    queryFn: () => api.get<RivalPlayer[]>('/intel/players'),
    enabled: activeTab === 'sabotage',
    staleTime: 30000,
  });

  const isRefetching = statusRefetching || opsRefetching || launderingRefetching;

  const refetchAll = () => {
    refetchStatus();
    refetchOps();
    refetchLaundering();
  };

  // ─── Derived data ────────────────────────────────

  const activeOperations = useMemo(
    () => (activeOps ?? []).filter((op) => op.status === 'active'),
    [activeOps],
  );

  const completedOps = useMemo(
    () => (activeOps ?? []).filter((op) => op.status !== 'active'),
    [activeOps],
  );

  const activeLaunderingJobs = useMemo(
    () => (launderingJobs ?? []).filter((j) => j.status === 'active'),
    [launderingJobs],
  );

  const completedLaunderingJobs = useMemo(
    () => (launderingJobs ?? []).filter((j) => j.status !== 'active'),
    [launderingJobs],
  );

  const hasResolveableOps = useMemo(
    () => activeOperations.some((op) => new Date(op.resolves_at).getTime() <= Date.now()),
    [activeOperations],
  );

  const hasResolveableLaundering = useMemo(
    () => activeLaunderingJobs.some((j) => new Date(j.resolves_at).getTime() <= Date.now()),
    [activeLaunderingJobs],
  );

  const activeBusinesses = useMemo(
    () => (businesses ?? []).filter((b) => b.status === 'active' || b.status === 'ACTIVE'),
    [businesses],
  );

  // Launder modal computed
  const selectedBiz = activeBusinesses.find((b) => b.id === launderBizId);
  const launderAmountNum = Number(launderAmount) || 0;
  const dirtyMoneyAvailable = Number(status?.dirty_money ?? 0);
  const estimatedEfficiency =
    selectedBiz?.type === 'SHOP' ? 0.85 : selectedBiz?.type === 'FACTORY' ? 0.75 : 0.65;
  const heatPenalty = Number(status?.heat_police ?? 0) / 200;
  const adjustedEfficiency = Math.max(0.5, estimatedEfficiency - heatPenalty);
  const estimatedClean = Math.round(launderAmountNum * adjustedEfficiency * 100) / 100;
  const estimatedRisk = Math.min(
    80,
    20 + Math.floor(launderAmountNum / 5000) + Math.floor(Number(status?.heat_police ?? 0) / 2),
  );

  // ─── Mutations ───────────────────────────────────

  const startCrimeMutation = useMutation({
    mutationFn: (type: string) => api.post<StartOpResult>('/crime/start', { type }),
    onSuccess: (data) => {
      show(`${data.name} started! Risk: ${data.risk_level}%`, 'success');
      queryClient.invalidateQueries({ queryKey: ['crimeActive'] });
      queryClient.invalidateQueries({ queryKey: ['crimeStatus'] });
      setConfirmCrime(null);
    },
    onError: (err: Error) => {
      show(err.message, 'error');
      setConfirmCrime(null);
    },
  });

  const resolveOpsMutation = useMutation({
    mutationFn: () => api.post<ResolveResult>('/crime/resolve'),
    onSuccess: (data) => {
      if (data.resolved === 0) {
        show('No operations ready to resolve yet', 'info');
      } else {
        for (const r of data.results) {
          show(r.message, r.success ? 'success' : 'error');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['crimeActive'] });
      queryClient.invalidateQueries({ queryKey: ['crimeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const launderMutation = useMutation({
    mutationFn: (body: { business_id: string; amount: number }) =>
      api.post<LaunderResult>('/crime/launder', body),
    onSuccess: (data) => {
      show(
        `Laundering $${data.dirty_amount} through ${data.business}. Est. clean: $${data.estimated_clean}`,
        'success',
      );
      queryClient.invalidateQueries({ queryKey: ['crimeLaundering'] });
      queryClient.invalidateQueries({ queryKey: ['crimeStatus'] });
      setLaunderModalVisible(false);
      setLaunderBizId(null);
      setLaunderAmount('');
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const resolveLaunderingMutation = useMutation({
    mutationFn: () => api.post<ResolveResult>('/crime/laundering/resolve'),
    onSuccess: (data) => {
      if (data.resolved === 0) {
        show('No laundering jobs ready to resolve yet', 'info');
      } else {
        for (const r of data.results) {
          show(r.message, r.success ? 'success' : 'error');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['crimeLaundering'] });
      queryClient.invalidateQueries({ queryKey: ['crimeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const sabotageMutation = useMutation({
    mutationFn: (body: { target_player_id: string; type: string }) =>
      api.post<SabotageResult>('/crime/sabotage', body),
    onSuccess: (data) => {
      show(data.message, data.success ? 'success' : 'error');
      queryClient.invalidateQueries({ queryKey: ['crimeStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSabotageConfirmVisible(false);
      setSelectedSabotageType(null);
      setSelectedTargetPlayer(null);
    },
    onError: (err: Error) => {
      show(err.message, 'error');
      setSabotageConfirmVisible(false);
    },
  });

  // ─── Loading ─────────────────────────────────────

  if (statusLoading || typesLoading || opsLoading || launderingLoading) {
    return <LoadingScreen message="Loading crime operations..." />;
  }

  // ─── Status Header ───────────────────────────────

  const renderStatusHeader = () => {
    if (!status) return null;
    const heat = Number(status.heat_police);
    return (
      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Dirty Money</Text>
            <CurrencyText
              amount={Number(status.dirty_money)}
              variant="dirty"
              size="lg"
            />
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Active Ops</Text>
            <Text style={styles.statusValue}>{status.active_ops}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Laundering</Text>
            <Text style={styles.statusValue}>{status.active_laundering}</Text>
          </View>
        </View>
        <View style={styles.heatSection}>
          <StatBar label="Police Heat" value={heat} color={heatColor(heat)} />
          {Number(status.heat_rival) > 0 && (
            <StatBar
              label="Rival Heat"
              value={Number(status.heat_rival)}
              color="#a855f7"
            />
          )}
          {Number(status.heat_fed) > 0 && (
            <StatBar
              label="Fed Heat"
              value={Number(status.heat_fed)}
              color="#ef4444"
            />
          )}
        </View>
      </Card>
    );
  };

  // ─── Tab: Operations ─────────────────────────────

  const renderOperations = () => (
    <View>
      {/* Available crime types */}
      <Text style={styles.sectionTitle}>Available Operations</Text>
      {(!crimeTypes || crimeTypes.length === 0) ? (
        <EmptyState
          icon="\u{1F512}"
          title="No operations available"
          subtitle="Unlock more by progressing through phases"
        />
      ) : (
        crimeTypes.map((crime) => (
          <Card key={crime.type} style={styles.crimeCard}>
            <View style={styles.crimeHeader}>
              <Text style={styles.crimeIcon}>{crime.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.crimeName}>{crime.name}</Text>
                <Text style={styles.crimeDesc}>{crime.description}</Text>
              </View>
            </View>
            <View style={styles.crimeStats}>
              <View style={styles.crimeStat}>
                <Text style={styles.crimeStatLabel}>Risk</Text>
                <Text style={[styles.crimeStatValue, { color: crime.risk >= 50 ? '#ef4444' : '#f59e0b' }]}>
                  {crime.risk}%
                </Text>
              </View>
              <View style={styles.crimeStat}>
                <Text style={styles.crimeStatLabel}>Reward</Text>
                <Text style={[styles.crimeStatValue, { color: '#22c55e' }]}>
                  {formatCurrency(crime.reward_range[0])} - {formatCurrency(crime.reward_range[1])}
                </Text>
              </View>
              <View style={styles.crimeStat}>
                <Text style={styles.crimeStatLabel}>Duration</Text>
                <Text style={styles.crimeStatValue}>{crime.duration_minutes}m</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.startBtn, startCrimeMutation.isPending && { opacity: 0.5 }]}
              onPress={() => setConfirmCrime(crime)}
              disabled={startCrimeMutation.isPending}
            >
              <Text style={styles.startBtnText}>Start Operation</Text>
            </TouchableOpacity>
          </Card>
        ))
      )}

      {/* Active operations */}
      {activeOperations.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active Operations</Text>
          {activeOperations.map((op) => (
            <Card key={op.id} style={styles.activeOpCard}>
              <View style={styles.activeOpHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.activeOpType}>{op.target_desc}</Text>
                  <Text style={styles.activeOpMeta}>
                    Risk: {op.risk_level}% | Reward: {formatCurrency(Number(op.reward_min))} -{' '}
                    {formatCurrency(Number(op.reward_max))}
                  </Text>
                </View>
                <Badge label="ACTIVE" variant="yellow" />
              </View>
              <View style={styles.timerRow}>
                <CountdownTimer target={op.resolves_at} prefix="Resolves in: " />
              </View>
              <ProgressBar
                progress={computeProgress(op.started_at, op.resolves_at)}
                color="#f59e0b"
                height={3}
                style={{ marginTop: 8 }}
              />
            </Card>
          ))}
          <TouchableOpacity
            style={[
              styles.resolveBtn,
              (!hasResolveableOps || resolveOpsMutation.isPending) && { opacity: 0.5 },
            ]}
            onPress={() => resolveOpsMutation.mutate()}
            disabled={!hasResolveableOps || resolveOpsMutation.isPending}
          >
            <Text style={styles.resolveBtnText}>
              {resolveOpsMutation.isPending ? 'Resolving...' : 'Check Results'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // ─── Tab: Laundering ─────────────────────────────

  const renderLaundering = () => (
    <View>
      {/* Start laundering button */}
      <TouchableOpacity
        style={[styles.launderBtn, dirtyMoneyAvailable <= 0 && { opacity: 0.5 }]}
        onPress={() => setLaunderModalVisible(true)}
        disabled={dirtyMoneyAvailable <= 0}
      >
        <Text style={styles.launderBtnText}>
          {dirtyMoneyAvailable > 0
            ? `Launder Money (${formatCurrency(dirtyMoneyAvailable)} dirty)`
            : 'No Dirty Money to Launder'}
        </Text>
      </TouchableOpacity>

      {/* Active laundering jobs */}
      {activeLaunderingJobs.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active Laundering</Text>
          {activeLaunderingJobs.map((job) => {
            const progress = computeProgress(job.started_at, job.resolves_at);
            return (
              <Card key={job.id} style={styles.launderCard}>
                <View style={styles.launderHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.launderBizName}>{job.business_name}</Text>
                    <Text style={styles.launderMeta}>
                      {job.business_type} | Efficiency: {Math.round(Number(job.efficiency) * 100)}% | Risk: {job.risk_level}%
                    </Text>
                  </View>
                  <Badge label="ACTIVE" variant="yellow" />
                </View>
                <View style={styles.launderAmountRow}>
                  <View>
                    <Text style={styles.launderAmountLabel}>Dirty</Text>
                    <CurrencyText amount={Number(job.dirty_amount)} variant="dirty" size="sm" />
                  </View>
                  <Text style={styles.launderArrow}>{'\u2192'}</Text>
                  <View>
                    <Text style={styles.launderAmountLabel}>Est. Clean</Text>
                    <CurrencyText
                      amount={Math.round(Number(job.dirty_amount) * Number(job.efficiency) * 100) / 100}
                      variant="clean"
                      size="sm"
                    />
                  </View>
                </View>
                <ProgressBar
                  progress={progress}
                  color="#22c55e"
                  height={3}
                  style={{ marginTop: 8 }}
                />
                <View style={styles.timerRow}>
                  <CountdownTimer target={job.resolves_at} prefix="Completes in: " />
                </View>
              </Card>
            );
          })}
          <TouchableOpacity
            style={[
              styles.resolveBtn,
              (!hasResolveableLaundering || resolveLaunderingMutation.isPending) && { opacity: 0.5 },
            ]}
            onPress={() => resolveLaunderingMutation.mutate()}
            disabled={!hasResolveableLaundering || resolveLaunderingMutation.isPending}
          >
            <Text style={styles.resolveBtnText}>
              {resolveLaunderingMutation.isPending ? 'Resolving...' : 'Check Results'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {/* Completed laundering jobs */}
      {completedLaunderingJobs.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Completed</Text>
          {completedLaunderingJobs.map((job) => (
            <Card key={job.id} style={styles.historyCard}>
              <View style={styles.historyHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyTitle}>{job.business_name}</Text>
                  <Text style={styles.historyMeta}>
                    Dirty: {formatCurrency(Number(job.dirty_amount))}
                    {job.clean_amount
                      ? ` \u2192 Clean: ${formatCurrency(Number(job.clean_amount))}`
                      : ' \u2192 Confiscated'}
                  </Text>
                </View>
                <Badge
                  label={job.status.toUpperCase()}
                  variant={getStatusBadgeVariant(job.status)}
                />
              </View>
            </Card>
          ))}
        </>
      )}

      {activeLaunderingJobs.length === 0 && completedLaunderingJobs.length === 0 && (
        <EmptyState
          icon="\u{1F9F9}"
          title="No laundering jobs"
          subtitle="Use the button above to start cleaning your dirty money through a business"
        />
      )}
    </View>
  );

  // ─── Tab: History ────────────────────────────────

  const renderHistory = () => {
    // Merge ops and laundering, sort by date
    const allItems: {
      id: string;
      kind: 'crime' | 'launder';
      title: string;
      detail: string;
      status: string;
      date: string;
      amount: string | null;
    }[] = [];

    for (const op of completedOps) {
      allItems.push({
        id: op.id,
        kind: 'crime',
        title: op.target_desc,
        detail: op.result_message ?? `Risk: ${op.risk_level}%`,
        status: op.status,
        date: op.resolved_at ?? op.started_at,
        amount: op.result_amount,
      });
    }

    for (const job of completedLaunderingJobs) {
      allItems.push({
        id: job.id,
        kind: 'launder',
        title: `Laundering via ${job.business_name}`,
        detail: job.clean_amount
          ? `${formatCurrency(Number(job.dirty_amount))} \u2192 ${formatCurrency(Number(job.clean_amount))}`
          : `${formatCurrency(Number(job.dirty_amount))} confiscated`,
        status: job.status,
        date: job.resolved_at ?? job.started_at,
        amount: job.clean_amount,
      });
    }

    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (allItems.length === 0) {
      return (
        <EmptyState
          icon="\u{1F4DC}"
          title="No history yet"
          subtitle="Complete some operations or laundering jobs to see results here"
        />
      );
    }

    return (
      <View>
        {allItems.map((item) => (
          <Card key={`${item.kind}-${item.id}`} style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.historyTitleRow}>
                  <Badge
                    label={item.kind === 'crime' ? 'OP' : 'LAUNDER'}
                    variant={item.kind === 'crime' ? 'purple' : 'blue'}
                    size="sm"
                  />
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.historyMeta}>{item.detail}</Text>
                {item.amount && Number(item.amount) !== 0 && (
                  <CurrencyText
                    amount={Number(item.amount)}
                    variant={Number(item.amount) > 0 ? 'clean' : 'dirty'}
                    size="sm"
                    style={{ marginTop: 4 }}
                  />
                )}
              </View>
              <Badge
                label={item.status.toUpperCase()}
                variant={getStatusBadgeVariant(item.status)}
              />
            </View>
          </Card>
        ))}
      </View>
    );
  };

  // ─── Tab: Sabotage ──────────────────────────────

  const renderSabotage = () => (
    <View>
      {/* Sabotage type cards */}
      <Text style={styles.sectionTitle}>Select Sabotage Type</Text>
      {SABOTAGE_TYPES.map((sab) => (
        <TouchableOpacity
          key={sab.type}
          onPress={() => setSelectedSabotageType(
            selectedSabotageType?.type === sab.type ? null : sab,
          )}
          activeOpacity={0.7}
        >
          <Card
            style={[
              styles.sabotageTypeCard,
              selectedSabotageType?.type === sab.type && styles.sabotageTypeCardSelected,
            ]}
          >
            <View style={styles.crimeHeader}>
              <Text style={styles.crimeIcon}>{sab.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.crimeName}>{sab.name}</Text>
                <Text style={styles.crimeDesc}>{sab.description}</Text>
              </View>
            </View>
            <View style={styles.sabotageTypeMeta}>
              <Text style={styles.sabotageCost}>
                Cost: {formatCurrency(sab.cost)}
              </Text>
              {selectedSabotageType?.type === sab.type && (
                <Badge label="SELECTED" variant="red" size="sm" />
              )}
            </View>
          </Card>
        </TouchableOpacity>
      ))}

      {/* Target player selection */}
      <Text style={styles.sectionTitle}>Select Target</Text>
      {rivalsLoading ? (
        <Text style={styles.sabotageHint}>Loading players...</Text>
      ) : !rivalPlayers || rivalPlayers.length === 0 ? (
        <EmptyState
          icon={"\uD83D\uDC64"}
          title="No rivals found"
          subtitle="No other players to target"
        />
      ) : (
        <>
          <Text style={styles.sabotageHint}>
            A random business owned by the target will be attacked
          </Text>
          {rivalPlayers.map((player) => (
            <TouchableOpacity
              key={player.id}
              onPress={() =>
                setSelectedTargetPlayer(
                  selectedTargetPlayer?.id === player.id ? null : player,
                )
              }
              activeOpacity={0.7}
            >
              <Card
                style={[
                  styles.targetPlayerCard,
                  selectedTargetPlayer?.id === player.id && styles.targetPlayerCardSelected,
                ]}
              >
                <View style={styles.targetPlayerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.targetPlayerName}>
                      {player.username}
                    </Text>
                    <Text style={styles.targetPlayerMeta}>
                      Level {player.level} | {player.business_count} business{player.business_count !== 1 ? 'es' : ''}
                    </Text>
                  </View>
                  {selectedTargetPlayer?.id === player.id && (
                    <Badge label="TARGET" variant="red" size="sm" />
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Launch button */}
      <TouchableOpacity
        style={[
          styles.sabotageBtn,
          (!selectedSabotageType || !selectedTargetPlayer || sabotageMutation.isPending) && {
            opacity: 0.5,
          },
        ]}
        disabled={!selectedSabotageType || !selectedTargetPlayer || sabotageMutation.isPending}
        onPress={() => setSabotageConfirmVisible(true)}
      >
        <Text style={styles.sabotageBtnText}>
          {selectedSabotageType && selectedTargetPlayer
            ? `Launch ${selectedSabotageType.name} on ${selectedTargetPlayer.username} (${formatCurrency(selectedSabotageType.cost)})`
            : 'Select type and target above'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Tab content map ─────────────────────────────

  const tabContent: Record<TabKey, () => React.ReactNode> = {
    operations: renderOperations,
    laundering: renderLaundering,
    sabotage: renderSabotage,
    history: renderHistory,
  };

  // ─── Render ──────────────────────────────────────

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetchAll}
            tintColor="#ef4444"
            colors={['#ef4444']}
          />
        }
      >
        <Text style={styles.title}>Crime</Text>

        {/* Status header */}
        {renderStatusHeader()}

        {/* Tab bar */}
        <View style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Active tab content */}
        {tabContent[activeTab]()}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ─── Confirm Start Crime Modal ─────────────── */}
      <ConfirmModal
        visible={confirmCrime !== null}
        title={`Start ${confirmCrime?.name ?? ''}?`}
        message={
          confirmCrime
            ? `${confirmCrime.description}\n\nRisk: ${confirmCrime.risk}%\nReward: ${formatCurrency(confirmCrime.reward_range[0])} - ${formatCurrency(confirmCrime.reward_range[1])}\nDuration: ${confirmCrime.duration_minutes} minutes`
            : ''
        }
        confirmLabel="Start"
        confirmVariant="danger"
        onConfirm={() => {
          if (confirmCrime) {
            startCrimeMutation.mutate(confirmCrime.type);
          }
        }}
        onCancel={() => setConfirmCrime(null)}
        isLoading={startCrimeMutation.isPending}
      />

      {/* ─── Launder Money Modal ──────────────────── */}
      <Modal
        visible={launderModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLaunderModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Launder Money</Text>
            <Text style={styles.modalSub}>
              Available dirty money: {formatCurrency(dirtyMoneyAvailable)}
            </Text>

            <Text style={styles.inputLabel}>Select Business:</Text>
            {activeBusinesses.length > 0 ? (
              activeBusinesses.map((biz) => (
                <TouchableOpacity
                  key={biz.id}
                  style={[
                    styles.bizOption,
                    launderBizId === biz.id && styles.bizOptionSelected,
                  ]}
                  onPress={() => setLaunderBizId(biz.id)}
                >
                  <Text style={styles.bizOptionName}>{biz.name}</Text>
                  <Text style={styles.bizOptionMeta}>
                    {biz.type} T{biz.tier}
                    {biz.type === 'SHOP'
                      ? ' (best efficiency)'
                      : biz.type === 'FACTORY'
                        ? ' (good efficiency)'
                        : ' (low efficiency)'}
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.modalSub}>
                No active businesses. Create one first to launder money.
              </Text>
            )}

            <Text style={styles.inputLabel}>Amount to Launder:</Text>
            <TextInput
              style={styles.input}
              value={launderAmount}
              onChangeText={setLaunderAmount}
              keyboardType="numeric"
              placeholder="0.00"
              placeholderTextColor="#4b5563"
            />
            {launderAmountNum > dirtyMoneyAvailable && (
              <Text style={styles.errorText}>Not enough dirty money</Text>
            )}

            {/* Estimate preview */}
            {launderBizId && launderAmountNum > 0 && launderAmountNum <= dirtyMoneyAvailable && (
              <View style={styles.estimateBox}>
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>Efficiency</Text>
                  <Text style={styles.estimateValue}>
                    {Math.round(adjustedEfficiency * 100)}%
                  </Text>
                </View>
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>Risk</Text>
                  <Text style={[styles.estimateValue, { color: estimatedRisk >= 50 ? '#ef4444' : '#f59e0b' }]}>
                    {estimatedRisk}%
                  </Text>
                </View>
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>Est. Clean Cash</Text>
                  <Text style={[styles.estimateValue, { color: '#22c55e' }]}>
                    {formatCurrency(estimatedClean)}
                  </Text>
                </View>
                <View style={styles.estimateRow}>
                  <Text style={styles.estimateLabel}>Lost to Fees</Text>
                  <Text style={[styles.estimateValue, { color: '#ef4444' }]}>
                    {formatCurrency(launderAmountNum - estimatedClean)}
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setLaunderModalVisible(false);
                  setLaunderBizId(null);
                  setLaunderAmount('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirm,
                  (!launderBizId ||
                    launderAmountNum <= 0 ||
                    launderAmountNum > dirtyMoneyAvailable ||
                    launderMutation.isPending) && { opacity: 0.5 },
                ]}
                disabled={
                  !launderBizId ||
                  launderAmountNum <= 0 ||
                  launderAmountNum > dirtyMoneyAvailable ||
                  launderMutation.isPending
                }
                onPress={() => {
                  if (launderBizId && launderAmountNum > 0) {
                    launderMutation.mutate({
                      business_id: launderBizId,
                      amount: launderAmountNum,
                    });
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {launderMutation.isPending ? 'Starting...' : 'Start Laundering'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Sabotage Confirm Modal ────────────────── */}
      <ConfirmModal
        visible={sabotageConfirmVisible}
        title={`Launch ${selectedSabotageType?.name ?? ''}?`}
        message={
          selectedSabotageType && selectedTargetPlayer
            ? `${selectedSabotageType.description}\n\nTarget: ${selectedTargetPlayer.username}\nCost: ${formatCurrency(selectedSabotageType.cost)}\n\nA random active business will be targeted.`
            : ''
        }
        confirmLabel="Launch"
        confirmVariant="danger"
        onConfirm={() => {
          if (selectedSabotageType && selectedTargetPlayer) {
            sabotageMutation.mutate({
              target_player_id: selectedTargetPlayer.id,
              type: selectedSabotageType.type,
            });
          }
        }}
        onCancel={() => setSabotageConfirmVisible(false)}
        isLoading={sabotageMutation.isPending}
      />
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 52 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb', marginBottom: 16 },

  // Status card
  statusCard: { marginBottom: 16 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusItem: { alignItems: 'center', flex: 1 },
  statusLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusValue: { fontSize: 18, fontWeight: '800', color: '#f9fafb' },
  heatSection: { marginTop: 4 },

  // Tabs
  tabBar: { flexDirection: 'row', marginBottom: 16, gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#ef4444' },
  tabText: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#ffffff' },

  // Section titles
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
    marginTop: 12,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },

  // Crime type cards
  crimeCard: { marginBottom: 10 },
  crimeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  crimeIcon: { fontSize: 28 },
  crimeName: { fontSize: 15, fontWeight: '700', color: '#f9fafb' },
  crimeDesc: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  crimeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  crimeStat: { alignItems: 'center' },
  crimeStatLabel: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  crimeStatValue: { fontSize: 13, fontWeight: '700', color: '#f9fafb', marginTop: 2 },
  startBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  startBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },

  // Active operation cards
  activeOpCard: { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  activeOpHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  activeOpType: { fontSize: 13, fontWeight: '700', color: '#f9fafb' },
  activeOpMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  timerRow: { marginTop: 8 },

  // Resolve button
  resolveBtn: {
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  resolveBtnText: { color: '#60a5fa', fontSize: 14, fontWeight: '700' },

  // Launder button
  launderBtn: {
    backgroundColor: '#052e16',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22c55e',
    marginBottom: 12,
  },
  launderBtnText: { color: '#22c55e', fontSize: 14, fontWeight: '700' },

  // Laundering cards
  launderCard: { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#22c55e' },
  launderHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  launderBizName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  launderMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  launderAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  launderAmountLabel: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  launderArrow: { fontSize: 16, color: '#6b7280' },

  // Sabotage tab
  sabotageTypeCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  sabotageTypeCardSelected: {
    borderColor: '#ef4444',
    backgroundColor: '#1a0a0a',
  },
  sabotageTypeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  sabotageCost: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
  },
  sabotageHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  targetPlayerCard: {
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  targetPlayerCardSelected: {
    borderColor: '#ef4444',
    backgroundColor: '#1a0a0a',
  },
  targetPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  targetPlayerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },
  targetPlayerMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  sabotageBtn: {
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  sabotageBtnText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  // History cards
  historyCard: { marginBottom: 6 },
  historyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  historyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyTitle: { fontSize: 13, fontWeight: '700', color: '#f9fafb', flex: 1 },
  historyMeta: { fontSize: 12, color: '#6b7280', marginTop: 4 },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#1f2937',
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#9ca3af', marginBottom: 4 },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 8,
  },
  errorText: { color: '#ef4444', fontSize: 11, fontWeight: '600', marginBottom: 4 },

  // Business option in modal
  bizOption: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  bizOptionSelected: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  bizOptionName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  bizOptionMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },

  // Estimate box
  estimateBox: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  estimateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  estimateLabel: { fontSize: 12, color: '#9ca3af' },
  estimateValue: { fontSize: 12, fontWeight: '700', color: '#f9fafb' },

  // Modal buttons
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  modalCancelText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  modalConfirmText: { color: '#030712', fontSize: 14, fontWeight: '700' },
});
