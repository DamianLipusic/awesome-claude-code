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
import { useToast } from '../../components/Toast';

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
const TIER_COLORS: Record<number, string> = { 1: '#666666', 2: '#4a9eff', 3: '#6c5ce7', 4: '#ffd700' };

// --- Overview Tab ---

interface RevenueData {
  dates: string[];
  revenues: number[];
  expenses: number[];
}

interface DistrictInfo {
  name: string;
  tier: number;
  revenue_multiplier: number;
  rent_multiplier: number;
  foot_traffic: number;
}

interface ManagerInfo {
  id: string;
  name: string;
  tier: number;
  efficiency_bonus: number;
  satisfaction_bonus: number;
}

interface ProductionChain {
  inputs: Array<{ resource_name: string; resource_icon: string; quantity: number }>;
  outputs: Array<{ resource_name: string; resource_icon: string; quantity: number }>;
}

function ManagerSection({ business }: { business: Business }) {
  const navigation = useNavigation<NavProp>();
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data: manager } = useQuery<ManagerInfo | null>({
    queryKey: ['business', business.id, 'manager'],
    queryFn: () => api.get<ManagerInfo | null>('/businesses/' + business.id + '/manager'),
    staleTime: 30_000,
  });

  const fireMutation = useMutation({
    mutationFn: () => api.delete('/businesses/' + business.id + '/manager'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', business.id] });
      toast.show('Manager fired.', 'success');
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Failed to fire manager', 'error'); },
  });

  const trainMutation = useMutation({
    mutationFn: () => api.post('/managers/train', { business_id: business.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business', business.id] });
      toast.show('Manager training started! Ready in 7 days.', 'success');
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Training failed', 'error'); },
  });

  const tierColor = manager ? (TIER_COLORS[manager.tier] ?? '#666') : '#666';

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Manager</Text>
      {manager ? (
        <View>
          <View style={styles.managerRow}>
            <View style={[styles.managerBadge, { borderColor: tierColor }]}>
              <Text style={[styles.managerTier, { color: tierColor }]}>T{manager.tier}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.managerName}>{manager.name}</Text>
              <View style={styles.managerStats}>
                <Text style={styles.managerStat}>Efficiency +{Math.round(manager.efficiency_bonus * 100)}%</Text>
                <Text style={styles.managerStat}>Satisfaction +{Math.round(manager.satisfaction_bonus * 100)}%</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.fireManagerBtn} onPress={() => fireMutation.mutate()} disabled={fireMutation.isPending}>
            <Text style={styles.fireManagerBtnText}>Fire Manager</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.noManagerBox}>
          <Text style={styles.noManagerText}>No manager assigned</Text>
          <View style={styles.managerBtnRow}>
            <TouchableOpacity style={styles.hireManagerBtn} onPress={() => navigation.navigate('ManagerMarket', { businessId: business.id })}>
              <Text style={styles.hireManagerBtnText}>Hire Manager</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.trainManagerBtn} onPress={() => trainMutation.mutate()} disabled={trainMutation.isPending}>
              <Text style={styles.trainManagerBtnText}>Train ($50k, 7d)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );
}

function DistrictInfoCard({ business }: { business: Business }) {
  const { data: district } = useQuery<DistrictInfo>({
    queryKey: ['business', business.id, 'district'],
    queryFn: () => api.get<DistrictInfo>('/businesses/' + business.id + '/district'),
    staleTime: 60_000,
  });

  if (!district) return null;
  const tierColor = TIER_COLORS[district.tier] ?? '#666';

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>District</Text>
      <View style={styles.districtHeader}>
        <Text style={styles.districtName}>{district.name}</Text>
        <Text style={[styles.districtTier, { color: tierColor }]}>T{district.tier}</Text>
      </View>
      <View style={styles.multiplierRow}>
        <View style={styles.multiplierItem}>
          <Text style={styles.multiplierLabel}>Revenue Mult.</Text>
          <Text style={[styles.multiplierValue, { color: '#00d2d3' }]}>{district.revenue_multiplier.toFixed(2)}x</Text>
        </View>
        <View style={styles.multiplierItem}>
          <Text style={styles.multiplierLabel}>Rent Mult.</Text>
          <Text style={[styles.multiplierValue, { color: '#ff6b6b' }]}>{district.rent_multiplier.toFixed(2)}x</Text>
        </View>
      </View>
      <View style={styles.footTrafficSection}>
        <Text style={styles.footTrafficLabel}>Foot Traffic</Text>
        <View style={styles.footBarTrack}>
          <View style={[styles.footBarFill, {
            width: `${Math.min(100, district.foot_traffic)}%` as `${number}%`,
            backgroundColor: district.foot_traffic > 70 ? '#00d2d3' : district.foot_traffic > 40 ? '#ffa502' : '#ff6b6b',
          }]} />
        </View>
        <Text style={styles.footBarValue}>{district.foot_traffic}%</Text>
      </View>
    </Card>
  );
}

