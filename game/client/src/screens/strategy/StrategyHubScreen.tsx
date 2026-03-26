import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { Card } from '../../components/ui/Card';
import type { StrategyStackParamList } from '../../navigation/StrategyStack';

type NavProp = StackNavigationProp<StrategyStackParamList, 'StrategyHub'>;

interface StrategyItem {
  key: keyof StrategyStackParamList;
  icon: string;
  title: string;
  description: string;
  color: string;
}

const ITEMS: StrategyItem[] = [
  {
    key: 'Alliance',
    icon: '\u{1F91D}',
    title: 'Alliances',
    description: 'Form syndicates, build trust, and coordinate with allies',
    color: '#22c55e',
  },
  {
    key: 'Rivalry',
    icon: '\u{2694}\uFE0F',
    title: 'Rivalries & War',
    description: 'Track rivals, execute sabotage, and manage conflicts',
    color: '#ef4444',
  },
  {
    key: 'Intelligence',
    icon: '\u{1F575}\uFE0F',
    title: 'Intelligence',
    description: 'Deploy spies, gather intel, and run counter-intelligence',
    color: '#3b82f6',
  },
  {
    key: 'Logistics',
    icon: '\u{1F69A}',
    title: 'Logistics',
    description: 'Manage shipments, routes, and set up blockades',
    color: '#f97316',
  },
  {
    key: 'Events',
    icon: '\u{1F30D}',
    title: 'World Events',
    description: 'Monitor global events affecting the economy',
    color: '#a855f7',
  },
  {
    key: 'Managers',
    icon: '\u{1F454}',
    title: 'Managers',
    description: 'Assign managers, audit for embezzlement, and track efficiency',
    color: '#06b6d4',
  },
  {
    key: 'Locations',
    icon: '\u{1F4CD}',
    title: 'Locations',
    description: 'Manage properties, upgrade locations, and transform to dual-use',
    color: '#eab308',
  },
];

export function StrategyHubScreen() {
  const navigation = useNavigation<NavProp>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Strategy</Text>
        <Text style={styles.subtitle}>Plan your empire's next move</Text>
      </View>

      {ITEMS.map((item) => (
        <TouchableOpacity
          key={item.key}
          onPress={() => navigation.navigate(item.key)}
        >
          <Card style={styles.card}>
            <View style={styles.cardRow}>
              <View style={[styles.iconBox, { backgroundColor: item.color + '15', borderColor: item.color + '40' }]}>
                <Text style={styles.icon}>{item.icon}</Text>
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc}>{item.description}</Text>
              </View>
              <Text style={styles.chevron}>{'\u{203A}'}</Text>
            </View>
          </Card>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  card: { marginBottom: 10 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginRight: 14 },
  icon: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#f9fafb', marginBottom: 3 },
  cardDesc: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
  chevron: { fontSize: 24, color: '#4b5563', marginLeft: 8 },
});
