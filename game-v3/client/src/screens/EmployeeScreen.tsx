import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatBar } from '../components/ui/StatBar';
import { CountdownTimer } from '../components/ui/CountdownTimer';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../components/ui/CurrencyText';

// ─── Types ─────────────────────────────────────────

interface DiscoveryHint {
  id: string;
  key: string;
  ui_surface: string;
  reward_type: string;
  reward_payload: { message: string };
}

interface PoolEmployee {
  id: string;
  name: string;
  role: string;
  salary: number;
  efficiency: number;
  speed: number;
  loyalty: number;
  discretion: number;
  learning_rate: number;
  corruption_risk: number;
  status: string;
}

interface Business {
  id: string;
  name: string;
  type: string;
  tier: number;
  employee_count: number;
}

interface OwnedEmployee {
  id: string;
  name: string;
  role: string;
  salary: number;
  efficiency: number;
  speed: number;
  loyalty: number;
  discretion: number;
  stress: number;
  status: string;
  hired_at: string | null;
}

interface EmployeeDetail {
  id: string;
  name: string;
  status: string;
  training: {
    type: string;
    stat_targets: Record<string, number>;
    started_at: string;
    ends_at: string;
    status: string;
  } | null;
}

interface BusinessDetail {
  id: string;
  name: string;
  type: string;
  tier: number;
  employees: OwnedEmployee[];
  max_employees: number;
}

const TRAINING_TYPES = [
  { key: 'basic', label: 'Basic Training', duration: '1h', multiplier: 2, maxStatGain: 10 },
  { key: 'advanced', label: 'Advanced Training', duration: '4h', multiplier: 5, maxStatGain: 20 },
  { key: 'elite', label: 'Elite Training', duration: '12h', multiplier: 10, maxStatGain: 35 },
];

type SectionKey = 'pool' | 'my' | 'training';