function ProductionChainCard({ business }: { business: Business }) {
  const { data: chain } = useQuery<ProductionChain>({
    queryKey: ['business', business.id, 'production-chain'],
    queryFn: () => api.get<ProductionChain>('/businesses/' + business.id + '/production-chain'),
    staleTime: 120_000,
  });

  if (!chain || (chain.inputs.length === 0 && chain.outputs.length === 0)) return null;

  return (
    <Card style={styles.section}>
      <Text style={styles.sectionTitle}>Production Chain</Text>
      <View style={styles.chainContainer}>
        {/* Inputs */}
        <View style={styles.chainSide}>
          {chain.inputs.map((inp, i) => (
            <View key={i} style={styles.chainItem}>
              <Text style={styles.chainIcon}>{inp.resource_icon || '📦'}</Text>
              <Text style={styles.chainText}>{inp.resource_name} x{inp.quantity}</Text>
            </View>
          ))}
          {chain.inputs.length === 0 && <Text style={styles.chainMuted}>No inputs</Text>}
        </View>
        {/* Arrow */}
        <View style={styles.chainArrow}>
          <Text style={styles.chainArrowText}>→</Text>
        </View>
        {/* Outputs */}
        <View style={styles.chainSide}>
          {chain.outputs.map((out, i) => (
            <View key={i} style={styles.chainItem}>
              <Text style={styles.chainIcon}>{out.resource_icon || '📦'}</Text>
              <Text style={[styles.chainText, { color: '#00d2d3' }]}>{out.resource_name} x{out.quantity}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

function OverviewTab({ business }: { business: Business }) {
  const { data: revenueData } = useQuery<RevenueData>({
    queryKey: ['business', business.id, 'revenue'],
    queryFn: () => api.get<RevenueData>('/businesses/' + business.id + '/revenue?days=7'),
    staleTime: 60_000,
  });

  const capacityPercent = Math.round((business.capacity / business.storage_cap) * 100);
  const dailyPnl = business.total_revenue - business.total_expenses;

  const inventoryEntries = Object.entries(business.inventory).filter(([, qty]) => qty > 0);

  const chartData = revenueData
    ? {
        labels: revenueData.dates.map((d) => {
          const date = new Date(d);
          return (date.getMonth() + 1) + '/' + date.getDate();
        }),
        datasets: [{ data: revenueData.revenues.map((v) => v / 1000), color: () => '#00d2d3' }],
      }
    : null;

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      {/* Status */}
      <Card style={styles.section}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: business.status === 'ACTIVE' ? '#00d2d3' : business.status === 'RAIDED' ? '#ff6b6b' : '#a0a0b0' }]} />
          <StatusBadge status={business.status} />
          <Text style={styles.cityText}>{business.city}</Text>
        </View>
      </Card>

      {/* Manager Section */}
      <ManagerSection business={business} />

      {/* District Info */}
      <DistrictInfoCard business={business} />

      {/* Production Chain */}
      <ProductionChainCard business={business} />

      {/* Capacity & Efficiency */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Capacity & Performance</Text>
        <StatBar label="Storage Capacity" value={capacityPercent} color="#4a9eff" />
        <StatBar label="Efficiency" value={business.efficiency * 100} color="#00d2d3" />
        {business.suspicion_level > 0 && (
          <StatBar label="Suspicion Level" value={business.suspicion_level} color="#ff6b6b" />
        )}
      </Card>

      {/* Daily P&L */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Daily P&L</Text>
        <Text style={[styles.pnlValue, { color: dailyPnl >= 0 ? '#00d2d3' : '#ff6b6b' }]}>
          {dailyPnl >= 0 ? '+' : ''}{formatCurrency(dailyPnl)}
        </Text>
        <View style={styles.pnlDetails}>
          <View><Text style={styles.pnlLabel}>Revenue</Text><Text style={styles.pnlGreen}>{formatCurrency(business.total_revenue)}</Text></View>
          <View><Text style={styles.pnlLabel}>Expenses</Text><Text style={styles.pnlRed}>{formatCurrency(business.total_expenses)}</Text></View>
          <View><Text style={styles.pnlLabel}>Daily Cost</Text><Text style={styles.pnlRed}>{formatCurrency(business.daily_operating_cost)}</Text></View>
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
              backgroundColor: '#1a1a2e', backgroundGradientFrom: '#1a1a2e', backgroundGradientTo: '#1a1a2e',
              decimalPlaces: 1, color: () => '#00d2d3', labelColor: () => '#a0a0b0',
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

// --- Employees Tab ---

function EmployeeModal({ employee, visible, onClose, onFire }: { employee: Employee | null; visible: boolean; onClose: () => void; onFire: (id: string) => void }) {
  if (!employee) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.modalScreen}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{employee.name}</Text>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalContent}>
          <Badge label={employee.role} variant="blue" size="md" />
          <View style={styles.employeeStatsGrid}>
            <StatBar label="Efficiency" value={employee.efficiency} color="#00d2d3" />
            <StatBar label="Loyalty" value={employee.loyalty} color="#4a9eff" />
            <StatBar label="Reliability" value={employee.reliability} color="#00d2d3" />
            <StatBar label="Speed" value={employee.speed} color="#ffa502" />
            <StatBar label="Morale" value={employee.morale} color="#6c5ce7" />
            <StatBar label="Corruption Risk" value={employee.corruption_risk} color="#ff6b6b" />
          </View>
          <Card style={styles.employeeSalaryCard}>
            <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Daily Salary</Text><Text style={styles.salaryValue}>{formatCurrency(employee.salary)}/day</Text></View>
            <View style={styles.salaryRow}><Text style={styles.salaryLabel}>Experience</Text><Text style={styles.salaryValue}>{employee.experience_points} XP</Text></View>
            {employee.criminal_capable && <View style={styles.criminalCapable}><Text style={styles.criminalCapableText}>⚡ Criminal Operations Capable</Text></View>}
          </Card>
          <TouchableOpacity style={styles.fireButton} onPress={() => onFire(employee.id)}>
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
  const toast = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [fireConfirmVisible, setFireConfirmVisible] = useState(false);
  const [pendingFireId, setPendingFireId] = useState<string | null>(null);

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ['business', business.id, 'employees'],
    queryFn: () => api.get<Employee[]>('/businesses/' + business.id + '/employees'),
  });

  const fireMutation = useMutation({
    mutationFn: (id: string) => api.delete('/businesses/' + business.id + '/employees/' + id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['business', business.id, 'employees'] }); setSelectedEmployee(null); },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Failed to terminate employee', 'error'); },
  });

  const handleFireRequest = (id: string) => { setPendingFireId(id); setFireConfirmVisible(true); setSelectedEmployee(null); };
  const handleFireConfirm = () => { if (pendingFireId) fireMutation.mutate(pendingFireId); setFireConfirmVisible(false); setPendingFireId(null); };

  if (isLoading) return <LoadingScreen fullscreen={false} message="Loading employees..." />;

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <TouchableOpacity style={styles.hireButton} onPress={() => navigation.navigate('EmployeeMarket', { businessId: business.id })}>
        <Text style={styles.hireButtonText}>👷 Hire Employee</Text>
      </TouchableOpacity>
      {(employees ?? []).length === 0 ? (
        <EmptyState icon="👷" title="No employees" subtitle="Hire staff to improve efficiency" />
      ) : (
        (employees ?? []).map((emp) => (
          <TouchableOpacity key={emp.id} style={styles.employeeCard} onPress={() => setSelectedEmployee(emp)} activeOpacity={0.8}>
            <View style={styles.employeeCardHeader}>
              <View><Text style={styles.employeeName}>{emp.name}</Text><Badge label={emp.role} variant="blue" /></View>
              <Text style={styles.employeeSalary}>{formatCurrency(emp.salary)}/day</Text>
            </View>
            <View style={styles.employeeStatsMini}>
              <StatBar label="Efficiency" value={emp.efficiency} showValue={false} color="#00d2d3" />
              <StatBar label="Loyalty" value={emp.loyalty} showValue={false} color="#4a9eff" />
            </View>
            <View style={styles.moraleRow}>
              <Text style={styles.moraleLabel}>Morale:</Text>
              <Text style={[styles.moraleValue, { color: emp.morale > 70 ? '#00d2d3' : emp.morale > 40 ? '#ffa502' : '#ff6b6b' }]}>
                {emp.morale > 70 ? '😊' : emp.morale > 40 ? '😐' : '😤'} {emp.morale}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
      <EmployeeModal employee={selectedEmployee} visible={selectedEmployee !== null} onClose={() => setSelectedEmployee(null)} onFire={handleFireRequest} />
      <ConfirmModal visible={fireConfirmVisible} title="Terminate Employee" message="Are you sure you want to fire this employee? This action cannot be undone and may affect morale." confirmLabel="Terminate" confirmVariant="danger" onConfirm={handleFireConfirm} onCancel={() => setFireConfirmVisible(false)} isLoading={fireMutation.isPending} />
    </ScrollView>
  );
}

// --- Upgrade Tab ---

interface UpgradeInfo {
  current_tier: number;
  next_tier: number | null;
  upgrade_cost: number;
  capacity_increase: number;
  efficiency_boost: number;
}

function UpgradeTab({ business }: { business: Business }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const { data: upgradeInfo } = useQuery<UpgradeInfo>({
    queryKey: ['business', business.id, 'upgrade'],
    queryFn: () => api.get<UpgradeInfo>('/businesses/' + business.id + '/upgrade-info'),
  });

  const upgradeMutation = useMutation({
    mutationFn: () => api.post('/businesses/' + business.id + '/upgrade'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['business', business.id] });
      queryClient.invalidateQueries({ queryKey: ['player', 'me'] });
      setConfirmVisible(false);
    },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Failed to upgrade', 'error'); setConfirmVisible(false); },
  });

  const tierColor = TIER_COLORS[business.tier] ?? '#666';

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Current Tier</Text>
        <Text style={[styles.tierDisplay, { color: tierColor }]}>Tier {business.tier}</Text>
      </Card>

      {upgradeInfo?.next_tier ? (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Next Upgrade: Tier {upgradeInfo.next_tier}</Text>
          <View style={styles.upgradeDetails}>
            <View style={styles.upgradeStat}><Text style={styles.upgradeStatLabel}>Upgrade Cost</Text><Text style={styles.upgradeStatValue}>{formatCurrency(upgradeInfo.upgrade_cost)}</Text></View>
            <View style={styles.upgradeStat}><Text style={styles.upgradeStatLabel}>Capacity +</Text><Text style={[styles.upgradeStatValue, { color: '#4a9eff' }]}>+{upgradeInfo.capacity_increase.toLocaleString()}</Text></View>
            <View style={styles.upgradeStat}><Text style={styles.upgradeStatLabel}>Efficiency +</Text><Text style={[styles.upgradeStatValue, { color: '#00d2d3' }]}>+{Math.round(upgradeInfo.efficiency_boost * 100)}%</Text></View>
          </View>
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => setConfirmVisible(true)}>
            <Text style={styles.upgradeBtnText}>Upgrade to Tier {upgradeInfo.next_tier}</Text>
          </TouchableOpacity>
        </Card>
      ) : (
        <EmptyState icon="🏆" title="Max tier reached" subtitle="This business is fully upgraded" />
      )}

      <ConfirmModal visible={confirmVisible} title="Confirm Upgrade"
        message={'Upgrade to Tier ' + (upgradeInfo?.next_tier ?? '') + ' for ' + (upgradeInfo ? formatCurrency(upgradeInfo.upgrade_cost) : '...') + '?'}
        confirmLabel="Upgrade" onConfirm={() => upgradeMutation.mutate()} onCancel={() => setConfirmVisible(false)} isLoading={upgradeMutation.isPending} />
    </ScrollView>
  );
}

