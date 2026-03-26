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
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatBar } from '../../components/ui/StatBar';

interface Manager {
  id: string;
  name: string;
  efficiency: number;
  trust: number;
  assigned_to: string | null;
  assigned_business_name: string | null;
  status: string;
  salary: number;
}

interface Business {
  id: string;
  name: string;
}

export function ManagerScreen() {
  const queryClient = useQueryClient();
  const [showAssign, setShowAssign] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);

  const { data: managersData, isLoading, refetch } = useQuery({
    queryKey: ['managers'],
    queryFn: () => api.get('/managers').then((r: any) => r.data ?? r),
  });

  const { data: businessesData } = useQuery({
    queryKey: ['businesses', 'list'],
    queryFn: () => api.get('/businesses').then((r: any) => r.data ?? r),
    enabled: showAssign,
  });

  const assignMutation = useMutation({
    mutationFn: (params: { manager_id: string; business_id: string }) =>
      api.post('/managers/assign', params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['managers'] });
      setShowAssign(false);
      setSelectedManager(null);
      Alert.alert('Success', 'Manager assigned successfully!');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Failed to assign manager'),
  });

  const auditMutation = useMutation({
    mutationFn: (managerId: string) =>
      api.post('/managers/audit', { manager_id: managerId }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['managers'] });
      const result = data?.data ?? data;
      if (result?.embezzlement_found) {
        Alert.alert(
          'Embezzlement Detected!',
          `${result.manager_name} was caught skimming $${result.amount_stolen?.toLocaleString() ?? '???'}. They have been fired.`
        );
      } else {
        Alert.alert('Audit Clear', result?.message ?? 'No embezzlement detected.');
      }
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Audit failed'),
  });

  const managers: Manager[] = Array.isArray(managersData) ? managersData : managersData?.items ?? [];
  const businesses: Business[] = Array.isArray(businessesData) ? businessesData : businessesData?.items ?? [];

  const handleAssignPress = (manager: Manager) => {
    setSelectedManager(manager);
    setShowAssign(true);
  };

  const handleAudit = (manager: Manager) => {
    Alert.alert(
      'Audit Manager',
      `Run an audit on ${manager.name}? This costs $2,000 and may reveal embezzlement.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Audit', onPress: () => auditMutation.mutate(manager.id) },
      ]
    );
  };

  if (isLoading) return <LoadingSkeleton />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} tintColor="#22c55e" />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Managers</Text>
        <Text style={styles.subtitle}>{managers.length} managers assigned</Text>
      </View>

      {managers.length === 0 ? (
        <EmptyState
          icon="👔"
          title="No Managers"
          subtitle="Hire managers to oversee your businesses"
        />
      ) : (
        managers.map((manager) => (
          <Card key={manager.id} style={styles.managerCard}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.managerName}>{manager.name}</Text>
                <Text style={styles.assignedTo}>
                  {manager.assigned_business_name
                    ? `Assigned: ${manager.assigned_business_name}`
                    : 'Unassigned'}
                </Text>
              </View>
              <StatusBadge status={manager.status} />
            </View>

            <View style={styles.statsSection}>
              <StatBar
                label="Efficiency"
                value={manager.efficiency}
                color={manager.efficiency > 70 ? '#22c55e' : manager.efficiency > 40 ? '#eab308' : '#ef4444'}
              />
              <StatBar
                label="Trust"
                value={manager.trust}
                color={manager.trust > 70 ? '#22c55e' : manager.trust > 40 ? '#eab308' : '#ef4444'}
              />
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.assignBtn}
                onPress={() => handleAssignPress(manager)}
              >
                <Text style={styles.assignBtnText}>Assign</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.auditBtn}
                onPress={() => handleAudit(manager)}
                disabled={auditMutation.isPending}
              >
                <Text style={styles.auditBtnText}>
                  {auditMutation.isPending ? 'Auditing...' : 'Audit ($2,000)'}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))
      )}

      {/* Assign Modal */}
      <Modal visible={showAssign} transparent animationType="fade" onRequestClose={() => setShowAssign(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowAssign(false)}>
          <View style={styles.dialog} onStartShouldSetResponder={() => true}>
            <Text style={styles.dialogTitle}>Assign {selectedManager?.name}</Text>
            <Text style={styles.dialogSubtext}>Select a business to assign this manager to</Text>

            {businesses.length === 0 ? (
              <Text style={styles.emptyText}>No businesses available</Text>
            ) : (
              <ScrollView style={styles.businessList}>
                {businesses.map((biz) => (
                  <TouchableOpacity
                    key={biz.id}
                    style={styles.businessOption}
                    onPress={() => {
                      if (selectedManager) {
                        assignMutation.mutate({
                          manager_id: selectedManager.id,
                          business_id: biz.id,
                        });
                      }
                    }}
                    disabled={assignMutation.isPending}
                  >
                    <Text style={styles.businessOptionText}>{biz.name}</Text>
                    <Text style={styles.chevron}>{'\u203A'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAssign(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
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
  managerCard: { marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  managerName: { fontSize: 16, fontWeight: '700', color: '#f9fafb' },
  assignedTo: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  statsSection: { marginBottom: 12, gap: 6 },
  cardActions: { flexDirection: 'row', gap: 10 },
  assignBtn: { flex: 1, backgroundColor: '#22c55e', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  assignBtnText: { color: '#030712', fontWeight: '700', fontSize: 13 },
  auditBtn: { flex: 1, backgroundColor: '#0c1a2e', borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  auditBtnText: { color: '#3b82f6', fontWeight: '700', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#111827', borderRadius: 14, padding: 24, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#1f2937' },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 4 },
  dialogSubtext: { fontSize: 13, color: '#6b7280', marginBottom: 16 },
  emptyText: { color: '#4b5563', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  businessList: { maxHeight: 240 },
  businessOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  businessOptionText: { fontSize: 15, color: '#d1d5db', fontWeight: '600' },
  chevron: { fontSize: 20, color: '#4b5563' },
  cancelBtn: { marginTop: 16, backgroundColor: '#1f2937', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
  cancelBtnText: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },
});
