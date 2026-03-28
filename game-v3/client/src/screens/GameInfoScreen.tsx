import React from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { formatCurrency } from '../components/ui/CurrencyText';

// ─── Types ─────────────────────────────────────────

interface UpgradeCost {
  tier: number;
  cost: number;
  storageCap: number;
  maxEmployees: number;
}

interface BusinessType {
  key: string;
  cost: number;
  dailyCost: number;
  category: string;
  emoji: string;
  upgradeCosts: UpgradeCost[];
}

interface Item {
  key: string;
  name: string;
  basePrice: number;
  category: string;
  stage: number;
}

interface RecipeInput {
  item: string;
  name: string;
  basePrice: number;
  qtyPerUnit: number;
}

interface Recipe {
  businessType: string;
  outputItem: string;
  outputName: string;
  outputPrice: number;
  baseRate: number;
  cycleMinutes: number;
  inputs: RecipeInput[];
  profitPerUnit: number;
}

interface ChainStep {
  business: string;
  consumes?: string;
  produces: string;
  emoji: string;
}

interface ProductionChain {
  name: string;
  steps: ChainStep[];
  finalValue: number;
  inputCost: number;
  profitPerUnit: number;
}

interface Location {
  name: string;
  type: string;
  zone: string;
  price: number;
  dailyCost: number;
  traffic: number;
  visibility: number;
  storage: number;
}

interface EmployeeTier {
  tier: string;
  weight: number;
  efficiencyRange: number[];
  salaryRange: number[];
}

interface TrainingType {
  type: string;
  durationMinutes: number;
  costMultiplier: number;
  maxStatGain: number;
}

interface AutosellInfo {
  priceModifier: number;
  demandFactor: number;
  description: string;
}

interface CurrentPrice {
  key: string;
  name: string;
  base_price: string;
  current_price: string;
}

interface GameInfoData {
  businessTypes: BusinessType[];
  items: Item[];
  recipes: Recipe[];
  productionChains: ProductionChain[];
  locations: Location[];
  employeeTiers: EmployeeTier[];
  trainingTypes: TrainingType[];
  autosell: AutosellInfo;
  tips: string[];
  currentPrices: CurrentPrice[];
}

// ─── Component ─────────────────────────────────────

