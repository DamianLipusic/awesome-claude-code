import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';

type RivalryState = 'NEUTRAL' | 'COMPETITIVE' | 'HOSTILE' | 'WAR' | 'BLOOD_FEUD';
type SabotageType = 'ARSON' | 'THEFT' | 'POACH_EMPLOYEE' | 'SPREAD_RUMORS';

const STATE_COLORS: Record<RivalryState, { variant: 'gray' | 'yellow' | 'orange' | 'red' | 'purple' }> = {
  NEUTRAL: { variant: 'gray' },
  COMPETITIVE: { variant: 'yellow' },
  HOSTILE: { variant: 'orange' },
  WAR: { variant: 'red' },
  BLOOD_FEUD: { variant: 'purple' },
};

const SABOTAGE_OPTIONS: { type: SabotageType; label: string; cost: number; chance: number }[] = [
  { type: 'ARSON', label: 'Arson', cost: 5000, chance: 50 },
  { type: 'THEFT', label: 'Theft', cost: 3000, chance: 60 },
  { type: 'POACH_EMPLOYEE', label: 'Poach Employee', cost: 8000, chance: 40 },
  { type: 'SPREAD_RUMORS', label: 'Spread Rumors', cost: 2000, chance: 70 },
];

interface Rivalry {
  id: string;
  opponent_id: string;
  opponent_name: string;
  rivalry_points: number;
  state: RivalryState;
}

export function RivalryScreen() {
  const queryClient = useQueryClient();
  const [sabotageTarget, setSabotageTarget] = useState<Rivalry | null>(null);

  const { data: rivalries, isLoading, refetch } = useQuery({
    queryKey: ['rivalry'],
    queryFn: () => api.get('/rivalry').then((r: any) => r.data),
  });

  const sabotageMutation = useMutation({
    mutationFn: (params: { target_id: string; sabotage_type: SabotageType }) =>
      api.post('/rivalry/sabotage', params),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['rivalry'] });
      setSabotageTarget(null);
      Alert.alert('Sabotage Result', data?.data?.message ?? 'Sabotage executed!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Sabotage failed'),
  });

  const ceasefireMutation = useMutation({
    mutationFn: (playerId: string) => api.post(`/rivalry/ceasefire/${playerId}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rivalry'] });
      Alert.alert('Ceasefire', 'Ceasefire proposal sent.');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Ceasefire failed'),
  });

  const rivalryList: Rivalry[] = rivalries ?? [];

  if (isLoading) return <LoadingSkeleton />;

  const canCeasefire = (state: RivalryState) => {
    return state !== 'NEUTRAL' && state !== 'COMPETITIVE';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#22c55e" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Rivalries & War</Text>
        <Text style={styles.subtitle}>{rivalryList.length} active rivalries</Text>
      </View>

      {rivalryList.length === 0 ? (
        <EmptyState
          icon="⚔️"
          title="No Rivalries"
          subtitle="Your actions against other players will create rivalries"
        />
      ) : (
        rivalryList.map((r) => {
          const stateConfig = STATE_COLORS[r.state] ?? STATE_COLORS.NEUTRAL;
          return (
            <Card key={r.id} style={styles.rivalCard}>
              <View style={styles.rivalHeader}>
                <View>
                  <Text style={styles.rivalName}>{r.opponent_name}</Text>
                  <Text style={styles.rivalPoints}>{r.rivalry_points} rivalry points</Text>
                </View>
                <Badge label={r.state.replace(/_/g, ' ')} variant={stateConfig.variant} size="md" />
              </View>

              {/* Rivalry gauge */}
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${Math.min(100, (r.rivalry_points / 1000) * 100)}%`,
                      backgroundColor:
                        r.state === 'BLOOD_FEUD' ? '#a855f7' :
                        r.state === 'WAR' ? '#ef4444' :
                        r.state === 'HOSTILE' ? '#f97316' :
                        r.state === 'COMPETITIVE' ? '#eab308' : '#6b7280',
                    },
                  ]}
                />
              </View>

              <View style={styles.rivalActions}>
                <TouchableOpacity
                  style={styles.sabotageBtn}
                  onPress={() => setSabotageTarget(r)}
                >
                  <Text style={styles.sabotageBtnText}>Sabotage</Text>
                </TouchableOpacity>
                {canCeasefire(r.state) && (
                  <TouchableOpacity
                    style={styles.ceasefireBtn}
                    onPress={() => ceasefireMutation.mutate(r.opponent_id)}
                    disabled={ceasefireMutation.isPending}
                  >
                    <Text style={styles.ceasefireBtnText}>
                      {ceasefireMutation.isPending ? 'Sending...' : 'Ceasefire'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          );
        })
      )}

      {/* Sabotage Modal */}
      <Modal visible={!!sabotageTarget} transparent animationType="fade" onRequestClose={() => setSabotageTarget(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSabotageTarget(null)}>
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            <Text style={styles.dialogTitle}>Sabotage {sabotageTarget?.opponent_name}</Text>
            <Text style={styles.dialogSubtext}>Choose your sabotage method</Text>
            {SABOTAGE_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.type}
                style={styles.sabotageOption}
                onPress={() => {
                  if (sabotageTarget) {
                    sabotageMutation.mutate({
                      target_id: sabotageTarget.opponent_id,
                      sabotage_type: opt.type,
                    });
                  }
                }}
                disabled={sabotageMutation.isPending}
              >
                <View style={styles.sabotageOptionInfo}>
                  <Text style={styles.sabotageOptionLabel}>{opt.label}</Text>
                  <Text style={styles.sabotageOptionCost}>{formatCurrency(opt.cost)}</Text>
                </View>
                <Text style={styles.sabotageOptionChance}>{opt.chance}% success</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSabotageTarget(null)}>
              <Text style={styles.closeBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  rivalCard: { marginBottom: 12 },
  rivalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rivalName: { fontSize: 17, fontWeight: '700', color: '#f9fafb' },
  rivalPoints: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  gaugeTrack: { height: 4, borderRadius: 2, backgroundColor: '#1f2937', overflow: 'hidden', marginBottom: 12 },
  gaugeFill: { height: '100%', borderRadius: 2 },
  rivalActions: { flexDirection: 'row', gap: 10 },
  sabotageBtn: { flex: 1, backgroundColor: '#1a0505', borderWidth: 1, borderColor: '#ef4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  sabotageBtnText: { color: '#ef4444', fontWeight: '700', fontSize: 13 },
  ceasefireBtn: { flex: 1, backgroundColor: '#0c1a2e', borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  ceasefireBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#111827', borderRadius: 14, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#1f2937' },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 4 },
  dialogSubtext: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  sabotageOption: { backgroundColor: '#0a0f1a', borderWidth: 1, borderColor: '#1f2937', borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sabotageOptionInfo: { flex: 1 },
  sabotageOptionLabel: { fontSize: 15, fontWeight: '600', color: '#f9fafb' },
  sabotageOptionCost: { fontSize: 12, color: '#ef4444', marginTop: 2 },
  sabotageOptionChance: { fontSize: 12, fontWeight: '600', color: '#22c55e' },
  closeBtn: { marginTop: 8, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  closeBtnText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },
});
