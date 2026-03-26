import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { HeatBadge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { CountdownTimer } from '../../components/ui/CountdownTimer';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { CurrencyText } from '../../components/ui/CurrencyText';
import { formatCurrency } from '../../lib/format';
import type { HeatScore, HeatLevel } from '@economy-game/shared';
import { HEAT_THRESHOLDS } from '@economy-game/shared';

const HEAT_LEVEL_COLORS: Record<HeatLevel, string> = {
  COLD: '#6b7280',
  WARM: '#eab308',
  HOT: '#f97316',
  BURNING: '#ef4444',
  FUGITIVE: '#a855f7',
};

const BRIBE_COSTS: Record<HeatLevel, number> = {
  COLD: 5000,
  WARM: 15000,
  HOT: 40000,
  BURNING: 100000,
  FUGITIVE: 300000,
};

const BRIBE_HEAT_REDUCTION: Record<HeatLevel, number> = {
  COLD: 50,
  WARM: 100,
  HOT: 200,
  BURNING: 300,
  FUGITIVE: 400,
};

function nextLevelDown(current: HeatLevel): HeatLevel | null {
  const order: HeatLevel[] = ['FUGITIVE', 'BURNING', 'HOT', 'WARM', 'COLD'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

interface HeatManagementData {
  heat: HeatScore;
  lay_low_active: boolean;
}

export function HeatManagementScreen() {
  const queryClient = useQueryClient();
  const [layLowActive, setLayLowActive] = useState(false);

  const { data, isLoading } = useQuery<HeatManagementData>({
    queryKey: ['heat-management'],
    queryFn: async () => {
      const heat = await api.get<HeatScore & { lay_low?: boolean }>('/crime/heat');
      return {
        heat,
        lay_low_active: heat?.lay_low ?? false,
      };
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (data) {
      setLayLowActive(data.lay_low_active);
    }
  }, [data]);

  const bribeMutation = useMutation({
    mutationFn: () => api.post('/crime/heat/bribe'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['heat-management'] });
      queryClient.invalidateQueries({ queryKey: ['crime-hub'] });
      Alert.alert('Officials Bribed', 'Heat has been reduced.');
    },
    onError: (err) => {
      Alert.alert('Bribe Failed', err instanceof Error ? err.message : 'Could not bribe officials');
    },
  });

  const layLowMutation = useMutation({
    mutationFn: (active: boolean) => api.put('/crime/heat/lay-low', { active }),
    onSuccess: (_, active) => {
      setLayLowActive(active);
      queryClient.invalidateQueries({ queryKey: ['heat-management'] });
      queryClient.invalidateQueries({ queryKey: ['crime-hub'] });
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update lay low status');
    },
  });

  if (isLoading) return <LoadingScreen message="Loading heat data..." />;
  if (!data) return <LoadingScreen message="No data available" />;

  const { heat } = data;
  const heatColor = HEAT_LEVEL_COLORS[heat.level];
  const heatProgress = heat.score / 1000;
  const bribeCost = BRIBE_COSTS[heat.level];
  const bribeReduction = BRIBE_HEAT_REDUCTION[heat.level];
  const isBribeOnCooldown = !!heat.bribe_cooldown && new Date(heat.bribe_cooldown).getTime() > Date.now();
  const nextLevel = nextLevelDown(heat.level);
  const currentThreshold = HEAT_THRESHOLDS[heat.level];
  const ptsToNextLevel = heat.level !== 'COLD' ? heat.score - currentThreshold.min : 0;
  const hoursToNextLevel = ptsToNextLevel > 0 && heat.decay_rate > 0
    ? ptsToNextLevel / heat.decay_rate
    : null;

  const effectiveDecay = layLowActive ? heat.decay_rate * 2 : heat.decay_rate;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Heat Overview */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Heat Score</Text>
          <HeatBadge level={heat.level} />
        </View>

        <View style={styles.heatScoreRow}>
          <Text style={[styles.heatScore, { color: heatColor }]}>{heat.score}</Text>
          <Text style={styles.heatScoreMax}>/ 1,000</Text>
        </View>

        <ProgressBar progress={heatProgress} color={heatColor} height={10} />

        <View style={styles.heatDetails}>
          <View style={styles.heatDetail}>
            <Text style={styles.detailLabel}>Level</Text>
            <Text style={[styles.detailValue, { color: heatColor }]}>{heat.level}</Text>
          </View>
          <View style={styles.heatDetail}>
            <Text style={styles.detailLabel}>Natural Decay</Text>
            <Text style={styles.detailValue}>-{effectiveDecay} pts/hr</Text>
          </View>
          {layLowActive && (
            <View style={styles.heatDetail}>
              <Text style={styles.detailLabel}>Lay Low Bonus</Text>
              <Text style={[styles.detailValue, { color: '#22c55e' }]}>2× decay</Text>
            </View>
          )}
        </View>

        {hoursToNextLevel !== null && nextLevel && (
          <View style={styles.nextLevelRow}>
            <Text style={styles.nextLevelText}>
              Time to reach {nextLevel}:
            </Text>
            <Text style={[styles.nextLevelTime, { color: heatColor }]}>
              ~{hoursToNextLevel.toFixed(1)}h
            </Text>
          </View>
        )}

        {heat.under_investigation && (
          <View style={styles.investigationAlert}>
            <Text style={styles.investigationText}>
              🔍 Under active investigation
              {heat.investigation_ends
                ? ` — ends in `
                : ''}
            </Text>
            {heat.investigation_ends && (
              <CountdownTimer target={heat.investigation_ends} />
            )}
          </View>
        )}
      </Card>

      {/* Bribe Officials */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Bribe Officials</Text>
        <Text style={styles.cardDesc}>
          Pay off local law enforcement to reduce your heat score.
        </Text>

        <View style={styles.bribeStats}>
          <View style={styles.bribeStat}>
            <Text style={styles.bribeStatLabel}>Cost</Text>
            <CurrencyText amount={bribeCost} variant="dirty" size="md" />
          </View>
          <View style={styles.bribeStat}>
            <Text style={styles.bribeStatLabel}>Heat Reduction</Text>
            <Text style={styles.bribeReduction}>-{bribeReduction} pts</Text>
          </View>
        </View>

        {isBribeOnCooldown ? (
          <View style={styles.cooldownContainer}>
            <Text style={styles.cooldownLabel}>Cooldown — officials are cautious</Text>
            <CountdownTimer target={heat.bribe_cooldown!} />
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.bribeButton,
              (bribeMutation.isPending || heat.level === 'COLD') && styles.bribeButtonDisabled,
            ]}
            onPress={() => bribeMutation.mutate()}
            disabled={bribeMutation.isPending || heat.level === 'COLD'}
          >
            <Text style={styles.bribeButtonText}>
              {bribeMutation.isPending
                ? 'Bribing...'
                : heat.level === 'COLD'
                ? 'Heat already cold'
                : `💰 Bribe for ${formatCurrency(bribeCost)}`}
            </Text>
          </TouchableOpacity>
        )}
      </Card>

      {/* Lay Low */}
      <Card style={styles.card}>
        <View style={styles.layLowHeader}>
          <View style={styles.layLowInfo}>
            <Text style={styles.cardTitle}>Lay Low</Text>
            <Text style={styles.cardDesc}>
              Pause all operations and stay off the radar. Doubles natural heat decay rate.
            </Text>
          </View>
          <Switch
            value={layLowActive}
            onValueChange={(val) => layLowMutation.mutate(val)}
            disabled={layLowMutation.isPending}
            trackColor={{ false: '#1f2937', true: '#166534' }}
            thumbColor={layLowActive ? '#22c55e' : '#6b7280'}
          />
        </View>

        {layLowActive && (
          <View style={styles.layLowActiveCard}>
            <Text style={styles.layLowActiveText}>
              🧊 Laying low — heat decaying at 2× rate
            </Text>
            <Text style={styles.layLowActiveNote}>
              All crime operations are paused while laying low.
            </Text>
          </View>
        )}
      </Card>

      {/* Heat Level Guide */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>Heat Levels</Text>
        {(Object.keys(HEAT_THRESHOLDS) as HeatLevel[]).map((level) => {
          const threshold = HEAT_THRESHOLDS[level];
          const color = HEAT_LEVEL_COLORS[level];
          const isCurrent = heat.level === level;

          return (
            <View
              key={level}
              style={[styles.levelRow, isCurrent && { backgroundColor: color + '15' }]}
            >
              <View style={[styles.levelDot, { backgroundColor: isCurrent ? color : '#374151' }]} />
              <Text style={[styles.levelName, isCurrent && { color }]}>{level}</Text>
              <Text style={styles.levelRange}>
                {threshold.min}–{threshold.max}
              </Text>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { marginBottom: 0 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#f9fafb', marginBottom: 4 },
  cardDesc: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginBottom: 12 },

  heatScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 10 },
  heatScore: { fontSize: 40, fontWeight: '900' },
  heatScoreMax: { fontSize: 18, color: '#6b7280' },

  heatDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  heatDetail: { flex: 1, minWidth: '45%', backgroundColor: '#030712', borderRadius: 8, padding: 8 },
  detailLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#d1d5db' },

  nextLevelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1f2937' },
  nextLevelText: { fontSize: 13, color: '#9ca3af' },
  nextLevelTime: { fontSize: 14, fontWeight: '700' },

  investigationAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: '#450a0a',
    borderRadius: 8,
    padding: 10,
  },
  investigationText: { fontSize: 12, color: '#ef4444', fontWeight: '600' },

  bribeStats: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  bribeStat: { flex: 1, backgroundColor: '#030712', borderRadius: 8, padding: 10 },
  bribeStatLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  bribeReduction: { fontSize: 16, fontWeight: '700', color: '#22c55e' },

  cooldownContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  cooldownLabel: { fontSize: 12, color: '#9ca3af', marginBottom: 2 },

  bribeButton: {
    backgroundColor: '#f97316',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  bribeButtonDisabled: { opacity: 0.45 },
  bribeButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  layLowHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  layLowInfo: { flex: 1 },
  layLowActiveCard: {
    marginTop: 12,
    backgroundColor: '#0d1f14',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 8,
    padding: 10,
  },
  layLowActiveText: { fontSize: 13, color: '#22c55e', fontWeight: '700', marginBottom: 4 },
  layLowActiveNote: { fontSize: 12, color: '#6b7280' },

  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  levelDot: { width: 10, height: 10, borderRadius: 5 },
  levelName: { flex: 1, fontSize: 13, fontWeight: '600', color: '#9ca3af' },
  levelRange: { fontSize: 12, color: '#4b5563' },
});
