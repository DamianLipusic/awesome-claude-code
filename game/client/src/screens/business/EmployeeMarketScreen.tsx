import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
// Slider replaced with step buttons to avoid extra dependency
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { StatBar } from '../../components/ui/StatBar';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { formatCurrency } from '../../components/ui/CurrencyText';
import type { Employee, EmployeeRole } from '@economy-game/shared';
import type { BusinessStackParamList } from './BusinessHubScreen';

type RoutePropType = RouteProp<BusinessStackParamList, 'EmployeeMarket'>;

const ROLES: Array<{ label: string; value: EmployeeRole | 'ALL' }> = [
  { label: 'All Roles', value: 'ALL' },
  { label: 'Worker', value: 'WORKER' },
  { label: 'Manager', value: 'MANAGER' },
  { label: 'Security', value: 'SECURITY' },
  { label: 'Driver', value: 'DRIVER' },
  { label: 'Enforcer', value: 'ENFORCER' },
  { label: 'Accountant', value: 'ACCOUNTANT' },
];

const ROLE_BADGE_VARIANTS: Record<EmployeeRole, 'blue' | 'green' | 'red' | 'orange' | 'purple' | 'gray'> = {
  WORKER: 'gray',
  MANAGER: 'blue',
  SECURITY: 'green',
  DRIVER: 'orange',
  ENFORCER: 'red',
  ACCOUNTANT: 'purple',
};

// Hiring cost = salary * 7 (one week advance)
function calcHiringCost(salary: number): number {
  return salary * 7;
}

interface AvailableEmployee extends Employee {
  hire_cost: number;
}

