import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { LoadingSkeleton } from '../../components/ui/LoadingScreen';
import { EmptyState } from '../../components/ui/EmptyState';

type EventCategory = 'MARKET_CRASH' | 'SUPPLY_SURGE' | 'POLICE_CRACKDOWN' | 'EMPLOYEE_STRIKE' | 'RIVAL_COLLAPSE' | 'DISASTER' | 'POLITICAL' | 'BOOM';

const CATEGORY_ICONS: Record<EventCategory, string> = {
  MARKET_CRASH: '\u{1F4C9}',
  SUPPLY_SURGE: '\u{1F4E6}',
  POLICE_CRACKDOWN: '\u{1F694}',
  EMPLOYEE_STRIKE: '\u{270A}',
  RIVAL_COLLAPSE: '\u{1F480}',
  DISASTER: '\u{1F32A}\uFE0F',
  POLITICAL: '\u{1F3DB}\uFE0F',
  BOOM: '\u{1F680}',
};

const CATEGORY_LABELS: Record<EventCategory, string> = {
  MARKET_CRASH: 'Market Crash',
  SUPPLY_SURGE: 'Supply Surge',
  POLICE_CRACKDOWN: 'Police Crackdown',
  EMPLOYEE_STRIKE: 'Employee Strike',
  RIVAL_COLLAPSE: 'Rival Collapse',
  DISASTER: 'Disaster',
  POLITICAL: 'Political',
  BOOM: 'Boom',
};

interface GameEvent {
  id: string;
  category: EventCategory;
  title: string;
  description: string;
  magnitude: number;
  active: boolean;
  started_at: string;
  ends_at: string;
  time_remaining_seconds?: number;
}

function MagnitudeBar({ magnitude }: { magnitude: number }) {
  const color = magnitude > 70 ? '#ef4444' : magnitude > 40 ? '#eab308' : '#22c55e';
  const label = magnitude > 70 ? 'Severe' : magnitude > 40 ? 'Moderate' : 'Mild';

  return (
    <View style={magStyles.container}>
      <View style={magStyles.labelRow}>
        <Text style={magStyles.label}>Impact</Text>
        <Text style={[magStyles.severity, { color }]}>{label}</Text>
      </View>
      <View style={magStyles.track}>
        <View style={[magStyles.fill, { width: `${Math.min(100, magnitude)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const magStyles = StyleSheet.create({
  container: { marginTop: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  label: { fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  severity: { fontSize: 10, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, backgroundColor: '#1f2937', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
});

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Ending soon';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export function EventsScreen() {
  const [tab, setTab] = useState<'active' | 'history'>('active');

  const { data: allEvents, isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get('/events').then((r: any) => r.data),
  });

  const { data: activeEvents, isLoading: activeLoading, refetch: refetchActive } = useQuery({
    queryKey: ['events', 'active'],
    queryFn: () => api.get('/events/active').then((r: any) => r.data),
  });

  const isLoading = allLoading || activeLoading;
  const active: GameEvent[] = activeEvents ?? [];
  const all: GameEvent[] = allEvents ?? [];
  const history = all.filter((e) => !e.active);

  const displayed = tab === 'active' ? active : history;

  if (isLoading) return <LoadingSkeleton />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => { refetchAll(); refetchActive(); }}
          tintColor="#22c55e"
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>World Events</Text>
        <Text style={styles.subtitle}>{active.length} active events</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === 'active' && styles.tabActive]}
          onPress={() => setTab('active')}
        >
          <Text style={[styles.tabText, tab === 'active' && styles.tabTextActive]}>
            Active ({active.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'history' && styles.tabActive]}
          onPress={() => setTab('history')}
        >
          <Text style={[styles.tabText, tab === 'history' && styles.tabTextActive]}>
            History ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Events */}
      {displayed.length === 0 ? (
        <EmptyState
          icon={tab === 'active' ? '\u{1F30D}' : '\u{1F4DA}'}
          title={tab === 'active' ? 'No Active Events' : 'No Past Events'}
          subtitle={tab === 'active' ? 'The world is calm... for now' : 'Event history will appear here'}
        />
      ) : (
        displayed.map((event) => {
          const icon = CATEGORY_ICONS[event.category] ?? '\u{2753}';
          const categoryLabel = CATEGORY_LABELS[event.category] ?? event.category;
          return (
            <Card key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <View style={styles.eventIconContainer}>
                  <Text style={styles.eventIcon}>{icon}</Text>
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Badge label={categoryLabel} variant={event.active ? 'blue' : 'gray'} />
                </View>
              </View>
              <Text style={styles.eventDesc}>{event.description}</Text>
              {event.active && event.time_remaining_seconds != null && (
                <Text style={styles.eventTime}>
                  {formatTimeRemaining(event.time_remaining_seconds)}
                </Text>
              )}
              <MagnitudeBar magnitude={event.magnitude} />
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#030712' },
  content: { padding: 16, paddingBottom: 32 },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#f9fafb' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937' },
  tabActive: { backgroundColor: '#052e16', borderColor: '#22c55e' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#22c55e' },
  eventCard: { marginBottom: 12 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  eventIconContainer: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#0a0f1a', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  eventIcon: { fontSize: 20 },
  eventInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eventTitle: { fontSize: 15, fontWeight: '700', color: '#f9fafb', flex: 1, marginRight: 8 },
  eventDesc: { fontSize: 13, color: '#9ca3af', lineHeight: 18, marginBottom: 4 },
  eventTime: { fontSize: 12, color: '#22c55e', fontWeight: '600', marginTop: 4 },
});
