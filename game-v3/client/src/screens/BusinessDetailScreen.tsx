import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface DiscoveryHint {
  id: string;
  key: string;
  ui_surface: string;
  reward_type: string;
  reward_payload: { message: string };
}
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { StatBar } from '../components/ui/StatBar';
import { ProgressBar } from '../components/ui/ProgressBar';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { CountdownTimer } from '../components/ui/CountdownTimer';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency } from '../components/ui/CurrencyText';

// ─── Types ─────────────────────────────────────────

interface Employee {
  id: string;
  name: string;
  role: string;
  salary: number;
  efficiency: number;
  speed: number;
  loyalty: number;
  discretion: number;
  learning_rate: number;
  stress: number;
  status: string;
  hired_at: string | null;
}

interface InventoryItem {
  item_id: string;
  item_key: string;
  item_name: string;
  amount: number;
  reserved: number;
  dirty_amount: number;
  base_price: number;
}

interface RecipeInput {
  item_id: string;
  item_key: string;
  item_name: string;
  base_price: number;
  qty_per_unit: number;
  source_business_type: string | null;
}

interface RecipeInfo {
  inputs: RecipeInput[];
  output_market_price: number;
  input_cost_per_unit: number;
  profit_per_unit: number;
  estimated_daily_production: number;
  estimated_daily_revenue: number;
}

interface BusinessCosts {
  location_rent: number;
  salaries: number;
  total_daily: number;
}

interface BusinessDetail {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  efficiency: number;
  recipe_id: string | null;
  location_name: string;
  location_type: string;
  location_zone: string;
  location_traffic: number;
  location_daily_cost: number;
  output_item_key: string | null;
  output_item_name: string | null;
  base_rate: number | null;
  cycle_minutes: number | null;
  storage_cap: number;
  security_physical: number;
  security_cyber: number;
  security_legal: number;
  max_employees: number;
  inventory: InventoryItem[];
  employees: Employee[];
  production_per_tick: number;
  recipe_info: RecipeInfo | null;
  costs: BusinessCosts;
  auto_sell: boolean;
}

interface InventoryData {
  inventory: Array<{
    id: string;
    item_id: string;
    amount: number;
    reserved: number;
    dirty_amount: number;
    key: string;
    name: string;
    category: string;
    base_price: number;
  }>;
  logs: Array<{
    delta: number;
    reason: string;
    created_at: string;
    item_name: string;
  }>;
}

type TabKey = 'overview' | 'inventory' | 'production' | 'employees' | 'accounting';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'production', label: 'Production' },
  { key: 'employees', label: 'Employees' },
  { key: 'accounting', label: 'Accounting' },
];

const BIZ_EMOJIS: Record<string, string> = {
  SHOP: '\u{1F3EA}',
  FACTORY: '\u{1F3ED}',
  MINE: '\u{26CF}\u{FE0F}',
};

const TRAINING_TYPES = [
  { key: 'basic', label: 'Basic', duration: '1h', multiplier: '2x salary' },
  { key: 'advanced', label: 'Advanced', duration: '4h', multiplier: '5x salary' },
  { key: 'elite', label: 'Elite', duration: '12h', multiplier: '10x salary' },
];

interface Props {
  route: { params: { businessId: string } };
  navigation: { goBack: () => void; navigate: (screen: string, params?: Record<string, unknown>) => void };
}