// --- Operations Tab ---

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
  const toast = useToast();
  const [autoSell, setAutoSell] = useState(false);
  const [autoSellPrice, setAutoSellPrice] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [qtyPerTick, setQtyPerTick] = useState('10');

  const { data: config } = useQuery<ProductionConfig>({
    queryKey: ['business', business.id, 'config'],
    queryFn: () => api.get<ProductionConfig>('/businesses/' + business.id + '/config'),
  });

  const { data: resources } = useQuery<Resource[]>({
    queryKey: ['market', 'resources'],
    queryFn: () => api.get<Resource[]>('/market/resources'),
    staleTime: 120_000,
  });

  React.useEffect(() => {
    if (config) {
      setAutoSell(config.auto_sell);
      setAutoSellPrice(config.auto_sell_price?.toString() ?? '');
      setSelectedResourceId(config.resource_id);
      setQtyPerTick(config.quantity_per_tick?.toString() ?? '10');
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<ProductionConfig>) => api.put('/businesses/' + business.id + '/config', payload),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['business', business.id, 'config'] }); toast.show('Production configuration updated.', 'success'); },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Save failed', 'error'); },
  });

  const produceMutation = useMutation({
    mutationFn: () => api.post('/businesses/' + business.id + '/produce'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['business', business.id] }); toast.show('Manual production tick triggered.', 'success'); },
    onError: (err) => { toast.show(err instanceof Error ? err.message : 'Production failed', 'error'); },
  });

  const currentResourceName = resources?.find((r) => r.id === selectedResourceId)?.name;
  const grouped: Record<string, Resource[]> = {};
  for (const r of resources ?? []) { if (!grouped[r.category]) grouped[r.category] = []; grouped[r.category].push(r); }

  return (
    <ScrollView contentContainerStyle={styles.tabContent}>
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Production Resource</Text>
        <Text style={styles.helperText}>What does this business produce each tick?</Text>
        {Object.entries(grouped).map(([cat, items]) => (
          <View key={cat}>
            <Text style={styles.categoryLabel}>{cat}</Text>
            <View style={styles.resourceGrid}>
              {items.map((r) => (
                <TouchableOpacity key={r.id} style={[styles.resourceChip, selectedResourceId === r.id && styles.resourceChipSelected]} onPress={() => setSelectedResourceId(r.id)}>
                  <Text style={[styles.resourceChipText, selectedResourceId === r.id && styles.resourceChipTextSelected]}>
                    {r.illegal ? '🔴 ' : ''}{r.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        {currentResourceName && <Text style={[styles.helperText, { marginTop: 8 }]}>Selected: <Text style={styles.accent}>{currentResourceName}</Text></Text>}
      </Card>

      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Output per Tick</Text>
        <Text style={styles.inputLabel}>Units produced per production tick</Text>
        <TextInput style={styles.configInput} value={qtyPerTick} onChangeText={setQtyPerTick} keyboardType="numeric" placeholder="10" placeholderTextColor="#a0a0b0" />
      </Card>

      <Card style={styles.section}>
        <View style={styles.optionRow}>
          <View><Text style={styles.optionTitle}>Auto-Sell</Text><Text style={styles.optionDesc}>Automatically list produced goods on the market</Text></View>
          <Switch value={autoSell} onValueChange={setAutoSell} trackColor={{ false: '#2a2a3e', true: '#1a2e1a' }} thumbColor={autoSell ? '#00d2d3' : '#a0a0b0'} />
        </View>
        {autoSell && (
          <><Text style={styles.inputLabel}>Auto-sell price per unit ($)</Text>
          <TextInput style={styles.configInput} value={autoSellPrice} onChangeText={setAutoSellPrice} keyboardType="decimal-pad" placeholder="e.g. 100.00" placeholderTextColor="#a0a0b0" /></>
        )}
      </Card>

      <TouchableOpacity style={styles.saveBtn} onPress={() => saveMutation.mutate({ resource_id: selectedResourceId, quantity_per_tick: parseInt(qtyPerTick, 10) || 10, auto_sell: autoSell, auto_sell_price: autoSell ? parseFloat(autoSellPrice) || null : null })} disabled={saveMutation.isPending}>
        <Text style={styles.saveBtnText}>{saveMutation.isPending ? 'Saving...' : 'Save Configuration'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#2a2a3e', marginTop: 8 }]} onPress={() => produceMutation.mutate()} disabled={produceMutation.isPending}>
        <Text style={styles.saveBtnText}>{produceMutation.isPending ? 'Producing...' : '⚡ Trigger Production Now'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// --- Main BusinessDetailScreen ---

export function BusinessDetailScreen() {
  const route = useRoute<RoutePropType>();
  const { businessId } = route.params;
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const { data: business, isLoading } = useQuery<Business>({
    queryKey: ['business', businessId],
    queryFn: () => api.get<Business>('/businesses/' + businessId),
    staleTime: 15_000,
  });

  if (isLoading || !business) return <LoadingScreen message="Loading business..." />;

  const tierColor = TIER_COLORS[business.tier] ?? '#666';

  return (
    <View style={styles.screen}>
      <View style={styles.businessHeader}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.headerTierBadge, { backgroundColor: tierColor + '20', borderColor: tierColor }]}>
            <Text style={[styles.headerTierText, { color: tierColor }]}>T{business.tier}</Text>
          </View>
          <Text style={styles.businessHeaderName} numberOfLines={1}>{business.name}</Text>
        </View>
        <StatusBadge status={business.status} />
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]} onPress={() => setActiveTab(tab.key)}>
            <Text style={[styles.tabItemText, activeTab === tab.key && styles.tabItemTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'overview' && <OverviewTab business={business} />}
      {activeTab === 'employees' && <EmployeesTab business={business} />}
      {activeTab === 'upgrade' && <UpgradeTab business={business} />}
      {activeTab === 'operations' && <OperationsTab business={business} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a0a0f' },
  businessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  businessHeaderName: { fontSize: 18, fontWeight: '700', color: '#e0e0e0', flex: 1, marginRight: 8 },
  headerTierBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  headerTierText: { fontSize: 12, fontWeight: '800' },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#2a2a3e', backgroundColor: '#12121a' },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabItemActive: { borderBottomColor: '#6c5ce7' },
  tabItemText: { fontSize: 12, fontWeight: '600', color: '#a0a0b0' },
  tabItemTextActive: { color: '#6c5ce7' },
  tabContent: { padding: 16, paddingBottom: 32, gap: 12 },
  section: { marginBottom: 0 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  cityText: { fontSize: 14, color: '#a0a0b0', marginLeft: 4 },

  // Manager section
  managerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  managerBadge: { width: 40, height: 40, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12121a' },
  managerTier: { fontSize: 14, fontWeight: '800' },
  managerName: { fontSize: 15, fontWeight: '700', color: '#e0e0e0' },
  managerStats: { flexDirection: 'row', gap: 12, marginTop: 4 },
  managerStat: { fontSize: 12, color: '#00d2d3' },
  noManagerBox: { alignItems: 'center', paddingVertical: 8 },
  noManagerText: { fontSize: 14, color: '#a0a0b0', marginBottom: 12 },
  managerBtnRow: { flexDirection: 'row', gap: 8 },
  hireManagerBtn: { backgroundColor: '#6c5ce7', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  hireManagerBtnText: { color: '#e0e0e0', fontSize: 13, fontWeight: '700' },
  trainManagerBtn: { backgroundColor: '#12121a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#2a2a3e' },
  trainManagerBtnText: { color: '#ffa502', fontSize: 13, fontWeight: '700' },
  fireManagerBtn: { backgroundColor: '#1a0a0a', borderWidth: 1, borderColor: '#ff6b6b40', borderRadius: 8, padding: 8, alignItems: 'center' },
  fireManagerBtnText: { color: '#ff6b6b', fontSize: 12, fontWeight: '700' },

  // District info
  districtHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  districtName: { fontSize: 16, fontWeight: '700', color: '#e0e0e0' },
  districtTier: { fontSize: 16, fontWeight: '800' },
  multiplierRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  multiplierItem: { flex: 1, backgroundColor: '#12121a', borderRadius: 8, padding: 10 },
  multiplierLabel: { fontSize: 10, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  multiplierValue: { fontSize: 18, fontWeight: '700' },
  footTrafficSection: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footTrafficLabel: { fontSize: 11, color: '#a0a0b0', width: 70 },
  footBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#12121a', overflow: 'hidden' },
  footBarFill: { height: '100%', borderRadius: 3 },
  footBarValue: { fontSize: 11, fontWeight: '700', color: '#e0e0e0', width: 32, textAlign: 'right' },

  // Production chain
  chainContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#12121a', borderRadius: 10, padding: 12 },
  chainSide: { flex: 1, gap: 6 },
  chainItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chainIcon: { fontSize: 18 },
  chainText: { fontSize: 12, fontWeight: '600', color: '#e0e0e0' },
  chainMuted: { fontSize: 12, color: '#a0a0b0' },
  chainArrow: { paddingHorizontal: 6 },
  chainArrowText: { fontSize: 24, color: '#6c5ce7', fontWeight: '700' },

  pnlValue: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  pnlDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  pnlLabel: { fontSize: 11, color: '#a0a0b0', textTransform: 'uppercase', marginBottom: 2 },
  pnlGreen: { fontSize: 13, fontWeight: '600', color: '#00d2d3' },
  pnlRed: { fontSize: 13, fontWeight: '600', color: '#ff6b6b' },
  inventoryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#2a2a3e' },
  inventoryResource: { fontSize: 13, color: '#e0e0e0' },
  inventoryQty: { fontSize: 13, fontWeight: '700', color: '#e0e0e0' },
  emptyText: { color: '#a0a0b0', fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  hireButton: { backgroundColor: '#0c1a2e', borderWidth: 1, borderColor: '#4a9eff', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 12 },
  hireButtonText: { color: '#4a9eff', fontSize: 15, fontWeight: '700' },
  employeeCard: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2a2a3e', marginBottom: 10 },
  employeeCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  employeeName: { fontSize: 15, fontWeight: '700', color: '#e0e0e0', marginBottom: 4 },
  employeeSalary: { fontSize: 13, fontWeight: '600', color: '#ffa502' },
  employeeStatsMini: { gap: 4, marginBottom: 6 },
  moraleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  moraleLabel: { fontSize: 11, color: '#a0a0b0' },
  moraleValue: { fontSize: 13, fontWeight: '600' },
  modalScreen: { flex: 1, backgroundColor: '#0a0a0f' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#e0e0e0' },
  modalClose: { fontSize: 18, color: '#a0a0b0', padding: 4 },
  modalContent: { padding: 20, gap: 16 },
  employeeStatsGrid: { gap: 8 },
  employeeSalaryCard: { gap: 8 },
  salaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  salaryLabel: { fontSize: 13, color: '#a0a0b0' },
  salaryValue: { fontSize: 13, fontWeight: '700', color: '#e0e0e0' },
  criminalCapable: { backgroundColor: '#1a0a0a', borderRadius: 6, padding: 8 },
  criminalCapableText: { color: '#ff6b6b', fontSize: 12, fontWeight: '600' },
  fireButton: { backgroundColor: '#1a0a0a', borderWidth: 1, borderColor: '#ff6b6b40', borderRadius: 10, padding: 14, alignItems: 'center' },
  fireButtonText: { color: '#ff6b6b', fontSize: 15, fontWeight: '700' },
  tierDisplay: { fontSize: 32, fontWeight: '800' },
  upgradeDetails: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  upgradeStat: { flex: 1, backgroundColor: '#12121a', borderRadius: 8, padding: 10 },
  upgradeStatLabel: { fontSize: 11, color: '#a0a0b0', textTransform: 'uppercase', marginBottom: 4 },
  upgradeStatValue: { fontSize: 14, fontWeight: '700', color: '#e0e0e0' },
  upgradeBtn: { backgroundColor: '#6c5ce7', borderRadius: 10, padding: 14, alignItems: 'center' },
  upgradeBtnText: { color: '#0a0a0f', fontSize: 15, fontWeight: '700' },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  optionTitle: { fontSize: 15, fontWeight: '600', color: '#e0e0e0' },
  optionDesc: { fontSize: 12, color: '#a0a0b0', marginTop: 2, maxWidth: 220 },
  inputLabel: { fontSize: 13, color: '#a0a0b0', marginBottom: 6, marginTop: 6 },
  configInput: { backgroundColor: '#12121a', borderWidth: 1, borderColor: '#2a2a3e', borderRadius: 8, padding: 12, fontSize: 15, color: '#e0e0e0', marginBottom: 12 },
  saveBtn: { backgroundColor: '#4a9eff', borderRadius: 10, padding: 12, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  helperText: { fontSize: 13, color: '#a0a0b0', marginBottom: 8 },
  accent: { color: '#00d2d3', fontWeight: '600' },
  categoryLabel: { fontSize: 11, color: '#a0a0b0', textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 4 },
  resourceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  resourceChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#2a2a3e', backgroundColor: '#12121a' },
  resourceChipSelected: { borderColor: '#6c5ce7', backgroundColor: '#1a0a2e' },
  resourceChipText: { fontSize: 12, fontWeight: '600', color: '#a0a0b0' },
  resourceChipTextSelected: { color: '#6c5ce7' },
});