export function EmployeeMarketScreen() {
  const route = useRoute<RoutePropType>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { businessId } = route.params;

  const [selectedRole, setSelectedRole] = useState<EmployeeRole | 'ALL'>('ALL');
  const [minEfficiency, setMinEfficiency] = useState(0);
  const [maxSalary, setMaxSalary] = useState(1000);
  const [pendingHire, setPendingHire] = useState<AvailableEmployee | null>(null);

  const { data: available, isLoading, refetch, isRefetching } = useQuery<AvailableEmployee[]>({
    queryKey: ['employee-market', selectedRole, minEfficiency, maxSalary],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedRole !== 'ALL') params.set('role', selectedRole);
      params.set('min_efficiency', String(minEfficiency));
      params.set('max_salary', String(maxSalary));
      const res = await api.get<{ employees: AvailableEmployee[]; hiring_cost: number }>('/employees/available?' + params.toString());
      return res?.employees ?? [];
    },
    staleTime: 30_000,
  });

  const hireMutation = useMutation({
    mutationFn: ({ employeeId }: { employeeId: string }) =>
      api.post(`/employees/hire`, { business_id: businessId, employee_id: employeeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', businessId, 'employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-market'] });
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
      setPendingHire(null);
      Alert.alert('Hired!', 'Employee has been added to your business.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    },
    onError: (err) => {
      Alert.alert('Hire Failed', err instanceof Error ? err.message : 'Failed to hire');
      setPendingHire(null);
    },
  });

  const filteredEmployees = (available ?? []).filter((e) => {
    if (selectedRole !== 'ALL' && e.role !== selectedRole) return false;
    if (e.efficiency < minEfficiency) return false;
    if (e.salary > maxSalary) return false;
    return true;
  });

  const renderEmployee = useCallback(
    ({ item }: { item: AvailableEmployee }) => {
      const badgeVariant = ROLE_BADGE_VARIANTS[item.role] ?? 'gray';
      const hiringCost = calcHiringCost(item.salary);

      return (
        <View style={styles.employeeCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.employeeName}>{item.name}</Text>
              <Badge label={item.role} variant={badgeVariant} />
            </View>
            <View style={styles.salaryInfo}>
              <Text style={styles.salary}>{formatCurrency(item.salary)}</Text>
              <Text style={styles.salaryLabel}>/day</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <StatBar label="Efficiency" value={item.efficiency} color="#22c55e" showValue />
            <StatBar label="Reliability" value={item.reliability} color="#3b82f6" showValue />
            <StatBar label="Loyalty" value={item.loyalty} color="#a855f7" showValue />
            <StatBar label="Speed" value={item.speed} color="#f97316" showValue />
            <StatBar
              label="Corruption Risk"
              value={item.corruption_risk}
              color="#ef4444"
              showValue
            />
          </View>

          {item.criminal_capable && (
            <View style={styles.criminalTag}>
              <Text style={styles.criminalTagText}>⚡ Criminal capable</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.hireButton}
            onPress={() => setPendingHire(item)}
          >
            <Text style={styles.hireButtonText}>
              Hire — {formatCurrency(hiringCost)} upfront
            </Text>
          </TouchableOpacity>
        </View>
      );
    },
    []
  );

  return (
    <View style={styles.screen}>
      {/* Filters */}
      <View style={styles.filtersContainer}>
        {/* Role filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Role</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={ROLES}
            keyExtractor={(r) => r.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.roleBtn,
                  selectedRole === item.value && styles.roleBtnActive,
                ]}
                onPress={() => setSelectedRole(item.value as EmployeeRole | 'ALL')}
              >
                <Text
                  style={[
                    styles.roleBtnText,
                    selectedRole === item.value && styles.roleBtnTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.roleList}
          />
        </View>

        {/* Min efficiency */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>
            Min Efficiency: <Text style={styles.filterValue}>{minEfficiency}</Text>
          </Text>
          <View style={styles.stepRow}>
            {[0, 25, 50, 70, 85].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.stepBtn, minEfficiency === v && styles.stepBtnActive]}
                onPress={() => setMinEfficiency(v)}
              >
                <Text style={[styles.stepBtnText, minEfficiency === v && styles.stepBtnTextActive]}>
                  {v}+
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Max salary */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>
            Max Salary:{' '}
            <Text style={styles.filterValue}>{formatCurrency(maxSalary)}/day</Text>
          </Text>
          <View style={styles.stepRow}>
            {[200, 500, 1000, 2000, 5000].map((v) => (
              <TouchableOpacity
                key={v}
                style={[styles.stepBtn, maxSalary === v && styles.stepBtnActive]}
                onPress={() => setMaxSalary(v)}
              >
                <Text style={[styles.stepBtnText, maxSalary === v && styles.stepBtnTextActive]}>
                  ≤${v}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Count */}
      {!isLoading && (
        <Text style={styles.countText}>{filteredEmployees.length} available</Text>
      )}

      {/* List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <LoadingSkeleton rows={4} />
        </View>
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          icon="👷"
          title="No employees match"
          subtitle="Try adjusting your filters"
        />
      ) : (
        <FlatList
          data={filteredEmployees}
          keyExtractor={(item) => item.id}
          renderItem={renderEmployee}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#22c55e"
            />
          }
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}

      <ConfirmModal
        visible={pendingHire !== null}
        title="Confirm Hire"
        message={
          pendingHire
            ? `Hire ${pendingHire.name} (${pendingHire.role}) for ${formatCurrency(
                calcHiringCost(pendingHire.salary)
              )} upfront + ${formatCurrency(pendingHire.salary)}/day?`
            : ''
        }
        confirmLabel="Hire"
        onConfirm={() => {
          if (pendingHire) {
            hireMutation.mutate({ employeeId: pendingHire.id });
          }
        }}
        onCancel={() => setPendingHire(null)}
        isLoading={hireMutation.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  filtersContainer: {
    backgroundColor: '#0a0f1a',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    paddingBottom: 12,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  filterValue: {
    color: '#f9fafb',
    textTransform: 'none',
  },
  stepRow: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  stepBtnActive: {
    backgroundColor: '#052e16',
    borderColor: '#22c55e',
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  stepBtnTextActive: {
    color: '#22c55e',
  },
  roleList: {
    gap: 6,
  },
  roleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
  },
  roleBtnActive: {
    backgroundColor: '#0c1a2e',
    borderColor: '#3b82f6',
  },
  roleBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleBtnTextActive: {
    color: '#3b82f6',
  },
  countText: {
    fontSize: 12,
    color: '#4b5563',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingContainer: { padding: 16 },
  listContent: {
    padding: 12,
    paddingBottom: 32,
  },
  employeeCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  salaryInfo: {
    alignItems: 'flex-end',
  },
  salary: {
    fontSize: 16,
    fontWeight: '800',
    color: '#f97316',
  },
  salaryLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  statsGrid: {
    gap: 6,
    marginBottom: 10,
  },
  criminalTag: {
    backgroundColor: '#450a0a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  criminalTagText: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
  },
  hireButton: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  hireButtonText: {
    color: '#030712',
    fontSize: 14,
    fontWeight: '700',
  },
});
