import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Pressable,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ProgressBar } from '../components/ui/ProgressBar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { formatCurrency } from '../components/ui/CurrencyText';

// ─── Types ─────────────────────────────────────────

interface Business {
  id: string;
  name: string;
  type: string;
  tier: number;
  status: string;
  efficiency: number;
  location_name: string;
  location_traffic: number;
  output_item_name: string | null;
  employee_count: number;
  total_inventory: number;
  storage_cap?: number;
}

interface Location {
  id: string;
  name: string;
  type: string;
  zone: string;
  price: number;
  traffic: number;
  daily_cost: number;
}

interface Recipe {
  id: string;
  business_type: string;
  output_item_key: string;
  output_item_name: string;
  base_rate: string;
  cycle_minutes: number;
}

// ─── Business cost constants (mirrored from server config) ─────

const BUSINESS_COSTS: Record<string, { cost: number; emoji: string }> = {
  SHOP:    { cost: 8000,  emoji: '\u{1F3EA}' },
  FACTORY: { cost: 15000, emoji: '\u{1F3ED}' },
  MINE:    { cost: 12000, emoji: '\u{26CF}\u{FE0F}' },
};

type BizType = 'SHOP' | 'FACTORY' | 'MINE';

// ─── Component ─────────────────────────────────────

