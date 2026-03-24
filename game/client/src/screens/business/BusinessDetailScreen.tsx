import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { StatBar } from '../../components/ui/StatBar';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { formatCurrency } from '../../components/ui/CurrencyText';
import type { Business, Employee } from '@economy-game/shared';
import type { BusinessStackParamList } from './BusinessHubScreen';

type NavProp = StackNavigationProp<BusinessStackParamList, 'BusinessDetail'>;
type RoutePropType = RouteProp<BusinessStackParamList, 'BusinessDetail'>;

type Tab = 'overview' | 'employees' | 'upgrade' | 'operations';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'employees', label: 'Employees' },
  { key: 'upgrade', label: 'Upgrade' },
  { key: 'operations', label: 'Operations' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Overview Tab ─────────────────────────────────────────────

interface RevenueData {
  dates: string[];
  revenues: number[];
  expenses: number[];
}

function OverviewTab({ business }: { business: Business }) {
  const { data: revenueData } = useQuery<RevenueData>({
    queryKey: ['business', business.id, 'revenue'],
    queryFn: () => api.get<RevenueData>(`/businesses/${business.id}/revenue?days=7`),
    staleTime: 60_000,
  });

  const capacityPercent = Math.round((business.capacity / business.storage_cap) * 100);
  const dailyPnl = business.total_revenue - business.total_expenses;

  const inventoryEntries = Object.entries(business.inventory).filter(([, qty]) => qty > 0);

  const chartData = revenueData
    ? {
        labels: revenueData.dates.map((d) => {
          const date = new Date(d);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        }),
        datasets: [
          {
            data: revenueData.revenues.map((v) => v / 1000),
            color: () => '#22c55e',
          },
        ],
      }
    : null;

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Status */}
      <Card style={styles.section}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  business.status === 'ACTIVE'
                    ? '#22c55e'
                    : business.status === 'RAIDED'
                    ? '#ef4444'
                    : '#6b7280',
              },
            ]}
          />
          <StatusBadge status={business.status} />
          <Text style={styles.cityText}>{business.city}</Text>
        </View>
      </Card>

      {/* Capacity & Efficiency */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Capacity & Performance</Text>
        <StatBar label="Storage Capacity" value={capacityPercent} color="#3b82f6" />
        <StatBar label="Efficiency" value={business.efficiency * 100} color="#22c55e" />
        {business.suspicion_level > 0 && (
          <StatBar label="Suspicion Level" value={business.suspicion_level} color="#ef4444" />
        )}
      </Card>

      {/* Daily P&L */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Daily P&L</Text>
        <Text style={[styles.pnlValue, { color: dailyPnl >= 0 ? '#22c55e' : '#ef4444' }]}>
          {dailyPnl >= 0 ? '+' : ''}{formatCurrency(dailyPnl)}
        </Text>
        <View style={styles.pnlDetails}>
          <View>
            <Text style={styles.pnlLabel}>Revenue</Text>
            <Text style={styles.pnlGreen}>{formatCurrency(business.total_revenue)}</Text>
          </View>
          <View>
            <Text style={styles.pnlLabel}>Expenses</Text>
            <Text style={styles.pnlRed}>{formatCurrency(business.total_expenses)}</Text>
          </View>
          <View>
            <Text style={styles.pnlLabel}>Daily Cost</Text>
            <Text style={styles.pnlRed}>{formatCurrency(business.daily_operating_cost)}</Text>
          </View>
        </View>
      </Card>

      {/* 7-day revenue chart */}
      {chartData && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>7-Day Revenue (K)</Text>
          <BarChart
            data={chartData}
            width={SCREEN_WIDTH - 64}
            height={160}
            yAxisLabel="$"
            yAxisSuffix="K"
            chartConfig={{
              backgroundColor: '#111827',
              backgroundGradientFrom: '#111827',
              backgroundGradientTo: '#111827',
              decimalPlaces: 1,
              color: () => '#22c55e',
              labelColor: () => '#6b7280',
              style: { borderRadius: 8 },
            }}
            style={{ borderRadius: 8 }}
            showValuesOnTopOfBars
          />
        </Card>
      )}

      {/* Inventory */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Inventory</Text>
        {inventoryEntries.length === 0 ? (
          <Text style={styles.emptyText}>No items in inventory</Text>
        ) : (
          inventoryEntries.map(([resourceId, qty]) => (
            <View key={resourceId} style={styles.inventoryRow}>
              <Text style={styles.inventoryResource}>{resourceId}</Text>
              <Text style={styles.inventoryQty}>{qty.toLocaleString()}</Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

// ─── Employees Tab ────────────────────────────────────────────

function EmployeeModal({
  employee,
  visible,
  onClose,
  onFire,
}: {
  employee: Employee | null;
  visible: boolean;
  onClose: () => void;
  onFire: (id: string) => void;
}) {
  if (!employee) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{employee.name}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Badge label={employee.role} variant="blue" size="md" />

          <View style={styles.employeeStatsGrid}>
            <StatBar label="Efficiency" value={employee.efficiency} color="#22c55e" />
            <StatBar label="Loyalty" value={employee.loyalty} color="#3b82f6" />
            <StatBar label="Reliability" value={employee.reliability} color="#22c55e" />
            <StatBar label="Speed" value={employee.speed} color="#f97316" />
            <StatBar label="Morale" value={employee.morale} color="#a855f7" />
            <StatBar label="Corruption Risk" value={employee.corruption_risk} color="#ef4444" />
          </View>

          <Card style={styles.employeeSalaryCard}>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Daily Salary</Text>
              <Text style={styles.salaryValue}>{formatCurrency(employee.salary)}/day</Text>
            </View>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Experience</Text>
              <Text style={styles.salaryValue}>{employee.experience_points} XP</Text>
            </View>
            {employee.criminal_capable && (
              <View style={styles.criminalCapable}>
                <Text style={styles.criminalCapableText}>⚡ Criminal Operations Capable</Text>
              </View>
            )}
          </Card>

          <TouchableOpacity
            style={styles.fireButton}
            onPress={() => onFire(employee.id)}
          >
            <Text style={styles.fireButtonText}>🔴 Terminate Employee</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function EmployeesTab({ business }: { business: Business }) {
  const navigation = useNavigation<NavProp>();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [fireConfirmVisible, setFireConfirmVisible] = useState(false);
  const [pendingFireId, setPendingFireId] = useState<string | null>(null);

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ['business', business.id, 'employees'],
    queryFn: () => api.get<Employee[]>(`/businesses/${business.id}/employees`),
  });

  const fireMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/businesses/${business.id}/employees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', business.id, 'employees'] });
      setSelectedEmployee(null);
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to terminate employee');
    },
  });

  const handleFireRequest = (id: string) => {
    setPendingFireId(id);
    setFireConfirmVisible(true);
    setSelectedEmployee(null);
  };

  const handleFireConfirm = () => {
    if (pendingFireId) {
      fireMutation.mutate(pendingFireId);
    }
    setFireConfirmVisible(false);
    setPendingFireId(null);
  };

  if (isLoading) return <LoadingScreen fullscreen={false} message="Loading employees..." />;

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <TouchableOpacity
        style={styles.hireButton}
        onPress={() => navigation.navigate('EmployeeMarket', { businessId: business.id })}
      >
        <Text style={styles.hireButtonText}>👷 Hire Employee</Text>
      </TouchableOpacity>

      {(employees ?? []).length === 0 ? (
        <EmptyState icon="👷" title="No employees" subtitle="Hire staff to improve efficiency" />
      ) : (
        (employees ?? []).map((emp) => (
          <TouchableOpacity
            key={emp.id}
            style={styles.employeeCard}
            onPress={() => setSelectedEmployee(emp)}
            activeOpacity={0.8}
          >
            <View style={styles.employeeCardHeader}>
              <View>
                <Text style={styles.employeeName}>{emp.name}</Text>
                <Badge label={emp.role} variant="blue" />
              </View>
              <Text style={styles.employeeSalary}>{formatCurrency(emp.salary)}/day</Text>
            </View>
            <View style={styles.employeeStatsMini}>
              <StatBar label="Efficiency" value={emp.efficiency} showValue={false} color="#22c55e" />
              <StatBar label="Loyalty" value={emp.loyalty} showValue={false} color="#3b82f6" />
            </View>
            <View style={styles.moraleRow}>
              <Text style={styles.moraleLabel}>Morale:</Text>
              <Text
                style={[
                  styles.moraleValue,
                  {
                    color:
                      emp.morale > 70
                        ? '#22c55e'
                        : emp.morale > 40
                        ? '#f97316'
                        : '#ef4444',
                  },
                ]}
              >
                {emp.morale > 70 ? '😊' : emp.morale > 40 ? '😐' : '😤'} {emp.morale}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}

      <EmployeeModal
        employee={selectedEmployee}
        visible={selectedEmployee !== null}
        onClose={() => setSelectedEmployee(null)}
        onFire={handleFireRequest}
      />

      <ConfirmModal
        visible={fireConfirmVisible}
        title="Terminate Employee"
        message="Are you sure you want to fire this employee? This action cannot be undone and may affect morale."
        confirmLabel="Terminate"
        confirmVariant="danger"
        onConfirm={handleFireConfirm}
        onCancel={() => setFireConfirmVisible(false)}
        isLoading={fireMutation.isPending}
      />
    </ScrollView>
  );
}

// ─── Upgrade Tab ──────────────────────────────────────────────

interface UpgradeInfo {
  current_tier: number;
  next_tier: number | null;
  upgrade_cost: number;
  capacity_increase: number;
  efficiency_boost: number;
}

function UpgradeTab({ business }: { business: Business }) {
  const queryClient = useQueryClient();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const { data: upgradeInfo } = useQuery<UpgradeInfo>({
    queryKey: ['business', business.id, 'upgrade'],
    queryFn: () => api.get<UpgradeInfo>(`/businesses/${business.id}/upgrade-info`),
  });

  const upgradeMutation = useMutation({
    mutationFn: () => api.post(`/businesses/${business.id}/upgrade`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business', business.id] });
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
      setConfirmVisible(false);
    },
    onError: (err) => {
      Alert.alert('Upgrade Failed', err instanceof Error ? err.message : 'Failed to upgrade');
      setConfirmVisible(false);
    },
  });

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Current Tier</Text>
        <Text style={styles.tierDisplay}>Tier {business.tier}</Text>
      </Card>

      {upgradeInfo?.next_tier ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Next Upgrade: Tier {upgradeInfo.next_tier}</Text>
          <View style={styles.upgradeDetails}>
            <View style={styles.upgradeStat}>
              <Text style={styles.upgradeStatLabel}>Upgrade Cost</Text>
              <Text style={styles.upgradeStatValue}>{formatCurrency(upgradeInfo.upgrade_cost)}</Text>
            </View>
            <View style={styles.upgradeStat}>
              <Text style={styles.upgradeStatLabel}>Capacity +</Text>
              <Text style={[styles.upgradeStatValue, { color: '#3b82f6' }]}>
                +{upgradeInfo.capacity_increase.toLocaleString()}
              </Text>
            </View>
            <View style={styles.upgradeStat}>
              <Text style={styles.upgradeStatLabel}>Efficiency +</Text>
              <Text style={[styles.upgradeStatValue, { color: '#22c55e' }]}>
                +{Math.round(upgradeInfo.efficiency_boost * 100)}%
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.upgradeBtn}
            onPress={() => setConfirmVisible(true)}
          >
            <Text style={styles.upgradeBtnText}>
              Upgrade to Tier {upgradeInfo.next_tier}
            </Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <EmptyState icon="🏆" title="Max tier reached" subtitle="This business is fully upgraded" />
      )}

      <ConfirmModal
        visible={confirmVisible}
        title="Confirm Upgrade"
        message={`Upgrade to Tier ${upgradeInfo?.next_tier} for ${
          upgradeInfo ? formatCurrency(upgradeInfo.upgrade_cost) : '...'
        }?`}
        confirmLabel="Upgrade"
        onConfirm={() => upgradeMutation.mutate()}
        onCancel={() => setConfirmVisible(false)}
        isLoading={upgradeMutation.isPending}
      />
    </ScrollView>
  );
}

// ─── Operations Tab ───────────────────────────────────────────

interface ProductionConfig {
  resource_id: string | null;
  quantity_per_tick: number;
  auto_sell: boolean;
  auto_sell_price: number | null;
}

interface Resource {
  id: string;
  name: string;
  category: string;
  tier: number;
  illegal: boolean;
}

function OperationsTab({ business }: { business: Business }) {
  const queryClient = useQueryClient();
  const [autoSell, setAutoSell] = useState(false);
  const [autoSellPrice, setAutoSellPrice] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [qtyPerTick, setQtyPerTick] = useState('10');

  const { data: config } = useQuery<ProductionConfig>({
    queryKey: ['business', business.id, 'config'],
    queryFn: () => api.get<ProductionConfig>(`/businesses/${business.id}/config`),
  });

  const { data: resources } = useQuery<Resource[]>({
    queryKey: ['market', 'resources'],
    queryFn: () => api.get<Resource[]>('/market/resources'),
    staleTime: 120_000,
  });

  // Sync config into local state when loaded
  React.useEffect(() => {
    if (config) {
      setAutoSell(config.auto_sell);
      setAutoSellPrice(config.auto_sell_price?.toString() ?? '');
      setSelectedResourceId(config.resource_id);
      setQtyPerTick(config.quantity_per_tick?.toString() ?? '10');
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<ProductionConfig>) =>
      api.put(`/businesses/${business.id}/config`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', business.id, 'config'] });
      Alert.alert('Saved', 'Production configuration updated.');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Save failed');
    },
  });

  const produceMutation = useMutation({
    mutationFn: () => api.post(`/businesses/${business.id}/produce`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', business.id] });
      Alert.alert('Done', 'Manual production tick triggered.');
    },
    onError: (err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'Production failed');
    },
  });

  const currentResourceName = resources?.find((r) => r.id === selectedResourceId)?.name;

  const grouped: Record<string, Resource[]> = {};
  for (const r of resources ?? []) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Resource picker */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Production Resource</Text>
        <Text style={styles.helperText}>What does this business produce each tick?</Text>
        {Object.entries(grouped).map(([cat, items]) => (
          <View key={cat}>
            <Text style={styles.categoryLabel}>{cat}</Text>
            <View style={styles.resourceGrid}>
              {items.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.resourceChip,
                    selectedResourceId === r.id && styles.resourceChipSelected,
                  ]}
                  onPress={() => setSelectedResourceId(r.id)}
                >
                  <Text style={[
                    styles.resourceChipText,
                    selectedResourceId === r.id && styles.resourceChipTextSelected,
                  ]}>
                    {r.illegal ? '🔴 ' : ''}{r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {currentResourceName && (
          <Text style={[styles.helperText, { marginTop: 8 }]}>
            Selected: <Text style={styles.accent}>{currentResourceName}</Text>
          </Text>
        )}
      </Card>

      {/* Qty per tick */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Output per Tick</Text>
        <Text style={styles.inputLabel}>Units produced per production tick</Text>
        <TextInput
          style={styles.configInput}
          value={qtyPerTick}
          onChangeText={setQtyPerTick}
          keyboardType="numeric"
          placeholder="10"
          placeholderTextColor="#4b5563"
        />
      </Card>

      {/* Auto-sell */}
      <Card style={styles.section}>
        <View style={styles.optionRow}>
          <View>
            <Text style={styles.optionTitle}>Auto-Sell</Text>
            <Text style={styles.optionDesc}>
              Automatically list produced goods on the market
            </Text>
          </View>
          <Switch
            value={autoSell}
            onValueChange={setAutoSell}
            trackColor={{ false: '#1f2937', true: '#166534' }}
            thumbColor={autoSell ? '#22c55e' : '#6b7280'}
          />
        </View>

        {autoSell && (
          <>
            <Text style={styles.inputLabel}>Auto-sell price per unit ($)</Text>
            <TextInput
              style={styles.configInput}
              value={autoSellPrice}
              onChangeText={setAutoSellPrice}
              keyboardType="decimal-pad"
              placeholder="e.g. 100.00"
              placeholderTextColor="#4b5563"
            />
          </>
        )}
      </Card>

      <TouchableOpacity
        style={styles.saveBtn}
        onPress={() =>
          saveMutation.mutate({
            resource_id: selectedResourceId,
            quantity_per_tick: parseInt(qtyPerTick, 10) || 10,
            auto_sell: autoSell,
            auto_sell_price: autoSell ? parseFloat(autoSellPrice) || null : null,
          })
        }
        disabled={saveMutation.isPending}
      >
        <Text style={styles.saveBtnText}>
          {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.saveBtn, { backgroundColor: '#374151', marginTop: 8 }]}
        onPress={() => produceMutation.mutate()}
        disabled={produceMutation.isPending}
      >
        <Text style={styles.saveBtnText}>
          {produceMutation.isPending ? 'Producing...' : '⚡ Trigger Production Now'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Main BusinessDetailScreen ────────────────────────────────

export function BusinessDetailScreen() {
  const route = useRoute<RoutePropType>();
  const { businessId } = route.params;
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: business, isLoading } = useQuery<Business>({
    queryKey: ['business', businessId],
    queryFn: () => api.get<Business>(`/businesses/${businessId}`),
    staleTime: 15_000,
  });

  if (isLoading || !business) {
    return <LoadingScreen message="Loading business..." />;
  }

  return (
    <View style={styles.screen}>
      {/* Business header */}
      <View style={styles.businessHeader}>
        <Text style={styles.businessHeaderName} numberOfLines={1}>
          {business.name}
        </Text>
        <StatusBadge status={business.status} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[
                styles.tabItemText,
                activeTab === tab.key && styles.tabItemTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab business={business} />}
      {activeTab === 'employees' && <EmployeesTab business={business} />}
      {activeTab === 'upgrade' && <UpgradeTab business={business} />}
      {activeTab === 'operations' && <OperationsTab business={business} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  businessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  businessHeaderName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
    flex: 1,
    marginRight: 8,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    backgroundColor: '#0a0f1a',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#22c55e',
  },
  tabItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  tabItemTextActive: {
    color: '#22c55e',
  },
  tabContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  section: { marginBottom: 0 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cityText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  pnlValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  pnlDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pnlLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  pnlGreen: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22c55e',
  },
  pnlRed: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },
  inventoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  inventoryResource: {
    fontSize: 13,
    color: '#d1d5db',
  },
  inventoryQty: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f9fafb',
  },
  emptyText: {
    color: '#4b5563',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  hireButton: {
    backgroundColor: '#0c1a2e',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  hireButtonText: {
    color: '#3b82f6',
    fontSize: 15,
    fontWeight: '700',
  },
  employeeCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    marginBottom: 10,
  },
  employeeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 4,
  },
  employeeSalary: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f97316',
  },
  employeeStatsMini: {
    gap: 4,
    marginBottom: 6,
  },
  moraleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  moraleLabel: {
    fontSize: 11,
    color: '#6b7280',
  },
  moraleValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#030712',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f9fafb',
  },
  modalClose: {
    fontSize: 18,
    color: '#6b7280',
    padding: 4,
  },
  modalContent: {
    padding: 20,
    gap: 16,
  },
  employeeStatsGrid: {
    gap: 8,
  },
  employeeSalaryCard: {
    gap: 8,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  salaryLabel: {
    fontSize: 13,
    color: '#9ca3af',
  },
  salaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f9fafb',
  },
  criminalCapable: {
    backgroundColor: '#450a0a',
    borderRadius: 6,
    padding: 8,
  },
  criminalCapableText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  fireButton: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  fireButtonText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
  tierDisplay: {
    fontSize: 32,
    fontWeight: '800',
    color: '#f9fafb',
  },
  upgradeDetails: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  upgradeStat: {
    flex: 1,
    backgroundColor: '#030712',
    borderRadius: 8,
    padding: 10,
  },
  upgradeStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  upgradeStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },
  upgradeBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  upgradeBtnText: {
    color: '#030712',
    fontSize: 15,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f9fafb',
  },
  optionDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    maxWidth: 220,
  },
  inputLabel: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 6,
    marginTop: 6,
  },
  configInput: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#f9fafb',
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
  },
  accent: {
    color: '#22c55e',
    fontWeight: '600',
  },
  categoryLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  resourceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  resourceChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#030712',
  },
  resourceChipSelected: {
    borderColor: '#22c55e',
    backgroundColor: '#052e16',
  },
  resourceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
  },
  resourceChipTextSelected: {
    color: '#22c55e',
  },
});