export function BusinessDetailScreen({ route, navigation }: Props) {
  const { businessId } = route.params;
  const queryClient = useQueryClient();
  const { show } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [closeConfirmVisible, setCloseConfirmVisible] = useState(false);
  const [fireConfirmId, setFireConfirmId] = useState<string | null>(null);
  const [trainModalId, setTrainModalId] = useState<string | null>(null);

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

  const bizHints = (hints ?? []).filter((h) => h.ui_surface === 'business_detail');

  // ─── Queries ─────────────────────────────────────
  const { data: biz, isLoading, refetch, isRefetching } = useQuery<BusinessDetail>({
    queryKey: ['business', businessId],
    queryFn: () => api.get<BusinessDetail>(`/businesses/${businessId}`),
    refetchInterval: 30000,
  });

  const { data: invData } = useQuery<InventoryData>({
    queryKey: ['inventory', businessId],
    queryFn: () => api.get<InventoryData>(`/inventory/businesses/${businessId}/inventory`),
    enabled: activeTab === 'inventory',
    refetchInterval: 30000,
  });

  const { data: bizEarnings } = useQuery<{ income: number; expenses: number; daily_cost: number }>(
    {
      queryKey: ['biz-earnings', businessId],
      queryFn: async () => {
        // Calculate from the business detail data
        if (!biz) return { income: 0, expenses: 0, daily_cost: 0 };
        const locationCost = Number(biz.location_daily_cost ?? 0);
        const salaryCost = biz.employees.reduce((s, e) => s + Number(e.salary), 0);
        return { income: 0, expenses: 0, daily_cost: locationCost + salaryCost };
      },
      enabled: activeTab === 'accounting',
    },
  );

  // ─── Mutations ───────────────────────────────────
  const upgradeMutation = useMutation({
    mutationFn: () => api.post(`/businesses/${businessId}/upgrade`),
    onSuccess: () => {
      show('Business upgraded!', 'success');
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const closeMutation = useMutation({
    mutationFn: () => api.delete(`/businesses/${businessId}`),
    onSuccess: () => {
      show('Business closed', 'success');
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      navigation.goBack();
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const fireMutation = useMutation({
    mutationFn: (empId: string) => api.post(`/employees/${empId}/fire`),
    onSuccess: () => {
      show('Employee fired', 'success');
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      setFireConfirmId(null);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const trainMutation = useMutation({
    mutationFn: ({ empId, type }: { empId: string; type: string }) =>
      api.post(`/employees/${empId}/train`, { type }),
    onSuccess: () => {
      show('Training started!', 'success');
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      setTrainModalId(null);
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const autoSellMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch(`/businesses/${businessId}/auto-sell`, { enabled }),
    onSuccess: () => {
      show(biz?.auto_sell ? 'Auto-sell disabled' : 'Auto-sell enabled', 'success');
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  // ─── Manager ──────────────────────────────────────
  interface ManagerConfig {
    auto_buy_inputs: boolean;
    auto_sell_output: boolean;
    auto_train_workers: boolean;
    target_input_stock: number;
    min_sell_price_pct: number;
    max_buy_price_pct: number;
    risk_mode: 'conservative' | 'balanced' | 'aggressive';
  }
  interface ManagerData {
    business_id: string;
    business_name: string;
    business_type: string;
    has_manager: boolean;
    config: ManagerConfig | null;
    cost_per_day: number;
  }

  const { data: managerData } = useQuery<ManagerData>({
    queryKey: ['manager', businessId],
    queryFn: () => api.get<ManagerData>(`/businesses/${businessId}/manager`),
    refetchInterval: 30000,
  });

  const [mgrConfig, setMgrConfig] = useState<ManagerConfig | null>(null);
  const mgrCfg = mgrConfig ?? managerData?.config ?? null;

  const hireManagerMutation = useMutation({
    mutationFn: () =>
      api.post(`/businesses/${businessId}/manager`, {
        auto_buy_inputs: true,
        auto_sell_output: true,
        auto_train_workers: false,
        target_input_stock: 20,
        min_sell_price_pct: 90,
        max_buy_price_pct: 110,
        risk_mode: 'balanced',
      }),
    onSuccess: () => {
      show('Manager hired!', 'success');
      queryClient.invalidateQueries({ queryKey: ['manager', businessId] });
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const updateManagerMutation = useMutation({
    mutationFn: (config: ManagerConfig) =>
      api.post(`/businesses/${businessId}/manager`, config),
    onSuccess: () => {
      show('Manager config saved', 'success');
      setMgrConfig(null);
      queryClient.invalidateQueries({ queryKey: ['manager', businessId] });
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const fireManagerMutation = useMutation({
    mutationFn: () => api.delete(`/businesses/${businessId}/manager`),
    onSuccess: () => {
      show('Manager fired', 'success');
      setMgrConfig(null);
      queryClient.invalidateQueries({ queryKey: ['manager', businessId] });
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  const securityMutation = useMutation({
    mutationFn: (type: 'physical' | 'cyber' | 'legal') =>
      api.post(`/businesses/${businessId}/security`, { type }),
    onSuccess: () => {
      show('Security upgraded!', 'success');
      queryClient.invalidateQueries({ queryKey: ['business', businessId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: Error) => show(err.message, 'error'),
  });

  if (isLoading || !biz) {
    return <LoadingScreen message="Loading business..." />;
  }

  const upgradeCostVal = Math.round(
    ({ SHOP: 8000, FACTORY: 15000, MINE: 12000 }[biz.type] ?? 10000) * biz.tier * 1.5
  );

  const fireTargetName = fireConfirmId
    ? biz.employees.find((e) => e.id === fireConfirmId)?.name ?? 'this employee'
    : '';

  // ─── Tab Content Renderers ───────────────────────

  const renderOverview = () => (
    <View>
      <Card style={styles.sectionCard}>
        <View style={styles.overviewHeader}>
          <Text style={styles.bizEmoji}>{BIZ_EMOJIS[biz.type] ?? '\u{1F3E2}'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.bizName}>{biz.name}</Text>
            <Text style={styles.bizSub}>{biz.location_name} - {biz.location_zone}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Badge label={biz.type} variant="blue" />
            <Badge label={`Tier ${biz.tier}`} variant="purple" />
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Status</Text>
            <Badge label={biz.status.toUpperCase()} variant={biz.status === 'active' ? 'green' : 'gray'} />
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Efficiency</Text>
            <Text style={styles.statValue}>{biz.efficiency}%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Employees</Text>
            <Text style={styles.statValue}>{biz.employees.length}/{biz.max_employees}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Storage</Text>
            <Text style={styles.statValue}>{biz.storage_cap}</Text>
          </View>
        </View>

        {/* Auto-Sell Toggle */}
        <View style={styles.autoSellRow}>
          <Text style={styles.autoSellLabel}>Auto-Sell</Text>
          <TouchableOpacity
            style={[
              styles.autoSellToggle,
              biz.auto_sell ? styles.autoSellToggleOn : styles.autoSellToggleOff,
            ]}
            onPress={() => autoSellMutation.mutate(!biz.auto_sell)}
            disabled={autoSellMutation.isPending}
          >
            <Text style={[
              styles.autoSellToggleText,
              biz.auto_sell ? styles.autoSellToggleTextOn : styles.autoSellToggleTextOff,
            ]}>
              {biz.auto_sell ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Manager Section */}
      <Text style={styles.sectionTitle}>Manager</Text>
      {managerData && !managerData.has_manager ? (
        <Card style={styles.sectionCard}>
          <Text style={styles.mgrDescription}>
            Hire a manager to automate buying inputs, selling output, and more.
          </Text>
          <Text style={styles.mgrCost}>{formatCurrency(managerData.cost_per_day || 500)}/day</Text>
          <TouchableOpacity
            style={styles.mgrHireButton}
            onPress={() => hireManagerMutation.mutate()}
            disabled={hireManagerMutation.isPending}
          >
            <Text style={styles.mgrHireText}>
              {hireManagerMutation.isPending ? 'Hiring...' : 'Hire Manager'}
            </Text>
          </TouchableOpacity>
        </Card>
      ) : managerData && managerData.has_manager && mgrCfg ? (
        <Card style={styles.sectionCard}>
          {/* Auto-Buy Inputs */}
          <View style={styles.mgrToggleRow}>
            <Text style={styles.mgrToggleLabel}>Auto-Buy Inputs</Text>
            <TouchableOpacity
              style={[
                styles.autoSellToggle,
                mgrCfg.auto_buy_inputs ? styles.autoSellToggleOn : styles.autoSellToggleOff,
              ]}
              onPress={() => setMgrConfig({ ...mgrCfg, auto_buy_inputs: !mgrCfg.auto_buy_inputs })}
            >
              <Text style={[
                styles.autoSellToggleText,
                mgrCfg.auto_buy_inputs ? styles.autoSellToggleTextOn : styles.autoSellToggleTextOff,
              ]}>
                {mgrCfg.auto_buy_inputs ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Auto-Sell Output */}
          <View style={styles.mgrToggleRow}>
            <Text style={styles.mgrToggleLabel}>Auto-Sell Output</Text>
            <TouchableOpacity
              style={[
                styles.autoSellToggle,
                mgrCfg.auto_sell_output ? styles.autoSellToggleOn : styles.autoSellToggleOff,
              ]}
              onPress={() => setMgrConfig({ ...mgrCfg, auto_sell_output: !mgrCfg.auto_sell_output })}
            >
              <Text style={[
                styles.autoSellToggleText,
                mgrCfg.auto_sell_output ? styles.autoSellToggleTextOn : styles.autoSellToggleTextOff,
              ]}>
                {mgrCfg.auto_sell_output ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Risk Mode */}
          <View style={styles.mgrToggleRow}>
            <Text style={styles.mgrToggleLabel}>Risk Mode</Text>
            <TouchableOpacity
              style={styles.mgrRiskButton}
              onPress={() => {
                const modes: Array<'conservative' | 'balanced' | 'aggressive'> = ['conservative', 'balanced', 'aggressive'];
                const idx = modes.indexOf(mgrCfg.risk_mode);
                const next = modes[(idx + 1) % modes.length];
                setMgrConfig({ ...mgrCfg, risk_mode: next });
              }}
            >
              <Text style={[styles.mgrRiskText, {
                color: mgrCfg.risk_mode === 'aggressive' ? '#ef4444'
                  : mgrCfg.risk_mode === 'balanced' ? '#f59e0b' : '#22c55e',
              }]}>
                {mgrCfg.risk_mode}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Save + Fire */}
          <TouchableOpacity
            style={styles.mgrSaveButton}
            onPress={() => updateManagerMutation.mutate(mgrCfg)}
            disabled={updateManagerMutation.isPending}
          >
            <Text style={styles.mgrSaveText}>
              {updateManagerMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mgrFireButton}
            onPress={() => fireManagerMutation.mutate()}
            disabled={fireManagerMutation.isPending}
          >
            <Text style={styles.mgrFireText}>
              {fireManagerMutation.isPending ? 'Firing...' : 'Fire Manager'}
            </Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      {/* Security Section */}
      <Text style={styles.sectionTitle}>Security</Text>
      <Card style={styles.sectionCard}>
        {([
          { type: 'physical' as const, label: 'Physical', icon: '\u{1F6E1}\u{FE0F}', value: biz.security_physical ?? 0, color: '#3b82f6' },
          { type: 'cyber' as const, label: 'Cyber', icon: '\u{1F512}', value: biz.security_cyber ?? 0, color: '#8b5cf6' },
          { type: 'legal' as const, label: 'Legal', icon: '\u{2696}\u{FE0F}', value: biz.security_legal ?? 0, color: '#f59e0b' },
        ]).map((sec) => {
          const cost = 1000 + sec.value * 50;
          return (
            <View key={sec.type} style={styles.securityRow}>
              <Text style={styles.securityIcon}>{sec.icon}</Text>
              <View style={{ flex: 1 }}>
                <View style={styles.securityLabelRow}>
                  <Text style={styles.securityLabel}>{sec.label}</Text>
                  <Text style={styles.securityValue}>{sec.value}/100</Text>
                </View>
                <ProgressBar
                  progress={sec.value / 100}
                  color={sec.color}
                  height={6}
                />
              </View>
              <TouchableOpacity
                style={styles.securityUpgradeBtn}
                onPress={() => securityMutation.mutate(sec.type)}
                disabled={securityMutation.isPending || sec.value >= 100}
              >
                <Text style={styles.securityUpgradeText}>
                  {sec.value >= 100 ? 'MAX' : `+1 ${formatCurrency(cost)}`}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </Card>

      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => upgradeMutation.mutate()}
          disabled={upgradeMutation.isPending}
        >
          <Text style={styles.upgradeText}>
            Upgrade to T{biz.tier + 1} ({formatCurrency(upgradeCostVal)})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => setCloseConfirmVisible(true)}
        >
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInventory = () => {
    const items = invData?.inventory ?? biz.inventory;
    const logs = invData?.logs ?? [];
    const totalInv = items.reduce((s, i) => s + Number(i.amount), 0);

    return (
      <View>
        <Card style={styles.sectionCard}>
          <View style={styles.storageHeader}>
            <Text style={styles.sectionTitle}>Storage</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.storageText}>{Math.round(totalInv)} / {biz.storage_cap}</Text>
              {biz.storage_cap > 0 && totalInv >= biz.storage_cap && (
                <Badge label="FULL" variant="orange" size="sm" />
              )}
            </View>
          </View>
          <ProgressBar
            progress={biz.storage_cap > 0 ? totalInv / biz.storage_cap : 0}
            color={totalInv / biz.storage_cap > 0.9 ? '#ef4444' : totalInv / biz.storage_cap > 0.6 ? '#f59e0b' : '#22c55e'}
            height={6}
          />
        </Card>

        {items.length === 0 ? (
          <EmptyState icon="\u{1F4E6}" title="No inventory" subtitle="Hire employees and wait for production ticks" />
        ) : (
          items.map((item) => (
            <Card key={item.item_id} style={styles.invCard}>
              <View style={styles.invRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invName}>{item.name ?? item.item_name ?? item.key ?? 'Item'}</Text>
                  <Text style={styles.invCategory}>{item.category ?? ''}</Text>
                </View>
                <Text style={styles.invAmount}>{Math.round(Number(item.amount))}</Text>
              </View>
              <ProgressBar
                progress={biz.storage_cap > 0 ? Number(item.amount) / biz.storage_cap : 0}
                color="#3b82f6"
                height={4}
              />
            </Card>
          ))
        )}

        {logs.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Recent Activity</Text>
            {logs.map((log, idx) => (
              <View key={idx} style={styles.logRow}>
                <Text style={[styles.logDelta, { color: Number(log.delta) > 0 ? '#22c55e' : '#ef4444' }]}>
                  {Number(log.delta) > 0 ? '+' : ''}{Math.round(Number(log.delta))}
                </Text>
                <Text style={styles.logItem}>{log.item_name}</Text>
                <Text style={styles.logReason}>{log.reason.replace(/_/g, ' ')}</Text>
              </View>
            ))}
          </>
        )}
      </View>
    );
  };

  const renderProduction = () => {
    const recipe = biz.recipe_info;

    if (biz.type === 'SHOP') {
      return (
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Sales Mode</Text>
          <Text style={styles.prodText}>Traffic-based sales from location traffic ({biz.location_traffic})</Text>
          {biz.employees.length === 0 && (
            <View style={styles.noWorkersBanner}>
              <Text style={styles.noWorkersText}>No workers — production halted</Text>
            </View>
          )}
        </Card>
      );
    }

    return (
      <View>
        {/* Recipe Chain Visualization */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Recipe</Text>
          {biz.output_item_name ? (
            <>
              {recipe && recipe.inputs.length > 0 ? (
                <View style={styles.recipeChain}>
                  {/* Inputs */}
                  <View style={styles.recipeInputsCol}>
                    {recipe.inputs.map((inp) => (
                      <View key={inp.item_id} style={styles.recipeInputItem}>
                        <Text style={styles.recipeItemQty}>{inp.qty_per_unit}x</Text>
                        <Text style={styles.recipeItemName}>{inp.item_name}</Text>
                        <Text style={styles.recipeItemPrice}>({formatCurrency(inp.base_price)})</Text>
                      </View>
                    ))}
                  </View>
                  {/* Arrow */}
                  <View style={styles.recipeArrowCol}>
                    <Text style={styles.recipeArrowText}>{'\u2192'}</Text>
                  </View>
                  {/* Output */}
                  <View style={styles.recipeOutputCol}>
                    <Text style={styles.recipeOutputName}>1x {biz.output_item_name}</Text>
                    <Text style={styles.recipeOutputPrice}>{formatCurrency(recipe.output_market_price)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.recipeChain}>
                  <View style={styles.recipeOutputCol}>
                    <Text style={styles.recipeOutputName}>{biz.output_item_name}</Text>
                    <Text style={styles.prodText}>No inputs required (raw resource)</Text>
                  </View>
                </View>
              )}

              {/* Profit per unit */}
              {recipe && (
                <View style={styles.recipeProfitRow}>
                  <Text style={styles.recipeProfitLabel}>Profit per unit:</Text>
                  <Text style={[
                    styles.recipeProfitValue,
                    { color: recipe.profit_per_unit >= 0 ? '#22c55e' : '#ef4444' },
                  ]}>
                    {recipe.profit_per_unit >= 0 ? '+' : ''}{formatCurrency(recipe.profit_per_unit)}
                  </Text>
                </View>
              )}

              {/* Input sourcing hints */}
              {recipe && recipe.inputs.length > 0 && (
                <View style={styles.recipeSourceHints}>
                  {recipe.inputs.map((inp) => (
                    <Text key={inp.item_id} style={styles.recipeSourceText}>
                      {inp.item_name}: {inp.source_business_type
                        ? `Buy from Market or produce with ${inp.source_business_type}`
                        : 'Buy from Market'}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.recipeDivider} />

              <Text style={styles.prodText}>
                Base rate: {biz.base_rate}/tick (every {biz.cycle_minutes ?? 1}min)
              </Text>
              {biz.employees.length === 0 ? (
                <View style={styles.noWorkersBanner}>
                  <Text style={styles.noWorkersText}>No workers — production halted</Text>
                </View>
              ) : (
                <Text style={[styles.prodText, { color: '#22c55e', fontWeight: '700', marginTop: 8 }]}>
                  Current: {biz.production_per_tick}/tick with {biz.employees.length} employee(s)
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.prodText}>No recipe assigned</Text>
          )}
        </Card>

        {/* Input Status — enhanced with recipe_info */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Input Status</Text>
          {(() => {
            // Use recipe_info inputs if available for accurate data
            if (recipe && recipe.inputs.length > 0) {
              return recipe.inputs.map((inp) => {
                const invItem = biz.inventory.find(
                  (inv) => inv.item_id === inp.item_id || inv.item_key === inp.item_key
                );
                const amount = invItem ? Number(invItem.amount) : 0;
                const neededPerCycle = inp.qty_per_unit * (biz.production_per_tick > 0 ? biz.production_per_tick : 1);
                const cyclesAvailable = neededPerCycle > 0 ? Math.floor(amount / neededPerCycle) : 0;
                const isLow = amount > 0 && cyclesAvailable < 5;
                const isEmpty = amount <= 0;
                const statusColor = isEmpty ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e';
                return (
                  <View key={inp.item_id} style={styles.inputStatusRow}>
                    <View style={styles.inputStatusDot}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.inputStatusHeader}>
                        <Text style={[styles.inputName, isEmpty && { color: '#ef4444' }]}>
                          {inp.item_name}
                        </Text>
                        <Text style={[styles.inputAmount, { color: statusColor }]}>
                          {Math.round(amount)} / {neededPerCycle} per cycle
                        </Text>
                      </View>
                      {isEmpty ? (
                        <Text style={styles.missingInputText}>
                          OUT OF STOCK — production blocked
                        </Text>
                      ) : isLow ? (
                        <Text style={styles.lowInputText}>
                          Low supply — {cyclesAvailable} cycles remaining
                        </Text>
                      ) : (
                        <Text style={styles.okInputText}>
                          {cyclesAvailable} cycles of supply
                        </Text>
                      )}
                    </View>
                  </View>
                );
              });
            }
            // Fallback: use inventory-based detection
            const inputs = biz.inventory.filter(
              (inv) => (inv.item_key ?? inv.item_name) !== biz.output_item_key
            );
            if (inputs.length === 0 && biz.type === 'FACTORY') {
              return (
                <Text style={styles.missingInputText}>
                  No inputs in inventory. Buy materials from the Market.
                </Text>
              );
            }
            return inputs.map((inv) => {
              const amount = Number(inv.amount);
              const ticksSupply = biz.production_per_tick > 0
                ? Math.floor(amount / (biz.production_per_tick * 2))
                : 0;
              const isMissing = amount <= 0;
              return (
                <View key={inv.item_id} style={styles.inputRow}>
                  <Text style={[styles.inputName, isMissing && { color: '#ef4444' }]}>
                    {inv.item_name ?? inv.item_key}
                  </Text>
                  {isMissing ? (
                    <Text style={styles.missingInputText}>
                      Missing: 0 available
                    </Text>
                  ) : (
                    <>
                      <Text style={styles.inputAmount}>{Math.round(amount)} available</Text>
                      {ticksSupply > 0 && (
                        <Text style={styles.inputTicks}>({ticksSupply} ticks)</Text>
                      )}
                    </>
                  )}
                </View>
              );
            });
          })()}
        </Card>
      </View>
    );
  };

  const renderEmployees = () => (
    <View>
      {biz.employees.length === 0 ? (
        <EmptyState
          icon="\u{1F464}"
          title="No employees"
          subtitle="Hire from the employee pool to start production"
          action={
            <TouchableOpacity
              style={styles.hireButton}
              onPress={() => navigation.navigate('Employees')}
            >
              <Text style={styles.hireText}>Go to Recruit Pool</Text>
            </TouchableOpacity>
          }
        />
      ) : (
        biz.employees.map((emp) => (
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

            <View style={styles.empActions}>
              {emp.status === 'active' && (
                <TouchableOpacity
                  style={styles.trainButton}
                  onPress={() => setTrainModalId(emp.id)}
                >
                  <Text style={styles.trainText}>Train</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.fireBtn}
                onPress={() => setFireConfirmId(emp.id)}
              >
                <Text style={styles.fireBtnText}>Fire</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ))
      )}

      <TouchableOpacity
        style={[styles.hireButton, { marginTop: 12 }]}
        onPress={() => navigation.navigate('Employees')}
      >
        <Text style={styles.hireText}>Recruit Pool</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAccounting = () => {
    // Use server-provided costs when available, fall back to client-side calc
    const costs = biz.costs;
    const locationCost = costs ? Number(costs.location_rent) : Number(biz.location_daily_cost ?? 0);
    const totalSalaries = costs ? Number(costs.salaries) : biz.employees.reduce((s, e) => s + Number(e.salary), 0);
    const totalDailyCost = costs ? Number(costs.total_daily) : locationCost + totalSalaries;

    // Use server-provided revenue estimate when available
    const recipe = biz.recipe_info;
    const estimatedDailyRevenue = recipe
      ? Number(recipe.estimated_daily_revenue)
      : (() => {
          const outputItem = biz.inventory.find(
            (inv) => (inv.item_key ?? inv.item_name) === biz.output_item_key
          );
          const outputBasePrice = outputItem ? Number(outputItem.base_price) : 0;
          return biz.production_per_tick > 0
            ? Math.round(biz.production_per_tick * 1440 * outputBasePrice * 0.8 * 100) / 100
            : 0;
        })();
    const estimatedDailyProfit = estimatedDailyRevenue - totalDailyCost;

    // Input cost from recipe
    const dailyInputCost = recipe
      ? Number(recipe.input_cost_per_unit) * Number(recipe.estimated_daily_production)
      : 0;

    const totalInvValue = biz.inventory.reduce(
      (s, inv) => s + Number(inv.amount) * Number(inv.base_price), 0
    );

    return (
      <View>
        {/* Daily P&L Summary */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Daily Profit & Loss</Text>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Gross revenue (est.)</Text>
            <Text style={[styles.costValue, { color: '#22c55e' }]}>
              +{formatCurrency(estimatedDailyRevenue)}/day
            </Text>
          </View>
          {recipe && dailyInputCost > 0 && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Input material costs</Text>
              <Text style={[styles.costValue, { color: '#f59e0b' }]}>
                -{formatCurrency(dailyInputCost)}/day
              </Text>
            </View>
          )}
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Operating costs</Text>
            <Text style={[styles.costValue, { color: '#ef4444' }]}>
              -{formatCurrency(totalDailyCost)}/day
            </Text>
          </View>
          <View style={styles.acctDivider}>
            <Text style={[styles.costLabel, { fontWeight: '700', color: '#f9fafb' }]}>Net daily profit</Text>
            <Text style={[styles.costValue, {
              color: estimatedDailyProfit - dailyInputCost >= 0 ? '#22c55e' : '#ef4444',
              fontWeight: '800',
              fontSize: 15,
            }]}>
              {estimatedDailyProfit - dailyInputCost >= 0 ? '+' : ''}{formatCurrency(estimatedDailyProfit - dailyInputCost)}/day
            </Text>
          </View>
          {recipe && (
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Est. daily production</Text>
              <Text style={styles.costValue}>{Math.round(recipe.estimated_daily_production)} units/day</Text>
            </View>
          )}
        </Card>

        {/* Cost Breakdown */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Cost Breakdown</Text>
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Location rent</Text>
            <Text style={styles.costValue}>{formatCurrency(locationCost)}/day</Text>
          </View>
          <View style={styles.acctSubDivider}>
            <Text style={[styles.costLabel, { fontWeight: '600', color: '#d1d5db' }]}>Salaries</Text>
            <Text style={[styles.costValue, { color: '#9ca3af' }]}>{formatCurrency(totalSalaries)}/day</Text>
          </View>
          {biz.employees.map((emp) => (
            <View key={emp.id} style={[styles.costRow, { paddingLeft: 12 }]}>
              <Text style={[styles.costLabel, { fontSize: 12 }]}>{emp.name}</Text>
              <Text style={[styles.costValue, { fontSize: 12 }]}>{formatCurrency(Number(emp.salary))}/day</Text>
            </View>
          ))}
          <View style={styles.acctDivider}>
            <Text style={[styles.costLabel, { fontWeight: '700', color: '#f9fafb' }]}>Total operating costs</Text>
            <Text style={[styles.costValue, { color: '#ef4444', fontWeight: '700' }]}>
              {formatCurrency(totalDailyCost)}/day
            </Text>
          </View>
        </Card>

        {/* Production Economics */}
        {recipe && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Production Economics</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Revenue per unit</Text>
              <Text style={[styles.costValue, { color: '#22c55e' }]}>{formatCurrency(recipe.output_market_price)}</Text>
            </View>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Input cost per unit</Text>
              <Text style={[styles.costValue, { color: '#f59e0b' }]}>-{formatCurrency(recipe.input_cost_per_unit)}</Text>
            </View>
            <View style={styles.acctDivider}>
              <Text style={[styles.costLabel, { fontWeight: '700', color: '#f9fafb' }]}>Margin per unit</Text>
              <Text style={[styles.costValue, {
                color: recipe.profit_per_unit >= 0 ? '#22c55e' : '#ef4444',
                fontWeight: '800',
              }]}>
                {recipe.profit_per_unit >= 0 ? '+' : ''}{formatCurrency(recipe.profit_per_unit)}
              </Text>
            </View>
          </Card>
        )}

        {/* Inventory Value */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Inventory Value</Text>
          {biz.inventory.length === 0 ? (
            <Text style={styles.costLabel}>No inventory</Text>
          ) : (
            biz.inventory.map((inv) => (
              <View key={inv.item_id} style={styles.costRow}>
                <Text style={styles.costLabel}>{inv.item_name ?? inv.item_key} x{Math.round(Number(inv.amount))}</Text>
                <Text style={styles.costValue}>{formatCurrency(Number(inv.amount) * Number(inv.base_price))}</Text>
              </View>
            ))
          )}
          {biz.inventory.length > 0 && (
            <View style={styles.acctDivider}>
              <Text style={[styles.costLabel, { fontWeight: '700', color: '#f9fafb' }]}>Total value</Text>
              <Text style={[styles.costValue, { fontWeight: '700' }]}>{formatCurrency(totalInvValue)}</Text>
            </View>
          )}
        </Card>
      </View>
    );
  };

  const tabContent: Record<TabKey, () => React.ReactNode> = {
    overview: renderOverview,
    inventory: renderInventory,
    production: renderProduction,
    employees: renderEmployees,
    accounting: renderAccounting,
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#22c55e" colors={['#22c55e']} />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>{'<'} Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{biz.name}</Text>
        </View>

        {/* Tab Bar */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Discovery Hints Banner */}
        {bizHints.length > 0 && bizHints.map((hint) => (
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

        {/* Tab Content */}
        {tabContent[activeTab]()}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Close Business Confirm */}
      <ConfirmModal
        visible={closeConfirmVisible}
        title="Close Business"
        message={`Are you sure you want to close "${biz.name}"?\n\nYou will receive a 50% refund of the base cost. All employees will be returned to the pool.`}
        confirmLabel="Close Business"
        confirmVariant="danger"
        onConfirm={() => { closeMutation.mutate(); setCloseConfirmVisible(false); }}
        onCancel={() => setCloseConfirmVisible(false)}
        isLoading={closeMutation.isPending}
      />

      {/* Fire Employee Confirm */}
      <ConfirmModal
        visible={fireConfirmId !== null}
        title="Fire Employee"
        message={`Are you sure you want to fire ${fireTargetName}? They will be returned to the recruit pool.`}
        confirmLabel="Fire"
        confirmVariant="danger"
        onConfirm={() => { if (fireConfirmId) fireMutation.mutate(fireConfirmId); }}
        onCancel={() => setFireConfirmId(null)}
        isLoading={fireMutation.isPending}
      />

      {/* Train Modal */}
      <Modal visible={trainModalId !== null} transparent animationType="fade" onRequestClose={() => setTrainModalId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Training</Text>
            {TRAINING_TYPES.map((tt) => (
              <TouchableOpacity
                key={tt.key}
                style={styles.trainOption}
                onPress={() => {
                  if (trainModalId) trainMutation.mutate({ empId: trainModalId, type: tt.key });
                }}
                disabled={trainMutation.isPending}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.trainOptTitle}>{tt.label}</Text>
                  <Text style={styles.trainOptSub}>{tt.duration} - Cost: {tt.multiplier}</Text>
                </View>
                <Badge label={tt.key} variant={tt.key === 'basic' ? 'green' : tt.key === 'advanced' ? 'blue' : 'purple'} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setTrainModalId(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
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
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#f9fafb', flex: 1 },
  tabBar: { marginBottom: 16, flexGrow: 0 },
  tab: {
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 6,
    borderRadius: 8, backgroundColor: '#1f2937',
  },
  tabActive: { backgroundColor: '#22c55e' },
  tabText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#030712' },
  sectionCard: { marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#d1d5db', marginBottom: 10 },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  bizEmoji: { fontSize: 36 },
  bizName: { fontSize: 18, fontWeight: '800', color: '#f9fafb' },
  bizSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { width: '45%', gap: 4 },
  statLabel: { fontSize: 11, color: '#6b7280', fontWeight: '600', textTransform: 'uppercase' },
  statValue: { fontSize: 15, color: '#f9fafb', fontWeight: '700' },
  buttonRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  upgradeButton: {
    flex: 1, backgroundColor: '#22c55e', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  upgradeText: { color: '#030712', fontSize: 14, fontWeight: '700' },
  closeButton: {
    backgroundColor: '#1a0505', borderRadius: 10, borderWidth: 1,
    borderColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center',
  },
  closeText: { color: '#ef4444', fontSize: 14, fontWeight: '700' },
  storageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  storageText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  invCard: { marginBottom: 8 },
  invRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  invName: { fontSize: 14, fontWeight: '700', color: '#f9fafb' },
  invCategory: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  invAmount: { fontSize: 16, fontWeight: '800', color: '#22c55e' },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
  logDelta: { fontSize: 13, fontWeight: '700', width: 50 },
  logItem: { fontSize: 13, color: '#d1d5db', flex: 1 },
  logReason: { fontSize: 11, color: '#6b7280' },
  prodText: { fontSize: 14, color: '#9ca3af', marginBottom: 4 },
  noWorkersBanner: {
    backgroundColor: '#1a1400', borderRadius: 8, borderWidth: 1, borderColor: '#f59e0b',
    padding: 10, marginTop: 10, alignItems: 'center',
  },
  noWorkersText: { color: '#f59e0b', fontSize: 13, fontWeight: '700' },
  missingInputText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  inputName: { fontSize: 13, color: '#d1d5db', flex: 1, fontWeight: '600' },
  inputAmount: { fontSize: 13, color: '#9ca3af' },
  inputTicks: { fontSize: 11, color: '#6b7280' },
  empCard: { marginBottom: 10 },
  empHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  empName: { fontSize: 15, fontWeight: '700', color: '#f9fafb' },
  empSalary: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  empActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  trainButton: {
    flex: 1, backgroundColor: '#0c1a2e', borderRadius: 8,
    borderWidth: 1, borderColor: '#3b82f6', paddingVertical: 8, alignItems: 'center',
  },
  trainText: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },
  fireBtn: {
    backgroundColor: '#1a0505', borderRadius: 8, borderWidth: 1,
    borderColor: '#ef4444', paddingVertical: 8, paddingHorizontal: 16, alignItems: 'center',
  },
  fireBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  hireButton: {
    backgroundColor: '#22c55e', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  hireText: { color: '#030712', fontSize: 14, fontWeight: '700' },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  costLabel: { fontSize: 13, color: '#9ca3af' },
  costValue: { fontSize: 13, color: '#f9fafb', fontWeight: '600' },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalContent: {
    backgroundColor: '#111827', borderRadius: 14, padding: 24,
    width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#1f2937',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#f9fafb', marginBottom: 16 },
  trainOption: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1f2937',
    borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#374151',
  },
  trainOptTitle: { fontSize: 15, fontWeight: '700', color: '#f9fafb' },
  trainOptSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cancelBtn: {
    alignItems: 'center', paddingVertical: 12, marginTop: 4,
  },
  cancelText: { color: '#9ca3af', fontSize: 14, fontWeight: '600' },
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
  // Recipe chain visualization
  recipeChain: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#111827',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  recipeInputsCol: { flex: 1, gap: 4 },
  recipeInputItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  recipeItemQty: { fontSize: 14, fontWeight: '800' as const, color: '#f59e0b' },
  recipeItemName: { fontSize: 13, fontWeight: '600' as const, color: '#d1d5db' },
  recipeItemPrice: { fontSize: 11, color: '#6b7280' },
  recipeArrowCol: {
    paddingHorizontal: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  recipeArrowText: { fontSize: 22, color: '#4b5563', fontWeight: '800' as const },
  recipeOutputCol: { flex: 1, alignItems: 'flex-end' as const },
  recipeOutputName: { fontSize: 15, fontWeight: '800' as const, color: '#f9fafb' },
  recipeOutputPrice: { fontSize: 13, fontWeight: '700' as const, color: '#22c55e', marginTop: 2 },
  recipeProfitRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    backgroundColor: '#0a1628',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  recipeProfitLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '600' as const },
  recipeProfitValue: { fontSize: 15, fontWeight: '800' as const },
  recipeSourceHints: {
    gap: 2,
    marginBottom: 8,
  },
  recipeSourceText: { fontSize: 11, color: '#6b7280', fontStyle: 'italic' as const },
  recipeDivider: {
    height: 1,
    backgroundColor: '#1f2937',
    marginVertical: 10,
  },
  // Input status enhanced
  inputStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  inputStatusDot: {
    paddingTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  inputStatusHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 2,
  },
  lowInputText: { fontSize: 11, color: '#f59e0b', fontWeight: '600' as const },
  okInputText: { fontSize: 11, color: '#6b7280' },
  // Accounting enhanced
  acctDivider: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 8,
    marginTop: 4,
    paddingVertical: 4,
  },
  acctSubDivider: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingTop: 6,
    marginTop: 4,
    paddingVertical: 4,
  },
  // Auto-Sell toggle
  autoSellRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  autoSellLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600' as const,
  },
  autoSellToggle: {
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
  },
  autoSellToggleOn: {
    backgroundColor: '#166534',
    borderColor: '#22c55e',
  },
  autoSellToggleOff: {
    backgroundColor: '#1f2937',
    borderColor: '#374151',
  },
  autoSellToggleText: {
    fontSize: 12,
    fontWeight: '800' as const,
  },
  autoSellToggleTextOn: {
    color: '#22c55e',
  },
  autoSellToggleTextOff: {
    color: '#6b7280',
  },
  // Manager section
  mgrDescription: {
    fontSize: 13,
    color: '#9ca3af',
    marginBottom: 8,
    lineHeight: 18,
  },
  mgrCost: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#f59e0b',
    marginBottom: 12,
  },
  mgrHireButton: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  mgrHireText: {
    color: '#030712',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  mgrToggleRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  mgrToggleLabel: {
    fontSize: 13,
    color: '#9ca3af',
    fontWeight: '600' as const,
  },
  mgrRiskButton: {
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#1f2937',
  },
  mgrRiskText: {
    fontSize: 12,
    fontWeight: '800' as const,
    textTransform: 'capitalize' as const,
  },
  mgrSaveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  mgrSaveText: {
    color: '#f9fafb',
    fontSize: 14,
    fontWeight: '700' as const,
  },
  mgrFireButton: {
    alignItems: 'center' as const,
    paddingVertical: 10,
    marginTop: 4,
  },
  mgrFireText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '700' as const,
  },
  // Security section
  securityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 10,
  },
  securityIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center' as const,
  },
  securityLabelRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  securityLabel: {
    fontSize: 13,
    color: '#d1d5db',
    fontWeight: '600' as const,
  },
  securityValue: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600' as const,
  },
  securityUpgradeBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#374151',
    marginLeft: 8,
  },
  securityUpgradeText: {
    color: '#22c55e',
    fontSize: 11,
    fontWeight: '700' as const,
  },
});
