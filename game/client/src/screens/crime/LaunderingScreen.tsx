import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CountdownTimer } from '../../components/ui/CountdownTimer';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { CurrencyText } from '../../components/ui/CurrencyText';
import { formatCurrency } from '../../lib/format';
import type { LaunderingProcess, LaunderingMethod, DirtyMoneyBalance } from '@economy-game/shared';
import { LAUNDERING_METHODS } from '@economy-game/shared';

interface LaunderingMethodConfig {
  key: LaunderingMethod;
  label: string;
  description: string;
  feePercent: number;
  speed: string;
  risk: 'low' | 'medium' | 'high' | 'very-high';
  riskLabel: string;
  maxPerDay: number;
  hoursPerUnit: number;
  locked?: boolean;
  lockReason?: string;
}

const METHOD_CONFIGS: LaunderingMethodConfig[] = [
  {
    key: 'BUSINESS_REVENUE',
    label: 'Business Revenue',
    description: 'Filter dirty money through legitimate business cashflow.',
    feePercent: 15,
    speed: 'Slow (48h / $10K)',
    risk: 'low',
    riskLabel: 'Low',
    maxPerDay: 50000,
    hoursPerUnit: 4.8,
  },
  {
    key: 'SHELL_COMPANY',
    label: 'Shell Company',
    description: 'Funnel funds through a network of shell entities.',
    feePercent: 30,
    speed: 'Fast (~10h / $10K)',
    risk: 'medium',
    riskLabel: 'Medium',
    maxPerDay: 50000,
    hoursPerUnit: 0.96,
  },
  {
    key: 'CRYPTO_ANALOG',
    label: 'Crypto Analog',
    description: 'Obfuscate funds through decentralized ledger mixing.',
    feePercent: 10,
    speed: 'Medium (12h / $10K)',
    risk: 'high',
    riskLabel: 'High',
    maxPerDay: 20000,
    hoursPerUnit: 1.2,
  },
  {
    key: 'REAL_ESTATE',
    label: 'Real Estate',
    description: 'Park money in property deals. Very discreet.',
    feePercent: 25,
    speed: 'Very Slow (34h / $10K)',
    risk: 'low',
    riskLabel: 'Very Low',
    maxPerDay: 100000,
    hoursPerUnit: 3.36,
    locked: true,
    lockReason: 'Unlocks at $500,000 net worth',
  },
];

const RISK_COLORS: Record<string, string> = {
  low: '#22c55e',
  'very-low': '#22c55e',
  medium: '#eab308',
  high: '#f97316',
  'very-high': '#ef4444',
};