export function EmployeeScreen() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [activeSection, setActiveSection] = useState<SectionKey>('pool');
  const [hireModalEmp, setHireModalEmp] = useState<PoolEmployee | null>(null);
  const [selectedBizId, setSelectedBizId] = useState<string | null>(null);
  const [trainModalEmp, setTrainModalEmp] = useState<(OwnedEmployee & { business_name: string; business_id: string }) | null>(null);

  // ─── Discovery Hints ────────────────────────────
  const { data: hints } = useQuery<DiscoveryHint[]>({
    queryKey: ['discovery'],
    queryFn: () => api.get<DiscoveryHint[]>('/discovery'),
    refetchInterval: 30000,
  });

  const dismissHint = useMutation({
    mutationFn: (ruleId: string) => api.post(`/discovery/${ruleId}/done`),
    onSuccess: () => {
      show('New insight gained! +150 XP', 'success');
      queryClient.invalidateQueries({ queryKey: ['discovery'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const empHints = (hints ?? []).filter((h) => h.ui_surface === 'employees');

  // ─── Queries ─────────────────────────────────────
  const { data: pool, isLoading: poolLoading, refetch: refetchPool, isRefetching } = useQuery<PoolEmployee[]>({
    queryKey: ['employeePool'],
    queryFn: () => api.get<PoolEmployee[]>('/employees/pool'),
    refetchInterval: 30000,
  });

  const { data: businesses } = useQuery<Business[]>({
    queryKey: ['businesses'],
    queryFn: () => api.get<Business[]>('/businesses'),
    refetchInterval: 30000,
  });

  // Fetch all businesses with employee details to show "My Employees"
  const { data: bizDetails } = useQuery<BusinessDetail[]>({
    queryKey: ['businessDetails'],
    queryFn: async () => {
      if (!businesses || businesses.length === 0) return [];
      const details = await Promise.all(
        businesses.map((b) => api.get<BusinessDetail>(`/businesses/${b.id}`))
      );
      return details;
    },
    enabled: !!businesses && businesses.length > 0,
    refetchInterval: 30000,
  });

  // ─── Mutations ───────────────────────────────────
  const hireMutation = useMutation({
    mutationFn: (body: { employee_id: string; business_id: string }) =>
      api.post('/employees/hire', body),
    onSuccess: () => {
      show('Employee hired!', 'success');
      queryClient.invalidateQueries({ queryKey: ['employeePool'] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['businessDetails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setHireModalEmp(null);
      setSelectedBizId(null);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const trainMutation = useMutation({
    mutationFn: ({ empId, type }: { empId: string; type: string }) =>
      api.post(`/employees/${empId}/train`, { type }),
    onSuccess: () => {
      show('Training started!', 'success');
      queryClient.invalidateQueries({ queryKey: ['businessDetails'] });
      queryClient.invalidateQueries({ queryKey: ['trainingDetails'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setTrainModalEmp(null);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  // ─── Section Headers ────────────────────────────
  const sections: { key: SectionKey; label: string }[] = [
    { key: 'pool', label: 'Recruit Pool' },
    { key: 'my', label: 'My Employees' },
    { key: 'training', label: 'Training' },
  ];

  // Collect all owned employees
  const allOwnedEmps: Array<OwnedEmployee & { business_name: string; business_id: string }> = [];
  const trainingEmps: Array<OwnedEmployee & { business_name: string; business_id: string }> = [];
  if (bizDetails) {
    for (const biz of bizDetails) {
      for (const emp of biz.employees) {
        const entry = { ...emp, business_name: biz.name, business_id: biz.id };
        allOwnedEmps.push(entry);
        if (emp.status === 'training') {
          trainingEmps.push(entry);
        }
      }
    }
  }

  // Fetch training details (ends_at, stat_targets) for employees in training
  const trainingEmpIds = trainingEmps.map((e) => e.id);
  const { data: trainingDetailsMap } = useQuery<Record<string, EmployeeDetail['training']>>({
    queryKey: ['trainingDetails', trainingEmpIds.join(',')],
    queryFn: async () => {
      if (trainingEmpIds.length === 0) return {};
      const results: Record<string, EmployeeDetail['training']> = {};
      await Promise.all(
        trainingEmpIds.map(async (id) => {
          try {
            const detail = await api.get<EmployeeDetail>(`/employees/${id}`);
            results[id] = detail.training;
          } catch {
            // ignore
          }
        })
      );
      return results;
    },
    enabled: trainingEmpIds.length > 0,
    refetchInterval: 30000,
  });

  if (poolLoading) {
    return <LoadingScreen message="Loading employees..." />;
  }

  // ─── Render ──────────────────────────────────────

  const renderPool = () => {
    if (!pool || pool.length === 0) {
      return <EmptyState icon="\u{1F465}" title="No recruits available" subtitle="Check back later for new candidates" />;
    }
    return pool.map((emp) => (
      <Card key={emp.id} style={styles.empCard}>
        <View style={styles.empHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{emp.name}</Text>
            <Text style={styles.empSalary}>{formatCurrency(Number(emp.salary))}/mo</Text>
          </View>
          <TouchableOpacity
            style={styles.hireBtn}
            onPress={() => setHireModalEmp(emp)}
          >
            <Text style={styles.hireBtnText}>Hire</Text>
          </TouchableOpacity>
        </View>
        <StatBar label="Efficiency" value={emp.efficiency} color="#22c55e" />
        <StatBar label="Speed" value={emp.speed} color="#3b82f6" />
        <StatBar label="Loyalty" value={emp.loyalty} color="#a855f7" />
      </Card>
    ));
  };

  const renderMyEmployees = () => {
    if (allOwnedEmps.length === 0) {
      return <EmptyState icon="\u{1F464}" title="No employees yet" subtitle="Hire from the recruit pool" />;
    }

    // Group by business
    const grouped: Record<string, typeof allOwnedEmps> = {};
    for (const emp of allOwnedEmps) {
      if (!grouped[emp.business_name]) grouped[emp.business_name] = [];
      grouped[emp.business_name].push(emp);
    }

    return Object.entries(grouped).map(([bizName, emps]) => (
      <View key={bizName}>
        <Text style={styles.groupTitle}>{bizName}</Text>
        {emps.map((emp) => (
          <Card key={emp.id} style={styles.empCard}>
            <View style={styles.empHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.empName}>{emp.name}</Text>
                <Text style={styles.empSalary}>{formatCurrency(Number(emp.salary))}/mo</Text>
              </View>
              <Badge
                label={emp.status.toUpperCase()}
                variant={emp.status === 'active' ? 'green' : emp.status === 'training' ? 'orange' : 'gray'}
              />
            </View>
            <StatBar label="Efficiency" value={emp.efficiency} color="#22c55e" />
            <StatBar label="Speed" value={emp.speed} color="#3b82f6" />
            <StatBar label="Stress" value={emp.stress} color="#ef4444" />
            {emp.status === 'active' && (
              <TouchableOpacity
                style={styles.trainBtn}
                onPress={() => setTrainModalEmp(emp)}
              >
                <Text style={styles.trainBtnText}>Train</Text>
              </TouchableOpacity>
            )}
            {emp.status === 'training' && trainingDetailsMap?.[emp.id]?.ends_at && (
              <View style={styles.trainingInfo}>
                <CountdownTimer
                  target={trainingDetailsMap[emp.id]!.ends_at}
                  prefix="Training: "
                />
              </View>
            )}
          </Card>
        ))}
      </View>
    ));
  };

  const renderTraining = () => {
    if (trainingEmps.length === 0) {
      return <EmptyState icon="\u{1F4DA}" title="No active training" subtitle="Train employees from the My Employees tab or business detail screen" />;
    }

    return trainingEmps.map((emp) => {
      const tInfo = trainingDetailsMap?.[emp.id];
      return (
        <Card key={emp.id} style={styles.empCard}>
          <View style={styles.empHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.empName}>{emp.name}</Text>
              <Text style={styles.empSalary}>{emp.business_name}</Text>
            </View>
            <Badge label="TRAINING" variant="orange" />
          </View>
          {tInfo?.ends_at && (
            <View style={styles.trainingInfo}>
              <CountdownTimer target={tInfo.ends_at} prefix="Time left: " />
              {tInfo.type && (
                <Text style={styles.trainingType}>
                  {tInfo.type.charAt(0).toUpperCase() + tInfo.type.slice(1)} training
                </Text>
              )}
            </View>
          )}
          {tInfo?.stat_targets && (
            <View style={styles.statTargetRow}>
              {Object.entries(tInfo.stat_targets).map(([stat, gain]) => (
                <View key={stat} style={styles.statTargetBadge}>
                  <Text style={styles.statTargetText}>
                    {stat.charAt(0).toUpperCase() + stat.slice(1)} +{gain}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <StatBar label="Efficiency" value={emp.efficiency} color="#22c55e" />
          <StatBar label="Speed" value={emp.speed} color="#3b82f6" />
        </Card>
      );
    });
  };

  const sectionContent: Record<SectionKey, () => React.ReactNode> = {
    pool: renderPool,
    my: renderMyEmployees,
    training: renderTraining,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchPool} tintColor="#22c55e" colors={['#22c55e']} />
        }
      >
        <Text style={styles.title}>Employees</Text>

        {/* Section Tabs */}
        <View style={styles.sectionBar}>
          {sections.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.sectionTab, activeSection === s.key && styles.sectionTabActive]}
              onPress={() => setActiveSection(s.key)}
            >
              <Text style={[styles.sectionTabText, activeSection === s.key && styles.sectionTabTextActive]}>
                {s.label}
                {s.key === 'pool' && pool ? ` (${pool.length})` : ''}
                {s.key === 'my' ? ` (${allOwnedEmps.length})` : ''}
                {s.key === 'training' ? ` (${trainingEmps.length})` : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Discovery Hints Banner */}
        {empHints.length > 0 && empHints.map((hint) => (
          <View key={hint.id} style={styles.hintBanner}>
            <Text style={styles.hintBannerIcon}>{'\u{1F4A1}'}</Text>
            <Text style={styles.hintBannerText}>{hint.reward_payload.message}</Text>
            <TouchableOpacity
              onPress={() => dismissHint.mutate(hint.id)}
              disabled={dismissHint.isPending}
              style={styles.hintBannerBtn}
            >
              <Text style={styles.hintBannerBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        ))}

        {sectionContent[activeSection]()}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Hire Modal — Select Business */}
      <Modal visible={hireModalEmp !== null} transparent animationType="fade" onRequestClose={() => setHireModalEmp(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Hire {hireModalEmp?.name}
            </Text>
            <Text style={styles.modalSub}>
              Salary: {formatCurrency(Number(hireModalEmp?.salary ?? 0))}/mo (paid upfront)
            </Text>
            <Text style={[styles.modalSub, { marginBottom: 16 }]}>Select a business:</Text>

            {businesses && businesses.length > 0 ? (
              businesses.map((biz) => (
                <TouchableOpacity
                  key={biz.id}
                  style={[
                    styles.bizOption,
                    selectedBizId === biz.id && styles.bizOptionSelected,
                  ]}
                  onPress={() => setSelectedBizId(biz.id)}
                >
                  <Text style={styles.bizOptionName}>{biz.name}</Text>
                  <Text style={styles.bizOptionMeta}>
                    {biz.type} T{biz.tier} - {biz.employee_count} emp
                  </Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.modalSub}>No businesses available. Create one first.</Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => { setHireModalEmp(null); setSelectedBizId(null); }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, !selectedBizId && { opacity: 0.5 }]}
                disabled={!selectedBizId || hireMutation.isPending}
                onPress={() => {
                  if (hireModalEmp && selectedBizId) {
                    hireMutation.mutate({ employee_id: hireModalEmp.id, business_id: selectedBizId });
                  }
                }}
              >
                <Text style={styles.modalConfirmText}>
                  {hireMutation.isPending ? 'Hiring...' : 'Hire'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Train Modal — Select Training Type */}
      <Modal visible={trainModalEmp !== null} transparent animationType="fade" onRequestClose={() => setTrainModalEmp(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Train {trainModalEmp?.name}
            </Text>
            <Text style={styles.modalSub}>
              {trainModalEmp?.business_name} - {formatCurrency(Number(trainModalEmp?.salary ?? 0))}/mo
            </Text>
            <Text style={[styles.modalSub, { marginBottom: 16 }]}>Select training type:</Text>

            {TRAINING_TYPES.map((tt) => {
              const cost = Number(trainModalEmp?.salary ?? 0) * tt.multiplier;
              return (
                <TouchableOpacity
                  key={tt.key}
                  style={styles.trainOption}
                  onPress={() => {
                    if (trainModalEmp) trainMutation.mutate({ empId: trainModalEmp.id, type: tt.key });
                  }}
                  disabled={trainMutation.isPending}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trainOptTitle}>{tt.label}</Text>
                    <Text style={styles.trainOptSub}>
                      {tt.duration} - Cost: {formatCurrency(cost)} - Up to +{tt.maxStatGain} stats
                    </Text>
                  </View>
                  <Badge
                    label={tt.key}
                    variant={tt.key === 'basic' ? 'green' : tt.key === 'advanced' ? 'blue' : 'purple'}
                  />
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.modalCancel} onPress={() => setTrainModalEmp(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 52 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb', marginBottom: 16 },
  sectionBar: { flexDirection: 'row', marginBottom: 16, gap: 6 },
  sectionTab: {
    flex: 1, paddingVertical: 10, borderRadius: 8,
    backgroundColor: '#1f2937', alignItems: 'center',
  },
  sectionTabActive: { backgroundColor: '#22c55e' },
  sectionTabText: { color: '#9ca3af', fontSize: 12, fontWeight: '700' },
  sectionTabTextActive: { color: '#030712' },
  groupTitle: {
    fontSize: 14, fontWeight: '700', color: '#d1d5db',
    marginTop: 12, marginBottom: 8,
    paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#1f2937',
  },
  empCard: { marginBottom: 10 },
  empHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  empName: { fontSize: 15, fontWeight: '700', color: '#f9fafb' },
  empSalary: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  hireBtn: {
    backgroundColor: '#22c55e', borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  hireBtnText: { color: '#030712', fontSize: 13, fontWeight: '700' },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: '#111827', borderRadius: 14, padding: 24,
    width: '100%', maxWidth: 380, borderWidth: 1, borderColor: '#1f2937',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 6 },
  modalSub: { fontSize: 13, color: '#9ca3af', marginBottom: 4 },
  bizOption: {
    backgroundColor: '#1f2937', borderRadius: 10, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: '#374151',
  },
  bizOptionSelected: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  bizOptionName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  bizOptionMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancel: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', alignItems: 'center',
  },
  modalCancelText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
  modalConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: 8,
    backgroundColor: '#22c55e', alignItems: 'center',
  },
  modalConfirmText: { color: '#030712', fontSize: 14, fontWeight: '700' },
  trainBtn: {
    marginTop: 8, backgroundColor: '#0c1a2e', borderRadius: 8,
    borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 8, alignItems: 'center',
  },
  trainBtnText: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },
  trainingInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#1f2937',
  },
  trainingType: { color: '#9ca3af', fontSize: 12, fontWeight: '600' },
  statTargetRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8,
  },
  statTargetBadge: {
    backgroundColor: '#052e16', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#166534',
  },
  statTargetText: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  trainOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937',
    borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#374151',
  },
  trainOptTitle: { fontSize: 15, fontWeight: '700', color: '#f9fafb' },
  trainOptSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  hintBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1400',
    borderRadius: 8, borderWidth: 1, borderColor: '#a16207',
    padding: 10, marginBottom: 12, gap: 8,
  },
  hintBannerIcon: { fontSize: 16 },
  hintBannerText: { flex: 1, fontSize: 12, color: '#fbbf24', fontWeight: '600', lineHeight: 16 },
  hintBannerBtn: {
    backgroundColor: '#422006', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#a16207',
  },
  hintBannerBtnText: { fontSize: 10, color: '#fbbf24', fontWeight: '700' },
});