export function GameInfoScreen() {
  const { data, isLoading, refetch, isRefetching } = useQuery<GameInfoData>({
    queryKey: ['game-info'],
    queryFn: () => api.get<GameInfoData>('/game/info'),
  });

  if (isLoading) {
    return <LoadingScreen message="Loading game info..." />;
  }

  if (!data) {
    return (
      <View style={styles.container}>
        <View style={styles.errorCenter}>
          <Text style={styles.errorText}>Failed to load game info</Text>
        </View>
      </View>
    );
  }

  const {
    tips,
    productionChains,
    recipes,
    currentPrices,
    businessTypes,
    locations,
    employeeTiers,
    trainingTypes,
  } = data;

  // Sort locations by price ascending
  const sortedLocations = [...locations].sort((a, b) => a.price - b.price);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor="#22c55e"
            colors={['#22c55e']}
          />
        }
      >
        <Text style={styles.title}>Game Wiki</Text>
        <Text style={styles.subtitle}>
          Everything you need to build your empire
        </Text>

        {/* ─── Tips ─────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Tips</Text>
        {tips.map((tip, i) => (
          <View key={i} style={styles.tipCard}>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}

        {/* ─── Production Chains ────────────────────── */}
        <Text style={styles.sectionHeader}>Production Chains</Text>
        {productionChains.map((chain) => (
          <View key={chain.name} style={styles.card}>
            <Text style={styles.cardTitle}>{chain.name}</Text>
            <View style={styles.chainSteps}>
              {chain.steps.map((step, i) => (
                <View key={i} style={styles.chainStepRow}>
                  {i > 0 && <Text style={styles.chainArrow}>{'\u2192'}</Text>}
                  <View style={styles.chainStep}>
                    <Text style={styles.chainEmoji}>{step.emoji}</Text>
                    <Text style={styles.chainBiz}>{step.business.toUpperCase()}</Text>
                    <Text style={styles.chainProduces}>{step.produces}</Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.chainSummary}>
              <View style={styles.chainStat}>
                <Text style={styles.chainStatLabel}>Input Cost</Text>
                <Text style={styles.chainStatValue}>
                  {formatCurrency(chain.inputCost)}
                </Text>
              </View>
              <View style={styles.chainStat}>
                <Text style={styles.chainStatLabel}>Final Value</Text>
                <Text style={[styles.chainStatValue, { color: '#f9fafb' }]}>
                  {formatCurrency(chain.finalValue)}
                </Text>
              </View>
              <View style={styles.chainStat}>
                <Text style={styles.chainStatLabel}>Profit</Text>
                <Text style={[styles.chainStatValue, { color: '#22c55e' }]}>
                  {formatCurrency(chain.profitPerUnit)}
                </Text>
              </View>
            </View>
          </View>
        ))}

        {/* ─── Recipes ──────────────────────────────── */}
        <Text style={styles.sectionHeader}>Recipes</Text>
        {recipes.map((recipe) => (
          <View key={`${recipe.businessType}-${recipe.outputItem}`} style={styles.card}>
            <View style={styles.recipeHeader}>
              <Text style={styles.cardTitle}>{recipe.outputName}</Text>
              <Text style={[styles.profitBadge, recipe.profitPerUnit >= 0 ? styles.profitPositive : styles.profitNegative]}>
                {recipe.profitPerUnit >= 0 ? '+' : ''}{formatCurrency(recipe.profitPerUnit)}
              </Text>
            </View>
            <Text style={styles.recipeSubtext}>
              {recipe.businessType.toUpperCase()} | {recipe.cycleMinutes}min cycle | {formatCurrency(recipe.outputPrice)}/unit
            </Text>
            {recipe.inputs.length > 0 && (
              <View style={styles.recipeInputs}>
                <Text style={styles.recipeInputLabel}>Inputs:</Text>
                {recipe.inputs.map((input, i) => (
                  <Text key={i} style={styles.recipeInputItem}>
                    {input.qtyPerUnit}x {input.name} ({formatCurrency(input.basePrice)})
                  </Text>
                ))}
              </View>
            )}
            {recipe.inputs.length === 0 && (
              <Text style={styles.recipeNoInputs}>No inputs required (raw production)</Text>
            )}
          </View>
        ))}

        {/* ─── Market Prices ────────────────────────── */}
        <Text style={styles.sectionHeader}>Market Prices</Text>
        {currentPrices.map((price) => {
          const base = Number(price.base_price);
          const current = Number(price.current_price);
          const diff = current - base;
          const pct = base > 0 ? ((diff / base) * 100).toFixed(1) : '0.0';
          const isUp = diff > 0.01;
          const isDown = diff < -0.01;
          const trendColor = isUp ? '#22c55e' : isDown ? '#ef4444' : '#6b7280';
          const trendSymbol = isUp ? '\u2191' : isDown ? '\u2193' : '\u2192';

          return (
            <View key={price.key} style={styles.priceRow}>
              <View style={styles.priceLeft}>
                <Text style={styles.priceName}>{price.name}</Text>
                <Text style={styles.priceBase}>Base: {formatCurrency(base)}</Text>
              </View>
              <View style={styles.priceRight}>
                <Text style={[styles.priceCurrent, { color: trendColor }]}>
                  {trendSymbol} {formatCurrency(current)}
                </Text>
                <Text style={[styles.pricePct, { color: trendColor }]}>
                  {isUp ? '+' : ''}{pct}%
                </Text>
              </View>
            </View>
          );
        })}

        {/* ─── Business Types ───────────────────────── */}
        <Text style={styles.sectionHeader}>Business Types</Text>
        {businessTypes.map((biz) => (
          <View key={biz.key} style={styles.card}>
            <View style={styles.bizTypeHeader}>
              <Text style={styles.bizTypeEmoji}>{biz.emoji}</Text>
              <View style={styles.bizTypeInfo}>
                <Text style={styles.cardTitle}>{biz.key.toUpperCase()}</Text>
                <Text style={styles.bizTypeCategory}>{biz.category}</Text>
              </View>
              <View style={styles.bizTypeCost}>
                <Text style={styles.bizTypeCostValue}>{formatCurrency(biz.cost)}</Text>
                <Text style={styles.bizTypeDailyCost}>{formatCurrency(biz.dailyCost)}/day</Text>
              </View>
            </View>
            {biz.upgradeCosts.length > 0 && (
              <View style={styles.upgradeTable}>
                <View style={styles.upgradeHeaderRow}>
                  <Text style={[styles.upgradeHeaderCell, { flex: 0.7 }]}>Tier</Text>
                  <Text style={[styles.upgradeHeaderCell, { flex: 1.3 }]}>Cost</Text>
                  <Text style={[styles.upgradeHeaderCell, { flex: 1 }]}>Storage</Text>
                  <Text style={[styles.upgradeHeaderCell, { flex: 1 }]}>Emp.</Text>
                </View>
                {biz.upgradeCosts.map((uc) => (
                  <View key={uc.tier} style={styles.upgradeRow}>
                    <Text style={[styles.upgradeCell, { flex: 0.7 }]}>T{uc.tier}</Text>
                    <Text style={[styles.upgradeCell, { flex: 1.3 }]}>{formatCurrency(uc.cost)}</Text>
                    <Text style={[styles.upgradeCell, { flex: 1 }]}>{uc.storageCap}</Text>
                    <Text style={[styles.upgradeCell, { flex: 1 }]}>{uc.maxEmployees}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* ─── Locations ────────────────────────────── */}
        <Text style={styles.sectionHeader}>Locations</Text>
        {sortedLocations.map((loc) => (
          <View key={loc.name} style={styles.card}>
            <View style={styles.locHeader}>
              <View style={styles.locInfo}>
                <Text style={styles.cardTitle}>{loc.name}</Text>
                <Text style={styles.locZone}>{loc.zone} zone | {loc.type}</Text>
              </View>
              <Text style={styles.locPrice}>{formatCurrency(loc.price)}</Text>
            </View>
            <View style={styles.locStats}>
              <View style={styles.locStat}>
                <Text style={styles.locStatValue}>{formatCurrency(loc.dailyCost)}</Text>
                <Text style={styles.locStatLabel}>Daily</Text>
              </View>
              <View style={styles.locStat}>
                <Text style={styles.locStatValue}>{loc.traffic}</Text>
                <Text style={styles.locStatLabel}>Traffic</Text>
              </View>
              <View style={styles.locStat}>
                <Text style={styles.locStatValue}>{loc.visibility}</Text>
                <Text style={styles.locStatLabel}>Visibility</Text>
              </View>
              <View style={styles.locStat}>
                <Text style={styles.locStatValue}>{loc.storage}</Text>
                <Text style={styles.locStatLabel}>Storage</Text>
              </View>
            </View>
          </View>
        ))}

        {/* ─── Employee Tiers ───────────────────────── */}
        <Text style={styles.sectionHeader}>Employee Tiers</Text>
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Tier</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Efficiency</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Salary</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Avail.</Text>
          </View>
          {employeeTiers.map((tier) => {
            const totalWeight = employeeTiers.reduce((s, t) => s + t.weight, 0);
            const pct = totalWeight > 0 ? ((tier.weight / totalWeight) * 100).toFixed(0) : '0';

            return (
              <View key={tier.tier} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableCellBold, { flex: 1 }]}>
                  {tier.tier}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.3 }]}>
                  {tier.efficiencyRange[0]}-{tier.efficiencyRange[1]}%
                </Text>
                <Text style={[styles.tableCell, { flex: 1.3 }]}>
                  {formatCurrency(tier.salaryRange[0])}-{formatCurrency(tier.salaryRange[1])}
                </Text>
                <Text style={[styles.tableCell, { flex: 0.8, color: '#22c55e' }]}>
                  {pct}%
                </Text>
              </View>
            );
          })}
        </View>

        {/* ─── Training ─────────────────────────────── */}
        <Text style={styles.sectionHeader}>Training</Text>
        <View style={styles.card}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Type</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Duration</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Cost</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8 }]}>Max Gain</Text>
          </View>
          {trainingTypes.map((t) => {
            const hours = t.durationMinutes >= 60
              ? `${(t.durationMinutes / 60).toFixed(0)}h`
              : `${t.durationMinutes}m`;

            return (
              <View key={t.type} style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableCellBold, { flex: 1.2 }]}>
                  {t.type}
                </Text>
                <Text style={[styles.tableCell, { flex: 1 }]}>{hours}</Text>
                <Text style={[styles.tableCell, { flex: 0.8 }]}>{t.costMultiplier}x</Text>
                <Text style={[styles.tableCell, { flex: 0.8, color: '#22c55e' }]}>
                  +{t.maxStatGain}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 52,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f9fafb',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 20,
  },
  errorCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },

  // ─── Section Headers ───────────────────────────

  sectionHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: '#d1d5db',
    marginTop: 24,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },

  // ─── Tips ──────────────────────────────────────

  tipCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
    borderLeftWidth: 3,
  },
  tipText: {
    fontSize: 14,
    color: '#d1d5db',
    lineHeight: 20,
  },

  // ─── Generic Card ──────────────────────────────

  card: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },

  // ─── Production Chains ─────────────────────────

  chainSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
    gap: 4,
  },
  chainStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chainArrow: {
    fontSize: 16,
    color: '#6b7280',
    marginHorizontal: 2,
  },
  chainStep: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  chainEmoji: {
    fontSize: 18,
  },
  chainBiz: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9ca3af',
    marginTop: 2,
  },
  chainProduces: {
    fontSize: 11,
    color: '#d1d5db',
    marginTop: 2,
    fontWeight: '600',
  },
  chainSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  chainStat: {
    alignItems: 'center',
  },
  chainStatLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  chainStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9ca3af',
    marginTop: 2,
  },

  // ─── Recipes ───────────────────────────────────

  recipeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recipeSubtext: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  recipeInputs: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  recipeInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    marginBottom: 4,
  },
  recipeInputItem: {
    fontSize: 13,
    color: '#d1d5db',
    marginLeft: 8,
    marginTop: 2,
  },
  recipeNoInputs: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
  },
  profitBadge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  profitPositive: {
    color: '#22c55e',
    backgroundColor: '#052e16',
  },
  profitNegative: {
    color: '#ef4444',
    backgroundColor: '#1a0505',
  },

  // ─── Market Prices ─────────────────────────────

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  priceLeft: {
    flex: 1,
  },
  priceName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },
  priceBase: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  priceRight: {
    alignItems: 'flex-end',
  },
  priceCurrent: {
    fontSize: 14,
    fontWeight: '700',
  },
  pricePct: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },

  // ─── Business Types ────────────────────────────

  bizTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bizTypeEmoji: {
    fontSize: 28,
  },
  bizTypeInfo: {
    flex: 1,
  },
  bizTypeCategory: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  bizTypeCost: {
    alignItems: 'flex-end',
  },
  bizTypeCostValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f9fafb',
  },
  bizTypeDailyCost: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  upgradeTable: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  upgradeHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  upgradeHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  upgradeRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  upgradeCell: {
    fontSize: 13,
    color: '#d1d5db',
  },

  // ─── Locations ─────────────────────────────────

  locHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  locInfo: {
    flex: 1,
  },
  locZone: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  locPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  locStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
  },
  locStat: {
    alignItems: 'center',
    flex: 1,
  },
  locStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#d1d5db',
  },
  locStatLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
  },

  // ─── Tables (Employee Tiers & Training) ────────

  tableHeaderRow: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  tableCell: {
    fontSize: 13,
    color: '#d1d5db',
  },
  tableCellBold: {
    fontWeight: '700',
    color: '#f9fafb',
  },
});
