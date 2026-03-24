import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { HeatBadge } from '../../components/ui/Badge';
import { CountdownTimer } from '../../components/ui/CountdownTimer';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { formatTimestamp } from '../../lib/format';
import type {
  HeatScore,
  DirtyMoneyBalance,
  CriminalOperation,
  LaunderingProcess,
  HeatLevel,
} from '@economy-game/shared';

export type CrimeStackParamList = {
  CrimeHub: undefined;
  CrimeOperations: undefined;
  LaunderingScreen: undefined;
  HeatManagement: undefined;
};

type NavProp = StackNavigationProp<CrimeStackParamList, 'CrimeHub'>;

const HEAT_COLORS: Record<HeatLevel, string> = {
  COLD: '#6b7280',
  WARM: '#eab308',
  HOT: '#f97316',
  BURNING: '#ef4444',
  FUGITIVE: '#a855f7',
};

const HEAT_LABELS: Record<HeatLevel, string> = {
  COLD: 'Cold',
  WARM: 'Warming Up',
  HOT: 'Hot',
  BURNING: 'Burning',
  FUGITIVE: 'Fugitive',
};

interface CrimeDashboard {
  heat: HeatScore;
  dirty_money: DirtyMoneyBalance;
  active_ops: CriminalOperation[];
  active_laundering: LaunderingProcess[];
  lay_low_active: boolean;
}