function MethodCard({
  config,
  selected,
  onSelect,
}: {
  config: LaunderingMethodConfig;
  selected: boolean;
  onSelect: () => void;
}) {
  const riskColor = RISK_COLORS[config.risk] ?? '#6b7280';

  return (
    <TouchableOpacity
      style={[
        styles.methodCard,
        selected && styles.methodCardSelected,
        config.locked && styles.methodCardLocked,
      ]}
      onPress={onSelect}
      disabled={config.locked}
      activeOpacity={0.8}
    >
      <View style={styles.methodHeader}>
        <Text style={[styles.methodLabel, config.locked && styles.textMuted]}>
          {config.label}
        </Text>
        <View style={styles.methodBadges}>
          <Badge
            label={`${config.feePercent}% fee`}
            variant={config.locked ? 'gray' : 'orange'}
            size="sm"
          />
          {config.locked && (
            <Badge label="LOCKED" variant="gray" size="sm" />
          )}
        </View>
      </View>

      <Text style={[styles.methodDescription, config.locked && styles.textMuted]}>
        {config.locked ? config.lockReason : config.description}
      </Text>

      {!config.locked && (
        <View style={styles.methodStats}>
          <View style={styles.methodStat}>
            <Text style={styles.methodStatLabel}>Speed</Text>
            <Text style={styles.methodStatValue}>{config.speed}</Text>
          </View>
          <View style={styles.methodStat}>
            <Text style={styles.methodStatLabel}>Risk</Text>
            <Text style={[styles.methodStatValue, { color: riskColor }]}>
              {config.riskLabel}
            </Text>
          </View>
          <View style={styles.methodStat}>
            <Text style={styles.methodStatLabel}>Max / Day</Text>
            <Text style={styles.methodStatValue}>
              {formatCurrency(config.maxPerDay)}
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function LaunderingProgressRow({ process }: { process: LaunderingProcess }) {
  const now = Date.now();
  const total =
    new Date(process.completes_at).getTime() -
    new Date(process.started_at).getTime();
  const elapsed = now - new Date(process.started_at).getTime();
  const progress = Math.min(1, Math.max(0, elapsed / total));

  return (
    <View style={styles.progressRow}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressMethod}>
          {process.method.replace(/_/g, ' ')}
        </Text>
        <CountdownTimer target={process.completes_at} />
      </View>
      <View style={styles.progressAmounts}>
        <CurrencyText amount={process.dirty_amount} variant="dirty" size="sm" />
        <Text style={styles.progressArrow}>→</Text>
        <CurrencyText amount={process.clean_amount} variant="clean" size="sm" />
      </View>
      <ProgressBar progress={progress} color="#22c55e" height={4} />
      <Text style={styles.progressPct}>{Math.round(progress * 100)}% complete</Text>
    </View>
  );
}

interface LaunderingHubData {
  dirty_balance: DirtyMoneyBalance;
  active_laundering: LaunderingProcess[];
}

export function LaunderingScreen() {
  const queryClient = useQueryClient();
  const [selectedMethod, setSelectedMethod] = useState<LaunderingMethod>('BUSINESS_REVENUE');
  const [amount, setAmount] = useState('');

  const { data, isLoading } = useQuery<LaunderingHubData>({
    queryKey: ['laundering-hub'],
    queryFn: () => api.get<LaunderingHubData>('/crime/laundering'),
    staleTime: 15_000,
  });

  const launderMutation = useMutation({
    mutationFn: (payload: { method: LaunderingMethod; amount: number }) =>
      api.post<LaunderingProcess>('/crime/laundering', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['laundering-hub'] });
      queryClient.invalidateQueries({ queryKey: ['crime-hub'] });
      setAmount('');
      Alert.alert('Laundering Started', 'Your funds are being processed.');
    },
    onError: (err) => {
      Alert.alert('Failed', err instanceof Error ? err.message : 'Laundering failed');
    },
  });

  const methodConfig = METHOD_CONFIGS.find((m) => m.key === selectedMethod)!;
  const amountNum = parseFloat(amount.replace(/,/g, '')) || 0;
  const fee = amountNum * (methodConfig.feePercent / 100);
  const youReceive = amountNum - fee;
  const hoursToComplete =
    amountNum > 0 ? (amountNum / 10000) * methodConfig.hoursPerUnit * 10 : 0;
  const dirtyBalance = data?.dirty_balance?.total_dirty ?? 0;

  const canLaunder =
    amountNum > 0 &&
    amountNum <= dirtyBalance &&
    amountNum <= methodConfig.maxPerDay &&
    !launderMutation.isPending;

  if (isLoading) return <LoadingScreen message="Loading laundering data..." />;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Dirty Balance */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Available to Launder</Text>
        <CurrencyText
          amount={data?.dirty_balance?.total_dirty ?? 0}
          variant="dirty"
          size="xl"
        />
        <Text style={styles.launderedTotal}>
          Total laundered: {formatCurrency(data?.dirty_balance?.total_laundered ?? 0)}
        </Text>
      </Card>

      {/* Method Selection */}
      <Text style={styles.header}>Select Method</Text>
      <View style={styles.methodGrid}>
        {METHOD_CONFIGS.map((config) => (
          <MethodCard
            key={config.key}
            config={config}
            selected={selectedMethod === config.key}
            onSelect={() => !config.locked && setSelectedMethod(config.key)}
          />
        ))}
      </View>

      {/* Amount Input */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Amount to Launder</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#4b5563"
        />
        <View style={styles.amountHints}>
          <TouchableOpacity onPress={() => setAmount(String(Math.min(dirtyBalance, methodConfig.maxPerDay)))}>
            <Text style={styles.maxHint}>
              Max: {formatCurrency(Math.min(dirtyBalance, methodConfig.maxPerDay))}
            </Text>
          </TouchableOpacity>
        </View>

        {amountNum > 0 && (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount</Text>
              <CurrencyText amount={amountNum} variant="dirty" size="sm" />
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                Fee ({methodConfig.feePercent}%)
              </Text>
              <Text style={styles.feeText}>-{formatCurrency(fee)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text style={styles.summaryTotalLabel}>You Receive</Text>
              <CurrencyText amount={youReceive} variant="clean" size="sm" />
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Completes In</Text>
              <Text style={styles.timeText}>~{hoursToComplete.toFixed(1)}h</Text>
            </View>
          </View>
        )}
      </Card>

      <TouchableOpacity
        style={[styles.launderButton, !canLaunder && styles.launderButtonDisabled]}
        onPress={() => launderMutation.mutate({ method: selectedMethod, amount: amountNum })}
        disabled={!canLaunder}
      >
        <Text style={styles.launderButtonText}>
          {launderMutation.isPending ? 'Starting...' : '💸 Start Laundering'}
        </Text>
      </TouchableOpacity>

      {/* Active Laundering */}
      {(data?.active_laundering ?? []).length > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Active Laundering</Text>
          {(data?.active_laundering ?? []).map((p) => (
            <LaunderingProgressRow key={p.id} process={p} />
          ))}
        </Card>
      )}

      {(data?.active_laundering ?? []).length === 0 && amountNum === 0 && (
        <EmptyState
          icon="💸"
          title="No active laundering"
          subtitle="Select a method and enter an amount to start."
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  section: { marginBottom: 0 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  header: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
    marginTop: 4,
  },
  launderedTotal: { fontSize: 12, color: '#6b7280', marginTop: 4 },

  methodGrid: { gap: 10 },
  methodCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  methodCardSelected: { borderColor: '#22c55e', backgroundColor: '#0d1f14' },
  methodCardLocked: { opacity: 0.5 },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  methodLabel: { fontSize: 15, fontWeight: '700', color: '#f9fafb', flex: 1, marginRight: 8 },
  textMuted: { color: '#6b7280' },
  methodBadges: { flexDirection: 'row', gap: 4 },
  methodDescription: { fontSize: 12, color: '#6b7280', marginBottom: 10, lineHeight: 17 },
  methodStats: { flexDirection: 'row', gap: 8 },
  methodStat: { flex: 1, backgroundColor: '#030712', borderRadius: 6, padding: 8 },
  methodStatLabel: { fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  methodStatValue: { fontSize: 11, fontWeight: '700', color: '#d1d5db' },

  input: {
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    color: '#f9fafb',
    fontWeight: '700',
  },
  amountHints: { alignItems: 'flex-end', marginTop: 4 },
  maxHint: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },

  summary: { marginTop: 12, gap: 6 },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: { fontSize: 13, color: '#9ca3af' },
  feeText: { fontSize: 13, fontWeight: '600', color: '#ef4444' },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 8,
    marginTop: 2,
  },
  summaryTotalLabel: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  timeText: { fontSize: 13, fontWeight: '600', color: '#f97316' },

  launderButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  launderButtonDisabled: { opacity: 0.4 },
  launderButtonText: { color: '#030712', fontSize: 16, fontWeight: '800' },

  progressRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  progressMethod: { fontSize: 13, fontWeight: '600', color: '#d1d5db', textTransform: 'capitalize' },
  progressAmounts: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  progressArrow: { color: '#6b7280', fontSize: 14 },
  progressPct: { fontSize: 11, color: '#6b7280', marginTop: 4 },
});
