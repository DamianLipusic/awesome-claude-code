import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { CurrencyText } from '../../components/ui/CurrencyText';
import { formatCurrency } from '../../components/ui/CurrencyText';
import type { CriminalOperation, Employee, CrimeOpType } from '@economy-game/shared';
import { CRIME_OP_CONFIGS } from '@economy-game/shared';
import { useToast } from '../../components/Toast';

const OP_LABELS: Record<CrimeOpType, string> = {
  SMUGGLING: 'Smuggling',
  THEFT: 'Theft',
  EXTORTION: 'Extortion',
  FRAUD: 'Fraud',
  DRUG_TRADE: 'Drug Trade',
  BRIBERY: 'Bribery',
  SABOTAGE: 'Sabotage',
};

const OP_ICONS: Record<CrimeOpType, string> = {
  SMUGGLING: '🚢',
  THEFT: '🔓',
  EXTORTION: '💪',
  FRAUD: '📄',
  DRUG_TRADE: '💊',
  BRIBERY: '💰',
  SABOTAGE: '💥',
};

function riskColor(risk: number): string {
  if (risk >= 7) return '#ef4444';
  if (risk >= 4) return '#f97316';
  return '#22c55e';
}

function RiskDots({ risk, max = 10 }: { risk: number; max?: number }) {
  const color = riskColor(risk);
  return (
    <View style={styles.riskDots}>
      {Array.from({ length: max }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.riskDot,
            { backgroundColor: i < risk ? color : '#1f2937' },
          ]}
        />
      ))}
    </View>
  );
}

interface AvailableOp {
  op_type: CrimeOpType;
  available: boolean;
  disabled_reason?: string;
}

interface LaunchOpPayload {
  op_type: CrimeOpType;
  employees: string[];
}