function HeatGauge({ heat }: { heat: HeatScore }) {
  const color = HEAT_COLORS[heat.level];
  const percent = heat.score / 1000;

  return (
    <Card style={styles.heatCard}>
      <View style={styles.heatHeader}>
        <Text style={styles.heatTitle}>Heat Score</Text>
        <HeatBadge level={heat.level} />
      </View>

      <View style={styles.heatMeter}>
        <Text style={[styles.heatScore, { color }]}>{heat.score}</Text>
        <Text style={styles.heatMax}>/1000</Text>
      </View>

      {/* Gauge bar */}
      <View style={styles.gaugeTrack}>
        <View
          style={[
            styles.gaugeFill,
            {
              width: `${Math.min(100, percent * 100)}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      <Text style={[styles.heatLevelLabel, { color }]}>
        {HEAT_LABELS[heat.level]}
      </Text>

      {heat.under_investigation && (
        <View style={styles.investigationBanner}>
          <Text style={styles.investigationText}>
            🔍 Under Investigation
            {heat.investigation_ends
              ? ` — ends ${formatTimestamp(heat.investigation_ends)}`
              : ''}
          </Text>
        </View>
      )}
    </Card>
  );
}

function DirtyMoneyCard({
  dirty,
  onLaunder,
}: {
  dirty: DirtyMoneyBalance;
  onLaunder: () => void;
}) {
  // Liability fee ticks up 0.1% per hour
  const liabilityFee = dirty.total_dirty * 0.001;

  return (
    <Card style={styles.dirtyCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Dirty Money</Text>
        {dirty.flagged && <Text style={styles.flaggedBadge}>🚩 FLAGGED</Text>}
      </View>

      <Text style={styles.dirtyAmount}>{formatCurrency(dirty.total_dirty)}</Text>
      <Text style={styles.liabilityText}>
        Liability fee: ~{formatCurrency(liabilityFee)}/hr
      </Text>

      <View style={styles.dirtyStats}>
        <View style={styles.dirtyStat}>
          <Text style={styles.dirtyStatLabel}>Total Earned</Text>
          <Text style={styles.dirtyStatValue}>{formatCurrency(dirty.total_earned)}</Text>
        </View>
        <View style={styles.dirtyStat}>
          <Text style={styles.dirtyStatLabel}>Laundered</Text>
          <Text style={[styles.dirtyStatValue, { color: '#22c55e' }]}>
            {formatCurrency(dirty.total_laundered)}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.launderBtn} onPress={onLaunder}>
        <Text style={styles.launderBtnText}>💸 Launder Money</Text>
      </TouchableOpacity>
    </Card>
  );
}

// ─── Gate screen for players who haven't gone criminal ────────

function CriminalGateScreen({ onEnter }: { onEnter: () => void }) {
  const [confirmVisible, setConfirmVisible] = useState(false);

  return (
    <View style={styles.gateScreen}>
      <Text style={styles.gateIcon}>🔥</Text>
      <Text style={styles.gateTitle}>The Criminal Path</Text>
      <Text style={styles.gateDescription}>
        Entering the criminal underworld offers high rewards but carries serious risks.
        Your Heat Score can lead to raids, arrests, and asset seizures.{'\n\n'}
        Criminal activity permanently affects your alignment and is visible to other players.
      </Text>

      <View style={styles.gateWarnings}>
        <Text style={styles.gateWarning}>⚠️ Criminal alignment is tracked</Text>
        <Text style={styles.gateWarning}>⚠️ Heat leads to law enforcement attention</Text>
        <Text style={styles.gateWarning}>⚠️ Assets can be seized if caught</Text>
        <Text style={styles.gateWarning}>⚠️ Other players can report you</Text>
      </View>

      <TouchableOpacity
        style={styles.gateButton}
        onPress={() => setConfirmVisible(true)}
      >
        <Text style={styles.gateButtonText}>Enter the Underworld</Text>
      </TouchableOpacity>

      <ConfirmModal
        visible={confirmVisible}
        title="Enter Criminal Path?"
        message="This will shift your alignment toward CRIMINAL. You cannot undo this decision within a season. Are you sure?"
        confirmLabel="I Understand — Proceed"
        confirmVariant="danger"
        onConfirm={onEnter}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}

export function CrimeHubScreen() {
  const navigation = useNavigation<NavProp>();
  const player = useAuthStore((s) => s.player);
  const queryClient = useQueryClient();

  const hasCriminalActivity =
    player?.alignment === 'CRIMINAL' || player?.alignment === 'MIXED';

  const { data, isLoading, refetch, isRefetching } = useQuery<CrimeDashboard>({
    queryKey: ['crime', 'dashboard'],
    queryFn: () => api.get<CrimeDashboard>('/crime/dashboard'),
    enabled: hasCriminalActivity,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const enterCrimeMutation = useMutation({
    mutationFn: () => api.post('/crime/initiate'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['crime', 'dashboard'] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
  });

  if (!hasCriminalActivity) {
    return <CriminalGateScreen onEnter={() => enterCrimeMutation.mutate()} />;
  }

  if (isLoading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <LoadingSkeleton rows={5} />
      </ScrollView>
    );
  }

  if (!data) {
    return (
      <View style={styles.screen}>
        <Text style={styles.errorText}>Failed to load crime dashboard</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#ef4444" />
      }
    >
      <HeatGauge heat={data.heat} />

      <DirtyMoneyCard
        dirty={data.dirty_money}
        onLaunder={() => navigation.navigate('LaunderingScreen')}
      />

      {/* Lay Low status */}
      <Card style={styles.card}>
        <View style={styles.layLowRow}>
          <View>
            <Text style={styles.cardTitle}>
              {data.lay_low_active ? '🤫 Laying Low' : 'Activity Status'}
            </Text>
            <Text style={styles.layLowDesc}>
              {data.lay_low_active
                ? 'Heat decay x2, operations paused'
                : 'Normal operations active'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.heatMgmtBtn}
            onPress={() => navigation.navigate('HeatManagement')}
          >
            <Text style={styles.heatMgmtBtnText}>Manage Heat →</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Active Operations */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Active Operations</Text>
          <TouchableOpacity onPress={() => navigation.navigate('CrimeOperations')}>
            <Text style={styles.seeAllText}>+ New Op</Text>
          </TouchableOpacity>
        </View>
        {data.active_ops.length === 0 ? (
          <Text style={styles.emptyCardText}>No active operations</Text>
        ) : (
          data.active_ops.map((op) => {
            const riskColor =
              op.risk_level >= 7 ? '#ef4444' : op.risk_level >= 4 ? '#f97316' : '#22c55e';
            return (
              <View key={op.id} style={styles.opRow}>
                <View style={styles.opInfo}>
                  <Text style={styles.opName}>{op.op_type.replace(/_/g, ' ')}</Text>
                  <View style={styles.riskIndicator}>
                    {Array.from({ length: Math.min(10, Math.ceil(op.risk_level)) }).map((_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.riskDot,
                          {
                            backgroundColor:
                              i < op.risk_level ? riskColor : '#1f2937',
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
                <CountdownTimer target={op.completes_at} style={styles.opTimer} />
              </View>
            );
          })
        )}
      </Card>

      {/* Active Laundering */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Laundering Queue</Text>
          <TouchableOpacity onPress={() => navigation.navigate('LaunderingScreen')}>
            <Text style={styles.seeAllText}>+ New</Text>
          </TouchableOpacity>
        </View>
        {data.active_laundering.length === 0 ? (
          <Text style={styles.emptyCardText}>No laundering in progress</Text>
        ) : (
          data.active_laundering.map((p) => {
            const now = Date.now();
            const total =
              new Date(p.completes_at).getTime() - new Date(p.started_at).getTime();
            const elapsed = now - new Date(p.started_at).getTime();
            const progress = Math.min(1, Math.max(0, elapsed / total));

            return (
              <View key={p.id} style={styles.launderRow}>
                <View style={styles.launderHeader}>
                  <Text style={styles.opName}>{p.method.replace(/_/g, ' ')}</Text>
                  <Text style={styles.launderAmount}>
                    {formatCurrency(p.dirty_amount)} → {formatCurrency(p.clean_amount)}
                  </Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
                <View style={styles.launderFooter}>
                  <Text style={styles.progressLabel}>{Math.round(progress * 100)}%</Text>
                  <CountdownTimer target={p.completes_at} prefix="Done in: " />
                </View>
              </View>
            );
          })
        )}
      </Card>

      {/* Criminal Network placeholder */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Criminal Network</Text>
        <Text style={styles.networkPlaceholder}>
          🕸️ Network features unlocked at WARM heat level
        </Text>
      </Card>

      {/* Action buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.primaryActionBtn}
          onPress={() => navigation.navigate('CrimeOperations')}
        >
          <Text style={styles.primaryActionText}>⚡ Run Operation</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryActionBtn}
          onPress={() => navigation.navigate('LaunderingScreen')}
        >
          <Text style={styles.secondaryActionText}>💸 Launder Money</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  card: { marginBottom: 0 },
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
  seeAllText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    padding: 32,
    fontSize: 14,
  },
  emptyCardText: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  // Heat gauge
  heatCard: {},
  heatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  heatTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
  },
  heatMeter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  heatScore: {
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 56,
  },
  heatMax: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 4,
  },
  gaugeTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
    marginBottom: 6,
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 4,
  },
  heatLevelLabel: {
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  investigationBanner: {
    marginTop: 10,
    backgroundColor: '#2e1065',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#581c87',
  },
  investigationText: {
    color: '#a855f7',
    fontSize: 13,
    fontWeight: '600',
  },
  // Dirty money
  dirtyCard: {},
  dirtyAmount: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ef4444',
    marginBottom: 4,
  },
  liabilityText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  dirtyStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  dirtyStat: {
    flex: 1,
  },
  dirtyStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dirtyStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
  },
  flaggedBadge: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '700',
  },
  launderBtn: {
    backgroundColor: '#1a0505',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  launderBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '700',
  },
  // Lay low
  layLowRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  layLowDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  heatMgmtBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heatMgmtBtnText: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
  },
  // Op rows
  opRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  opInfo: {
    gap: 4,
  },
  opName: {
    fontSize: 13,
    color: '#d1d5db',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  riskIndicator: {
    flexDirection: 'row',
    gap: 2,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  opTimer: {
    fontSize: 13,
  },
  // Laundering rows
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
    fontSize: 12,
    color: '#9ca3af',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#1f2937',
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#22c55e',
  },
  launderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  // Network placeholder
  networkPlaceholder: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 12,
  },
  // Action buttons
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryActionBtn: {
    flex: 1,
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#9ca3af',
    fontSize: 15,
    fontWeight: '700',
  },
  // Gate screen
  gateScreen: {
    flex: 1,
    backgroundColor: '#030712',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  gateTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  gateDescription: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  gateWarnings: {
    backgroundColor: '#1a0505',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    width: '100%',
    marginBottom: 24,
    gap: 8,
  },
  gateWarning: {
    color: '#fca5a5',
    fontSize: 13,
    fontWeight: '500',
  },
  gateButton: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  gateButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '800',
  },
});
