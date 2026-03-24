import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Project, ProjectStatus } from '../types';
import { COLORS, SPACING, FONT_SIZE, RADIUS, SHADOW } from '../constants/theme';

const STATUS_COLORS: Record<ProjectStatus, string> = {
  planning:  COLORS.warning,
  synthesis: COLORS.primary,
  done:      COLORS.success,
};

const STATUS_LABELS: Record<ProjectStatus, string> = {
  planning:  'Planning',
  synthesis: 'In Synthesis',
  done:      'Done',
};

interface Props {
  project: Project;
  onPress: () => void;
  dark?: boolean;
}

export default function ProjectCard({ project, onPress, dark }: Props) {
  const steps = project.synthesisSteps;
  const done  = steps.filter(s => s.done).length;
  const pct   = steps.length ? (done / steps.length) * 100 : 0;
  const statusColor = STATUS_COLORS[project.status];

  const bg     = dark ? COLORS.cardDark   : COLORS.cardLight;
  const text   = dark ? COLORS.textDark   : COLORS.textLight;
  const muted  = dark ? COLORS.mutedDark  : COLORS.mutedLight;
  const border = dark ? COLORS.borderDark : COLORS.borderLight;
  const track  = dark ? COLORS.surfaceDark: COLORS.surfaceLight;

  return (
    <TouchableOpacity
      style={[styles.card, SHADOW.card, { backgroundColor: bg, borderColor: border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Status badge */}
      <View style={[styles.badge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
        <Text style={[styles.badgeText, { color: statusColor }]}>{STATUS_LABELS[project.status]}</Text>
      </View>

      <Text style={[styles.name, { color: text }]} numberOfLines={1}>{project.name}</Text>
      <Text style={[styles.seq, { color: muted }]} numberOfLines={1}>
        {project.sequence.substring(0, 30)}{project.sequence.length > 30 ? '…' : ''}
      </Text>
      <Text style={[styles.meta, { color: muted }]}>{project.sequence.length} aa · {new Date(project.updatedAt).toLocaleDateString()}</Text>

      {/* Progress */}
      {project.status === 'synthesis' && (
        <View style={styles.progress}>
          <View style={[styles.track, { backgroundColor: track }]}>
            <View style={[styles.fill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={[styles.pct, { color: muted }]}>{pct.toFixed(0)}%</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginVertical: SPACING.xs,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  badgeText: { fontSize: FONT_SIZE.xs, fontWeight: '700' },
  name: { fontSize: FONT_SIZE.md, fontWeight: '700', marginBottom: 2 },
  seq: { fontSize: FONT_SIZE.sm, fontFamily: 'monospace', marginBottom: 4 },
  meta: { fontSize: FONT_SIZE.xs, marginBottom: SPACING.sm },
  progress: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  track: { flex: 1, height: 6, borderRadius: RADIUS.full, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: RADIUS.full },
  pct: { fontSize: FONT_SIZE.xs, minWidth: 30, textAlign: 'right' },
});