function OpDetailModal({
  op,
  employees,
  onClose,
  onLaunch,
  isLaunching,
}: {
  op: AvailableOp | null;
  employees: Employee[];
  onClose: () => void;
  onLaunch: (payload: LaunchOpPayload) => void;
  isLaunching: boolean;
}) {
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  if (!op) return null;

  const config = CRIME_OP_CONFIGS[op.op_type];
  const color = riskColor(config.risk_level);
  const criminalEmployees = employees.filter((e) => e.criminal_capable);
  const canLaunch = selectedEmployees.length >= config.requires_criminal_employees;

  const toggleEmployee = (id: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  return (
    <Modal visible={op !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalIcon}>{OP_ICONS[op.op_type]}</Text>
              <Text style={styles.modalTitle}>{OP_LABELS[op.op_type]}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.opStats}>
              <View style={styles.opStat}>
                <Text style={styles.opStatLabel}>Risk Level</Text>
                <RiskDots risk={config.risk_level} />
              </View>
              <View style={styles.opStat}>
                <Text style={styles.opStatLabel}>Duration</Text>
                <Text style={styles.opStatValue}>{config.duration_hours}h</Text>
              </View>
              <View style={styles.opStat}>
                <Text style={styles.opStatLabel}>Est. Yield</Text>
                <Text style={[styles.opStatValue, { color: '#22c55e' }]}>
                  {formatCurrency(config.base_yield * 0.75)}–{formatCurrency(config.base_yield * 1.25)}
                </Text>
              </View>
              <View style={styles.opStat}>
                <Text style={styles.opStatLabel}>Crew Required</Text>
                <Text style={styles.opStatValue}>{config.requires_criminal_employees}</Text>
              </View>
            </View>

            {config.requires_criminal_employees > 0 && (
              <View style={styles.employeeSection}>
                <Text style={styles.sectionLabel}>Assign Crew</Text>
                {criminalEmployees.length === 0 ? (
                  <Text style={styles.noCrewText}>
                    No criminal-capable employees available. Hire Enforcers or Drivers.
                  </Text>
                ) : (
                  criminalEmployees.map((emp) => (
                    <TouchableOpacity
                      key={emp.id}
                      style={[
                        styles.employeeRow,
                        selectedEmployees.includes(emp.id) && styles.employeeRowSelected,
                      ]}
                      onPress={() => toggleEmployee(emp.id)}
                    >
                      <View style={styles.empCheckbox}>
                        {selectedEmployees.includes(emp.id) && (
                          <Text style={styles.checkmark}>✓</Text>
                        )}
                      </View>
                      <View style={styles.empInfo}>
                        <Text style={styles.empName}>{emp.name}</Text>
                        <Text style={styles.empRole}>{emp.role}</Text>
                      </View>
                      <Text style={styles.empEfficiency}>
                        {Math.round(emp.efficiency * 100)}% efficiency
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {!canLaunch && config.requires_criminal_employees > 0 && (
              <View style={[styles.riskWarning, { borderColor: color, backgroundColor: color + '15' }]}>
                <Text style={[styles.riskWarningText, { color }]}>
                  Assign at least {config.requires_criminal_employees} crew member
                  {config.requires_criminal_employees !== 1 ? 's' : ''} to proceed.
                </Text>
              </View>
            )}

            {config.risk_level >= 7 && (
              <View style={styles.highRiskWarning}>
                <Text style={styles.highRiskText}>
                  🚨 HIGH RISK — Chance of being busted is significant. Ensure your heat is manageable.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.launchButton,
                { backgroundColor: color },
                (!canLaunch || isLaunching) && styles.launchButtonDisabled,
              ]}
              onPress={() => onLaunch({ op_type: op.op_type, employees: selectedEmployees })}
              disabled={!canLaunch || isLaunching}
            >
              <Text style={styles.launchButtonText}>
                {isLaunching ? 'Launching...' : `🎯 Launch ${OP_LABELS[op.op_type]}`}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function HistoryRow({ op }: { op: CriminalOperation }) {
  const isBusted = op.status === 'BUSTED';
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyLeft}>
        <Text style={styles.historyOpType}>{OP_LABELS[op.op_type]}</Text>
        <Text style={styles.historyDate}>
          {new Date(op.started_at).toLocaleDateString()}
        </Text>
      </View>
      {isBusted ? (
        <Badge label="BUSTED" variant="red" size="sm" />
      ) : (
        <CurrencyText amount={op.dirty_money_yield} variant="dirty" size="sm" />
      )}
    </View>
  );
}

const ALL_OP_TYPES = Object.keys(CRIME_OP_CONFIGS) as CrimeOpType[];

export function CrimeOperationsScreen() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selectedOp, setSelectedOp] = useState<AvailableOp | null>(null);

  const { data: available, isLoading } = useQuery<AvailableOp[]>({
    queryKey: ['crime', 'available-ops'],
    queryFn: async () => {
      const res = await api.get<{ heat_level: string; operations: Array<{ op_type: CrimeOpType; can_perform: boolean; [key: string]: unknown }> }>('/crime/operations/available');
      return res.operations.map(op => ({
        op_type: op.op_type,
        available: op.can_perform,
      }));
    },
    staleTime: 30_000,
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['crime', 'criminal-employees'],
    queryFn: () => api.get<Employee[]>('/employees/available'),
    staleTime: 60_000,
  });

  const { data: history } = useQuery<CriminalOperation[]>({
    queryKey: ['crime', 'history'],
    queryFn: () => api.get<CriminalOperation[]>('/crime/operations/active'),
    staleTime: 60_000,
  });

  const launchMutation = useMutation({
    mutationFn: (payload: LaunchOpPayload) =>
      api.post<CriminalOperation>('/crime/operations', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crime-hub'] });
      queryClient.invalidateQueries({ queryKey: ['crime', 'available-ops'] });
      queryClient.invalidateQueries({ queryKey: ['crime', 'history'] });
      setSelectedOp(null);
      toast.show('Operation launched! Your crew is on the move.', 'success');
    },
    onError: (err) => {
      toast.show(err instanceof Error ? err.message : 'Could not launch operation', 'error');
    },
  });

  const ops: AvailableOp[] = available ?? ALL_OP_TYPES.map((t) => ({ op_type: t, available: true }));

  return (
    <View style={styles.screen}>
      <FlatList
        data={ops}
        keyExtractor={(item) => item.op_type}
        renderItem={({ item }) => {
          const config = CRIME_OP_CONFIGS[item.op_type];
          const color = riskColor(config.risk_level);
          const isDisabled = !item.available;

          return (
            <TouchableOpacity
              style={[styles.opCard, isDisabled && styles.opCardDisabled]}
              onPress={() => !isDisabled && setSelectedOp(item)}
              disabled={isDisabled}
              activeOpacity={0.8}
            >
              <View style={styles.opCardHeader}>
                <Text style={styles.opIcon}>{OP_ICONS[item.op_type]}</Text>
                <View style={styles.opCardInfo}>
                  <Text style={[styles.opCardName, isDisabled && styles.textMuted]}>
                    {OP_LABELS[item.op_type]}
                  </Text>
                  <RiskDots risk={config.risk_level} />
                  {item.disabled_reason && (
                    <Text style={styles.disabledReason}>{item.disabled_reason}</Text>
                  )}
                </View>
                <View style={styles.opCardRight}>
                  <Text style={[styles.opYield, { color: isDisabled ? '#6b7280' : '#22c55e' }]}>
                    ~{formatCurrency(config.base_yield)}
                  </Text>
                  <Text style={styles.opDuration}>{config.duration_hours}h</Text>
                  <Text style={styles.opCrew}>
                    {config.requires_criminal_employees > 0
                      ? `${config.requires_criminal_employees} crew`
                      : 'Solo'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          isLoading ? <LoadingSkeleton rows={5} /> : null
        }
        ListFooterComponent={
          (history ?? []).length > 0 ? (
            <Card style={styles.historyCard}>
              <Text style={styles.historyTitle}>Recent Operations</Text>
              {(history ?? []).map((op) => (
                <HistoryRow key={op.id} op={op} />
              ))}
            </Card>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <OpDetailModal
        op={selectedOp}
        employees={employees ?? []}
        onClose={() => setSelectedOp(null)}
        onLaunch={(payload) => launchMutation.mutate(payload)}
        isLaunching={launchMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  listContent: { padding: 12, paddingBottom: 32 },
  separator: { height: 8 },

  opCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  opCardDisabled: { opacity: 0.45 },
  opCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  opIcon: { fontSize: 28, width: 36, textAlign: 'center' },
  opCardInfo: { flex: 1 },
  opCardName: { fontSize: 15, fontWeight: '700', color: '#f9fafb', marginBottom: 4 },
  textMuted: { color: '#6b7280' },
  disabledReason: { fontSize: 11, color: '#f97316', marginTop: 4 },
  opCardRight: { alignItems: 'flex-end' },
  opYield: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  opDuration: { fontSize: 11, color: '#6b7280' },
  opCrew: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  riskDots: { flexDirection: 'row', gap: 3 },
  riskDot: { width: 6, height: 6, borderRadius: 3 },

  historyCard: { marginTop: 16 },
  historyTitle: { fontSize: 14, fontWeight: '700', color: '#9ca3af', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  historyLeft: {},
  historyOpType: { fontSize: 13, color: '#d1d5db', fontWeight: '600' },
  historyDate: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#1f2937',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIcon: { fontSize: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#f9fafb' },
  closeBtn: { fontSize: 18, color: '#6b7280', padding: 4 },

  opStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  opStat: { flex: 1, minWidth: '45%', backgroundColor: '#030712', borderRadius: 8, padding: 10 },
  opStatLabel: { fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  opStatValue: { fontSize: 14, fontWeight: '700', color: '#d1d5db' },

  sectionLabel: { fontSize: 12, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, fontWeight: '600' },
  employeeSection: { marginBottom: 12 },
  noCrewText: { fontSize: 13, color: '#6b7280', fontStyle: 'italic' },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 6,
  },
  employeeRowSelected: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  empCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#22c55e', fontWeight: '700', fontSize: 12 },
  empInfo: { flex: 1 },
  empName: { fontSize: 13, color: '#f9fafb', fontWeight: '600' },
  empRole: { fontSize: 11, color: '#6b7280' },
  empEfficiency: { fontSize: 12, color: '#9ca3af' },

  riskWarning: { borderRadius: 8, borderWidth: 1, padding: 10, marginBottom: 12 },
  riskWarningText: { fontSize: 12, fontWeight: '600' },
  highRiskWarning: { backgroundColor: '#450a0a', borderRadius: 8, padding: 10, marginBottom: 12 },
  highRiskText: { fontSize: 12, color: '#ef4444', fontWeight: '600', lineHeight: 18 },

  launchButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  launchButtonDisabled: { opacity: 0.45 },
  launchButtonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
