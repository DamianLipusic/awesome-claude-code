import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { Card } from '../../components/ui/Card';
import { StatusBadge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { StatBar } from '../../components/ui/StatBar';

interface Syndicate {
  id: string;
  name: string;
  leader_name: string;
  member_count: number;
  treasury: number;
  status: string;
}

interface TrustEntry {
  player_id: string;
  player_name: string;
  trust_score: number;
}

export function AllianceScreen() {
  const queryClient = useQueryClient();
  const player = useAuthStore((s) => s.player);
  const [showCreate, setShowCreate] = useState(false);
  const [syndicateName, setSyndicateName] = useState('');
  const [selectedSyndicate, setSelectedSyndicate] = useState<Syndicate | null>(null);

  const { data: syndicates, isLoading, refetch } = useQuery({
    queryKey: ['alliances', 'syndicates'],
    queryFn: () => api.get('/alliances/syndicates').then((r: any) => r.data),
  });

  const { data: trustData } = useQuery({
    queryKey: ['alliances', 'trust', player?.id],
    queryFn: () => api.get(`/alliances/trust/${player?.id}`).then((r: any) => r.data),
    enabled: !!player?.id,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.post('/alliances/syndicates', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alliances'] });
      setShowCreate(false);
      setSyndicateName('');
      Alert.alert('Success', 'Syndicate created!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to create syndicate'),
  });

  const syndicateList: Syndicate[] = syndicates ?? [];
  const trustList: TrustEntry[] = trustData?.entries ?? [];

  if (isLoading) return <LoadingSkeleton />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#22c55e" />}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Alliances</Text>
          <Text style={styles.subtitle}>{syndicateList.length} syndicates active</Text>
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => setShowCreate(true)}>
          <Text style={styles.primaryBtnText}>+ Create Syndicate</Text>
        </TouchableOpacity>
      </View>

      {syndicateList.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="No Syndicates"
          subtitle="Create or join a syndicate to form alliances"
        />
      ) : (
        syndicateList.map((s) => (
          <TouchableOpacity key={s.id} onPress={() => setSelectedSyndicate(s)}>
            <Card style={styles.syndicateCard}>
              <View style={styles.syndicateHeader}>
                <Text style={styles.syndicateName}>{s.name}</Text>
                <StatusBadge status={s.status} />
              </View>
              <View style={styles.syndicateStats}>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Leader</Text>
                  <Text style={styles.statValue}>{s.leader_name}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Members</Text>
                  <Text style={styles.statValue}>{s.member_count}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statLabel}>Treasury</Text>
                  <Text style={[styles.statValue, { color: '#22c55e' }]}>
                    {formatCurrency(s.treasury)}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}

      {trustList.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trust Levels</Text>
          {trustList.map((t) => (
            <Card key={t.player_id} style={styles.trustCard}>
              <Text style={styles.trustName}>{t.player_name}</Text>
              <StatBar
                label="Trust"
                value={t.trust_score}
                color={t.trust_score > 70 ? '#22c55e' : t.trust_score > 40 ? '#eab308' : '#ef4444'}
              />
            </Card>
          ))}
        </View>
      )}

      {/* Syndicate Details Modal */}
      <Modal visible={!!selectedSyndicate} transparent animationType="fade" onRequestClose={() => setSelectedSyndicate(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelectedSyndicate(null)}>
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            <Text style={styles.dialogTitle}>{selectedSyndicate?.name}</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Leader</Text>
              <Text style={styles.detailValue}>{selectedSyndicate?.leader_name}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Members</Text>
              <Text style={styles.detailValue}>{selectedSyndicate?.member_count}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Treasury</Text>
              <Text style={[styles.detailValue, { color: '#22c55e' }]}>
                {formatCurrency(selectedSyndicate?.treasury ?? 0)}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedSyndicate(null)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Create Syndicate Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowCreate(false)}>
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            <Text style={styles.dialogTitle}>Create Syndicate</Text>
            <Text style={styles.dialogSubtext}>Costs $10,000 to establish</Text>
            <TextInput
              style={styles.input}
              placeholder="Syndicate name..."
              placeholderTextColor="#6b7280"
              value={syndicateName}
              onChangeText={setSyndicateName}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1, alignItems: 'center' as const }, !syndicateName && styles.disabledBtn]}
                onPress={() => syndicateName && createMutation.mutate(syndicateName)}
                disabled={!syndicateName || createMutation.isPending}
              >
                <Text style={styles.primaryBtnText}>
                  {createMutation.isPending ? 'Creating...' : 'Create ($10,000)'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  primaryBtn: { backgroundColor: '#22c55e', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { color: '#030712', fontWeight: '700', fontSize: 13 },
  disabledBtn: { opacity: 0.5 },
  syndicateCard: { marginBottom: 10 },
  syndicateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  syndicateName: { fontSize: 17, fontWeight: '700', color: '#f9fafb' },
  syndicateStats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center' },
  statLabel: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600', marginBottom: 3 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#d1d5db' },
  section: { marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 12 },
  trustCard: { marginBottom: 8 },
  trustName: { fontSize: 14, fontWeight: '600', color: '#d1d5db', marginBottom: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#111827', borderRadius: 14, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#1f2937' },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 6 },
  dialogSubtext: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  detailLabel: { fontSize: 13, color: '#6b7280' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#d1d5db' },
  closeBtn: { marginTop: 16, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  closeBtnText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },
  input: { backgroundColor: '#0a0f1a', borderWidth: 1, borderColor: '#1f2937', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: '#f9fafb', fontSize: 15, marginBottom: 16 },
  modalBtnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  cancelBtnText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },
});