export function BusinessListScreen() {
  const queryClient = useQueryClient();
  const { show } = useToast();

  // Wizard state
  const [wizardVisible, setWizardVisible] = useState(false);
  const [wizardStep, setWizardStep] = useState<'location' | 'type' | 'recipe' | 'confirm'>('location');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [selectedType, setSelectedType] = useState<BizType | null>(null);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);

  // Queries
  const { data: businesses, isLoading, refetch, isRefetching } = useQuery<Business[]>({
    queryKey: ['businesses'],
    queryFn: () => api.get<Business[]>('/businesses'),
    refetchInterval: 30000,
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => api.get<Location[]>('/locations'),
    enabled: wizardVisible,
  });

  const { data: recipes } = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: () => api.get<Recipe[]>('/businesses/recipes'),
    enabled: wizardVisible,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (body: { type: string; name: string; location_id: string; recipe_id?: string }) =>
      api.post('/businesses', body),
    onSuccess: () => {
      show('Business created!', 'success');
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      closeWizard();
    },
    onError: (err: Error) => {
      show(err.message || 'Failed to create business', 'error');
    },
  });

  const closeWizard = () => {
    setWizardVisible(false);
    setWizardStep('location');
    setSelectedLocation(null);
    setSelectedType(null);
    setSelectedRecipe(null);
    setConfirmVisible(false);
  };

  const openWizard = () => {
    setWizardVisible(true);
    setWizardStep('location');
  };

  const handleLocationSelect = (loc: Location) => {
    setSelectedLocation(loc);
    setWizardStep('type');
  };

  const handleTypeSelect = (type: BizType) => {
    setSelectedType(type);
    if (type === 'FACTORY') {
      setWizardStep('recipe');
    } else {
      setWizardStep('confirm');
      setConfirmVisible(true);
    }
  };

  const handleRecipeSelect = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setWizardStep('confirm');
    setConfirmVisible(true);
  };

  const handleConfirmCreate = async () => {
    if (!selectedLocation || !selectedType) return;

    const name = `${selectedLocation.name} ${selectedType.charAt(0) + selectedType.slice(1).toLowerCase()}`;

    createMutation.mutate({
      type: selectedType,
      name,
      location_id: selectedLocation.id,
      recipe_id: selectedType === 'FACTORY' && selectedRecipe ? selectedRecipe.id : undefined,
    });
  };

  const nav = useNavigation<any>();
  const handleBusinessTap = (biz: Business) => {
    nav.navigate('BusinessDetail', { businessId: biz.id });
  };

  if (isLoading) {
    return <LoadingScreen message="Loading businesses..." />;
  }

  const totalCost = selectedType && selectedLocation
    ? BUSINESS_COSTS[selectedType].cost + Number(selectedLocation.price)
    : 0;

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
        <Text style={styles.title}>Businesses</Text>

        {(!businesses || businesses.length === 0) ? (
          <EmptyState
            icon="\u{1F3ED}"
            title="No businesses yet"
            subtitle="Buy your first business to start building your empire!"
            action={
              <TouchableOpacity style={styles.ctaButton} onPress={openWizard}>
                <Text style={styles.ctaText}>Buy Your First Business</Text>
              </TouchableOpacity>
            }
          />
        ) : (
          businesses.map((biz) => {
            // Storage cap: estimate from tier if not in the response (100 * tier^2)
            const storageCap = biz.storage_cap ?? (100 * biz.tier * biz.tier);
            const totalInv = Number(biz.total_inventory);
            const storageRatio = storageCap > 0 ? totalInv / storageCap : 0;
            const storageColor = storageRatio > 0.9 ? '#ef4444' : storageRatio > 0.6 ? '#f59e0b' : '#22c55e';
            const isIdle = biz.status === 'idle';
            const noWorkers = biz.employee_count === 0;

            return (
              <TouchableOpacity key={biz.id} onPress={() => handleBusinessTap(biz)} activeOpacity={0.7}>
                <Card style={styles.bizCard}>
                  <View style={styles.bizHeader}>
                    <Text style={styles.bizEmoji}>{BUSINESS_COSTS[biz.type]?.emoji ?? '\u{1F3E2}'}</Text>
                    <View style={styles.bizInfo}>
                      <Text style={styles.bizName}>{biz.name}</Text>
                      <Text style={styles.bizLocation}>{biz.location_name}</Text>
                    </View>
                    <View style={styles.bizBadges}>
                      <Badge label={biz.type} variant="blue" />
                      <Badge label={`T${biz.tier}`} variant="purple" />
                      {isIdle && <Badge label="IDLE" variant="orange" />}
                    </View>
                  </View>
                  <View style={styles.bizFooter}>
                    {noWorkers ? (
                      <Text style={styles.bizStatWarning}>No workers</Text>
                    ) : (
                      <Text style={styles.bizStat}>
                        {biz.employee_count} employees
                      </Text>
                    )}
                    <Text style={styles.bizStat}>
                      {Math.round(totalInv)}/{storageCap} items
                    </Text>
                    {biz.output_item_name && (
                      <Text style={styles.bizStat}>
                        Produces: {biz.output_item_name}
                      </Text>
                    )}
                  </View>
                  <View style={styles.bizStorageRow}>
                    <ProgressBar
                      progress={storageRatio}
                      color={storageColor}
                      height={4}
                    />
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.footer} />
      </ScrollView>

      {/* FAB */}
      {businesses && businesses.length > 0 && (
        <TouchableOpacity style={styles.fab} onPress={openWizard} activeOpacity={0.8}>
          <Text style={styles.fabText}>+ New Business</Text>
        </TouchableOpacity>
      )}

      {/* Wizard Modal */}
      <Modal visible={wizardVisible} transparent animationType="slide" onRequestClose={closeWizard}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {wizardStep === 'location' && 'Select Location'}
                {wizardStep === 'type' && 'Select Business Type'}
                {wizardStep === 'recipe' && 'Select Recipe'}
                {wizardStep === 'confirm' && 'Confirm Purchase'}
              </Text>
              <TouchableOpacity onPress={closeWizard} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={styles.modalClose}>{'\u2715'}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* Step 1: Location */}
              {wizardStep === 'location' && (
                <>
                  {locations?.map((loc) => (
                    <TouchableOpacity
                      key={loc.id}
                      style={styles.optionCard}
                      onPress={() => handleLocationSelect(loc)}
                    >
                      <View style={styles.optionHeader}>
                        <Text style={styles.optionName}>{loc.name}</Text>
                        <Text style={styles.optionPrice}>{formatCurrency(Number(loc.price))}</Text>
                      </View>
                      <View style={styles.optionMeta}>
                        <Badge label={loc.zone} variant="gray" />
                        <Text style={styles.optionStat}>Traffic: {loc.traffic}</Text>
                        <Text style={styles.optionStat}>Type: {loc.type}</Text>
                      </View>
                    </TouchableOpacity>
                  )) ?? (
                    <Text style={styles.loadingText}>Loading locations...</Text>
                  )}
                </>
              )}

              {/* Step 2: Type */}
              {wizardStep === 'type' && (
                <>
                  {(Object.entries(BUSINESS_COSTS) as [BizType, { cost: number; emoji: string }][]).map(
                    ([type, info]) => (
                      <TouchableOpacity
                        key={type}
                        style={styles.optionCard}
                        onPress={() => handleTypeSelect(type)}
                      >
                        <View style={styles.optionHeader}>
                          <Text style={styles.optionName}>
                            {info.emoji} {type}
                          </Text>
                          <Text style={styles.optionPrice}>{formatCurrency(info.cost)}</Text>
                        </View>
                        <Text style={styles.optionDesc}>
                          {type === 'SHOP' && 'Sells finished goods to customers'}
                          {type === 'FACTORY' && 'Processes raw materials into products'}
                          {type === 'MINE' && 'Extracts ore from the ground'}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setWizardStep('location')}
                  >
                    <Text style={styles.backText}>Back to locations</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Step 3: Recipe (FACTORY only) */}
              {wizardStep === 'recipe' && (
                <>
                  {recipes
                    ?.filter((r) => r.business_type === 'FACTORY')
                    .map((recipe) => (
                      <TouchableOpacity
                        key={recipe.id}
                        style={styles.optionCard}
                        onPress={() => handleRecipeSelect(recipe)}
                      >
                        <View style={styles.optionHeader}>
                          <Text style={styles.optionName}>
                            {recipe.output_item_name}
                          </Text>
                          <Text style={styles.optionPrice}>
                            {recipe.base_rate}/tick
                          </Text>
                        </View>
                        <Text style={styles.optionDesc}>
                          Produces {recipe.output_item_name} every {recipe.cycle_minutes}min
                        </Text>
                      </TouchableOpacity>
                    )) ?? (
                    <Text style={styles.loadingText}>Loading recipes...</Text>
                  )}
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => setWizardStep('type')}
                  >
                    <Text style={styles.backText}>Back to types</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Confirm Modal */}
      <ConfirmModal
        visible={confirmVisible}
        title="Create Business"
        message={
          selectedType && selectedLocation
            ? `Create a ${selectedType} at ${selectedLocation.name}?\n\nBusiness: ${formatCurrency(BUSINESS_COSTS[selectedType]?.cost ?? 0)}\nLocation: ${formatCurrency(Number(selectedLocation.price))}\nTotal: ${formatCurrency(totalCost)}`
            : ''
        }
        confirmLabel="Buy"
        onConfirm={handleConfirmCreate}
        onCancel={() => {
          setConfirmVisible(false);
          setWizardStep(selectedType === 'FACTORY' ? 'recipe' : 'type');
        }}
        isLoading={createMutation.isPending}
      />
    </View>
  );
}

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
    marginBottom: 16,
  },
  bizCard: {
    marginBottom: 10,
  },
  bizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bizEmoji: {
    fontSize: 28,
  },
  bizInfo: {
    flex: 1,
  },
  bizName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  bizLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  bizBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  bizFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  bizStat: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  bizStatWarning: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '700',
  },
  bizStorageRow: {
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#22c55e',
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  fabText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#030712',
  },
  ctaButton: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#030712',
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderBottomWidth: 0,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#f9fafb',
  },
  modalClose: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: '700',
    padding: 4,
  },
  modalScroll: {
    padding: 16,
    maxHeight: 500,
  },
  optionCard: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#374151',
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#22c55e',
  },
  optionMeta: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  optionStat: {
    fontSize: 12,
    color: '#9ca3af',
  },
  optionDesc: {
    fontSize: 13,
    color: '#9ca3af',
    marginTop: 2,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  backText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  footer: {
    height: 80,
  },
});
