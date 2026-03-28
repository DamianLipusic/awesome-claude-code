import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../lib/api';
import { useMarketStore } from '../../stores/marketStore';
import { Card } from '../../components/ui/Card';
import { formatCurrency } from '../../components/ui/CurrencyText';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import type { Resource } from '@economy-game/shared';
import { useToast } from '../../components/Toast';

type Duration = '24h' | '72h' | '7d';

const DURATIONS: Array<{ label: string; value: Duration; hours: number }> = [
  { label: '24 Hours', value: '24h', hours: 24 },
  { label: '3 Days', value: '72h', hours: 72 },
  { label: '7 Days', value: '7d', hours: 168 },
];

export function CreateListingScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { selectedCity } = useMarketStore();

  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState<Duration>('24h');
  const [bulkMin, setBulkMin] = useState(false);
  const [bulkMinQty, setBulkMinQty] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [showResourcePicker, setShowResourcePicker] = useState(false);

  // Load available resources
  const { data: resources, isLoading } = useQuery<Resource[]>({
    queryKey: ['market', 'resources'],
    queryFn: () => api.get<Resource[]>('/market/resources'),
  });

  const createMutation = useMutation({
    mutationFn: (payload: unknown) => api.post('/market/listings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['player', 'inventory'] });
      toast.show('Listing created and posted to the market!', 'success');
      navigation.goBack();
    },
    onError: (err) => {
      toast.show(err instanceof Error ? err.message : 'Failed to create listing', 'error');
    },
  });

  const qtyNum = parseInt(quantity, 10);
  const priceNum = parseFloat(price);
  const durationHours = DURATIONS.find((d) => d.value === duration)?.hours ?? 24;

  const listingFee = (() => {
    if (!priceNum || !qtyNum) return 0;
    const base = priceNum * qtyNum * 0.05;
    const anonExtra = anonymous ? priceNum * qtyNum * 0.01 : 0;
    return base + anonExtra;
  })();

  const youReceive = priceNum && qtyNum ? priceNum * qtyNum - listingFee : 0;

  const canSubmit =
    selectedResource &&
    qtyNum > 0 &&
    priceNum > 0 &&
    !createMutation.isPending;

  const handleSubmit = () => {
    if (!canSubmit || !selectedResource) return;

    createMutation.mutate({
      resource_id: selectedResource.id,
      city: selectedCity,
      listing_type: 'PLAYER_SELL',
      quantity: qtyNum,
      price_per_unit: priceNum,
      duration_hours: durationHours,
      min_quantity: bulkMin ? parseInt(bulkMinQty, 10) || 1 : 1,
      is_anonymous: anonymous,
    });
  };

  if (isLoading) {
    return <LoadingScreen message="Loading inventory..." />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Resource Picker */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Resource</Text>
        <TouchableOpacity
          style={styles.pickerButton}
          onPress={() => setShowResourcePicker(!showResourcePicker)}
        >
          <Text style={styles.pickerButtonText}>
            {selectedResource
              ? `${selectedResource.name} (${formatCurrency(selectedResource.current_ai_price)}/unit)`
              : 'Select a resource...'}
          </Text>
          <Text style={styles.pickerChevron}>{showResourcePicker ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showResourcePicker && (
          <View style={styles.dropdownContainer}>
            {(resources ?? []).length === 0 ? (
              <Text style={styles.emptyPicker}>No resources available</Text>
            ) : (
              (resources ?? []).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.dropdownItem,
                    selectedResource?.id === item.id &&
                      styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedResource(item);
                    setShowResourcePicker(false);
                  }}
                >
                  <Text style={styles.dropdownItemName}>{item.name}</Text>
                  <Text style={styles.dropdownItemQty}>{formatCurrency(item.current_ai_price)}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </Card>

      {/* Quantity */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Quantity</Text>
        <TextInput
          style={styles.input}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#4b5563"
        />
        {selectedResource && (
          <Text style={styles.maxHint}>
            AI Price: {formatCurrency(selectedResource.current_ai_price)}/unit
          </Text>
        )}
      </Card>

      {/* Price */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Price per Unit</Text>
        {selectedResource && (
          <Text style={styles.referencePrice}>
            AI Price: {formatCurrency(selectedResource.current_ai_price)}
          </Text>
        )}
        <TextInput
          style={styles.input}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#4b5563"
        />
      </Card>

      {/* Duration */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Listing Duration</Text>
        <View style={styles.durationRow}>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d.value}
              style={[
                styles.durationBtn,
                duration === d.value && styles.durationBtnActive,
              ]}
              onPress={() => setDuration(d.value)}
            >
              <Text
                style={[
                  styles.durationBtnText,
                  duration === d.value && styles.durationBtnTextActive,
                ]}
              >
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Options */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Options</Text>

        <View style={styles.optionRow}>
          <View style={styles.optionLabel}>
            <Text style={styles.optionText}>Bulk Minimum</Text>
            <Text style={styles.optionHint}>Require buyers to purchase in bulk</Text>
          </View>
          <Switch
            value={bulkMin}
            onValueChange={setBulkMin}
            trackColor={{ false: '#1f2937', true: '#166534' }}
            thumbColor={bulkMin ? '#22c55e' : '#6b7280'}
          />
        </View>

        {bulkMin && (
          <TextInput
            style={[styles.input, styles.bulkInput]}
            value={bulkMinQty}
            onChangeText={setBulkMinQty}
            keyboardType="numeric"
            placeholder="Minimum quantity"
            placeholderTextColor="#4b5563"
          />
        )}

        <View style={[styles.optionRow, styles.optionRowLast]}>
          <View style={styles.optionLabel}>
            <Text style={styles.optionText}>Anonymous Listing (+1% fee)</Text>
            <Text style={styles.optionHint}>Hide your username from the listing</Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            trackColor={{ false: '#1f2937', true: '#166534' }}
            thumbColor={anonymous ? '#22c55e' : '#6b7280'}
          />
        </View>
      </Card>

      {/* Summary */}
      {priceNum > 0 && qtyNum > 0 && (
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Value</Text>
            <Text style={styles.summaryValue}>{formatCurrency(priceNum * qtyNum)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>
              Listing Fee ({anonymous ? '6%' : '5%'})
            </Text>
            <Text style={styles.summaryFee}>-{formatCurrency(listingFee)}</Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>You Receive</Text>
            <Text style={styles.summaryTotalValue}>{formatCurrency(youReceive)}</Text>
          </View>
        </Card>
      )}

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        <Text style={styles.submitBtnText}>
          {createMutation.isPending ? 'Creating...' : 'Create Listing'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  section: { marginBottom: 0 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#f9fafb',
  },
  maxHint: {
    color: '#3b82f6',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },
  referencePrice: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  pickerButton: {
    backgroundColor: '#030712',
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    color: '#f9fafb',
    fontSize: 15,
    flex: 1,
  },
  pickerChevron: {
    color: '#6b7280',
    fontSize: 12,
  },
  dropdownContainer: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  dropdownItemSelected: {
    backgroundColor: '#052e16',
  },
  dropdownItemName: {
    color: '#f9fafb',
    fontSize: 14,
  },
  dropdownItemQty: {
    color: '#6b7280',
    fontSize: 13,
  },
  emptyPicker: {
    padding: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
  },
  durationBtnActive: {
    backgroundColor: '#052e16',
    borderColor: '#22c55e',
  },
  durationBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  durationBtnTextActive: {
    color: '#22c55e',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
  },
  optionRowLast: {
    borderBottomWidth: 0,
  },
  optionLabel: {
    flex: 1,
    marginRight: 12,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d1d5db',
  },
  optionHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  bulkInput: {
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#9ca3af',
  },
  summaryValue: {
    fontSize: 14,
    color: '#f9fafb',
    fontWeight: '600',
  },
  summaryFee: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    marginTop: 4,
    paddingTop: 10,
  },
  summaryTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#f9fafb',
  },
  summaryTotalValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#22c55e',
  },
  submitBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.4,
  },
  submitBtnText: {
    color: '#030712',
    fontSize: 16,
    fontWeight: '800',
  },
});
