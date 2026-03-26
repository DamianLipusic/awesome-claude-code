import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { useToast } from '../../components/Toast';

interface DeliveryJob {
  id: string;
  resource_name: string;
  resource_icon: string;
  quantity: number;
  origin: string;
  destination: string;
  standard_fee: number;
  posted_at: string;
  distance_km: number;
  weight_tons: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}

export function DeliveryBoardScreen() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingClaim, setPendingClaim] = useState<DeliveryJob | null>(null);
  const [negotiateJob, setNegotiateJob] = useState<DeliveryJob | null>(null);
  const [counterOffer, setCounterOffer] = useState('');

  const { data: jobs, isLoading, refetch, isRefetching } = useQuery<DeliveryJob[]>({
    queryKey: ['logistics', 'deliveries', 'available'],
    queryFn: () => api.get<DeliveryJob[]>('/logistics/deliveries/available'),
    staleTime: 15_000,
  });

  const claimMutation = useMutation({
    mutationFn: (deliveryId: string) => api.post('/logistics/deliveries/' + deliveryId + '/claim'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics'] });
      setPendingClaim(null);
      toast.show('Delivery claimed!', 'success');
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Failed to claim delivery', 'error'); setPendingClaim(null); },
  });

  const negotiateMutation = useMutation({
    mutationFn: ({ deliveryId, offer }: { deliveryId: string; offer: number }) =>
      api.post('/logistics/deliveries/' + deliveryId + '/negotiate', { counter_offer: offer }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logistics'] });
      setNegotiateJob(null);
      setCounterOffer('');
      toast.show('Counter-offer submitted!', 'success');
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Negotiation failed', 'error'); },
  });

  if (isLoading) return <View style={s.screen}><View style={{ padding: 16 }}><LoadingSkeleton rows={5} /></View></View>;

  return (
    <View style={s.screen}>
      {(jobs ?? []).length === 0 ? (
        <EmptyState icon="📋" title="No deliveries available" subtitle="Check back soon!" />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#00d2d3" />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View style={s.jobCard}>
              <View style={s.jobHeader}>
                <View style={s.resourceRow}>
                  <Text style={s.resourceIcon}>{item.resource_icon || '📦'}</Text>
                  <View>
                    <Text style={s.resourceName}>{item.resource_name} x{item.quantity}</Text>
                    <Text style={s.postedAt}>Posted {timeAgo(item.posted_at)}</Text>
                  </View>
                </View>
                <Text style={s.fee}>{formatCurrency(item.standard_fee)}</Text>
              </View>

              <View style={s.routeRow}>
                <Text style={s.routeText}>{item.origin}</Text>
                <Text style={s.routeArrow}> → </Text>
                <Text style={s.routeText}>{item.destination}</Text>
              </View>

              <View style={s.btnRow}>
                <TouchableOpacity style={s.claimBtn} onPress={() => setPendingClaim(item)}>
                  <Text style={s.claimBtnText}>Claim Delivery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.negotiateBtn} onPress={() => { setNegotiateJob(item); setCounterOffer(String(Math.round(item.standard_fee * 1.2))); }}>
                  <Text style={s.negotiateBtnText}>Negotiate</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <ConfirmModal
        visible={pendingClaim !== null}
        title="Claim Delivery"
        message={pendingClaim ? 'Claim delivery of ' + pendingClaim.resource_name + ' x' + pendingClaim.quantity + ' for ' + formatCurrency(pendingClaim.standard_fee) + '?' : ''}
        confirmLabel="Claim"
        onConfirm={() => { if (pendingClaim) claimMutation.mutate(pendingClaim.id); }}
        onCancel={() => setPendingClaim(null)}
        isLoading={claimMutation.isPending}
      />

      {/* Negotiate Modal */}
      <Modal visible={negotiateJob !== null} transparent animationType="fade" onRequestClose={() => setNegotiateJob(null)}>
        <View style={s.backdrop}>
          <View style={s.dialog}>
            <Text style={s.dialogTitle}>Counter-Offer</Text>
            <Text style={s.dialogSubtitle}>Standard fee: {negotiateJob ? formatCurrency(negotiateJob.standard_fee) : ''}</Text>
            <Text style={s.inputLabel}>Your offer</Text>
            <TextInput
              style={s.input}
              value={counterOffer}
              onChangeText={setCounterOffer}
              keyboardType="numeric"
              placeholder="Enter amount"
              placeholderTextColor="#a0a0b0"
            />
            <View style={s.dialogBtnRow}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setNegotiateJob(null)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.submitBtn, negotiateMutation.isPending && { opacity: 0.6 }]}
                onPress={() => {
                  if (negotiateJob) negotiateMutation.mutate({ deliveryId: negotiateJob.id, offer: parseFloat(counterOffer) || 0 });
                }}
                disabled={negotiateMutation.isPending}
              >
                {negotiateMutation.isPending ? <ActivityIndicator color="#0a0a0f" /> : <Text style={s.submitBtnText}>Submit Offer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0f' },
  listContent: { padding: 12, paddingBottom: 32 },
  jobCard: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a3e' },
  jobHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  resourceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resourceIcon: { fontSize: 28 },
  resourceName: { fontSize: 15, fontWeight: '700', color: '#e0e0e0' },
  postedAt: { fontSize: 11, color: '#a0a0b0', marginTop: 2 },
  fee: { fontSize: 16, fontWeight: '800', color: '#00d2d3' },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, backgroundColor: '#12121a', borderRadius: 8, padding: 8 },
  routeText: { fontSize: 13, fontWeight: '600', color: '#e0e0e0' },
  routeArrow: { fontSize: 13, color: '#a0a0b0' },
  btnRow: { flexDirection: 'row', gap: 8 },
  claimBtn: { flex: 2, backgroundColor: '#6c5ce7', borderRadius: 8, padding: 10, alignItems: 'center' },
  claimBtnText: { color: '#e0e0e0', fontSize: 13, fontWeight: '700' },
  negotiateBtn: { flex: 1, backgroundColor: '#12121a', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2a2a3e' },
  negotiateBtnText: { color: '#ffa502', fontSize: 13, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#1a1a2e', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: '#2a2a3e' },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: '#e0e0e0', marginBottom: 4 },
  dialogSubtitle: { fontSize: 13, color: '#a0a0b0', marginBottom: 16 },
  inputLabel: { fontSize: 12, color: '#a0a0b0', fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#12121a', borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 8, padding: 12, color: '#e0e0e0', fontSize: 16, marginBottom: 16 },
  dialogBtnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#2a2a3e', padding: 12, borderRadius: 8, alignItems: 'center' },
  cancelBtnText: { color: '#a0a0b0', fontSize: 14, fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: '#ffa502', padding: 12, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#0a0a0f', fontSize: 14, fontWeight: '700' },
});
