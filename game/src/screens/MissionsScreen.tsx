import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';
import { MISSION_TEMPLATES, WEEKLY_CHALLENGES } from '../data/missions';
import { formatMoney } from '../utils/formatMoney';

export function MissionsScreen() {
  const { dailyMissions, weeklyMission, gems, seasonXp, claimMission, activeEvent } = useGameStore();

  const getTemplate = (id: string) =>
    [...MISSION_TEMPLATES, ...WEEKLY_CHALLENGES].find(t => t.id === id);

  const formatTarget = (template: ReturnType<typeof getTemplate>, targetIndex: number) => {
    if (!template) return '';
    const target = template.targets[targetIndex];
    const desc = template.description
      .replace('{target}', target.toLocaleString())
      .replace('${target}', formatMoney(target));
    return desc;
  };

  const completedCount = dailyMissions.filter(m => m.completed).length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>🎯 Missions</Text>

        {/* Gems + XP Banner */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>💎 {gems}</Text>
            <Text style={styles.statLabel}>Gems</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>⭐ {seasonXp}</Text>
            <Text style={styles.statLabel}>Season XP</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{completedCount}/3</Text>
            <Text style={styles.statLabel}>Daily Done</Text>
          </View>
        </View>

        {/* Daily Missions */}
        <Text style={styles.sectionTitle}>📅 Daily Missions</Text>
        <Text style={styles.sectionSub}>Resets every 24 hours</Text>

        {dailyMissions.map(mission => {
          const template = getTemplate(mission.templateId);
          if (!template) return null;
          const target = template.targets[mission.targetIndex];
          const progress = Math.min(mission.progress, target);
          const percent = Math.min(1, progress / target);

          return (
            <View key={mission.templateId} style={[styles.missionCard, mission.claimed && styles.claimedCard]}>
              <View style={styles.missionHeader}>
                <Text style={styles.missionEmoji}>{template.emoji}</Text>
                <View style={styles.missionInfo}>
                  <Text style={styles.missionTitle}>{template.title}</Text>
                  <Text style={styles.missionDesc}>{formatTarget(template, mission.targetIndex)}</Text>
                </View>
                <View style={styles.missionReward}>
                  <Text style={styles.rewardGems}>💎 {template.gemReward}</Text>
                  <Text style={styles.rewardXp}>⭐ {template.xpReward}</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${percent * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
                {mission.completed ? 'Complete!' : `${formatMoney(progress)} / ${formatMoney(target)}`}
              </Text>

              {mission.completed && !mission.claimed && (
                <TouchableOpacity
                  style={styles.claimBtn}
                  onPress={() => {
                    claimMission(mission.templateId);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                >
                  <Text style={styles.claimBtnText}>CLAIM REWARD →</Text>
                </TouchableOpacity>
              )}
              {mission.claimed && (
                <View style={styles.claimedBadge}>
                  <Text style={styles.claimedText}>✓ CLAIMED</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Weekly Challenge */}
        {weeklyMission && (
          <>
            <Text style={styles.sectionTitle}>🏆 Weekly Challenge</Text>
            <Text style={styles.sectionSub}>Resets every 7 days · Bigger rewards</Text>
            {(() => {
              const template = getTemplate(weeklyMission.templateId);
              if (!template) return null;
              const target = template.targets[weeklyMission.targetIndex];
              const progress = Math.min(weeklyMission.progress, target);
              const percent = Math.min(1, progress / target);

              return (
                <View style={[styles.missionCard, styles.weeklyCard, weeklyMission.claimed && styles.claimedCard]}>
                  <View style={styles.missionHeader}>
                    <Text style={styles.missionEmoji}>{template.emoji}</Text>
                    <View style={styles.missionInfo}>
                      <Text style={styles.missionTitle}>{template.title}</Text>
                      <Text style={styles.missionDesc}>{formatTarget(template, weeklyMission.targetIndex)}</Text>
                    </View>
                    <View style={styles.missionReward}>
                      <Text style={styles.rewardGems}>💎 {template.gemReward}</Text>
                      <Text style={styles.rewardXp}>⭐ {template.xpReward}</Text>
                    </View>
                  </View>

                  <View style={styles.progressBg}>
                    <View style={[styles.progressFill, styles.weeklyFill, { width: `${percent * 100}%` }]} />
                  </View>
                  <Text style={styles.progressText}>
                    {weeklyMission.completed ? 'Complete!' : `${formatMoney(progress)} / ${formatMoney(target)}`}
                  </Text>

                  {weeklyMission.completed && !weeklyMission.claimed && (
                    <TouchableOpacity
                      style={styles.claimBtn}
                      onPress={() => {
                        claimMission(weeklyMission.templateId);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      }}
                    >
                      <Text style={styles.claimBtnText}>CLAIM REWARD →</Text>
                    </TouchableOpacity>
                  )}
                  {weeklyMission.claimed && (
                    <View style={styles.claimedBadge}>
                      <Text style={styles.claimedText}>✓ CLAIMED</Text>
                    </View>
                  )}
                </View>
              );
            })()}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', paddingVertical: 18 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: {
    flex: 1,
    backgroundColor: '#12122a',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  statValue: { color: '#FFD700', fontWeight: '800', fontSize: 15 },
  statLabel: { color: '#666', fontSize: 11, marginTop: 2 },

  sectionTitle: { color: '#fff', fontWeight: '800', fontSize: 17, marginBottom: 4 },
  sectionSub: { color: '#555', fontSize: 12, marginBottom: 12, fontStyle: 'italic' },

  missionCard: {
    backgroundColor: '#12122a',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  weeklyCard: {
    borderColor: '#FFD700',
    backgroundColor: '#14140a',
  },
  claimedCard: {
    opacity: 0.6,
  },
  missionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  missionEmoji: { fontSize: 28 },
  missionInfo: { flex: 1 },
  missionTitle: { color: '#fff', fontWeight: '700', fontSize: 14 },
  missionDesc: { color: '#888', fontSize: 12, marginTop: 3 },
  missionReward: { alignItems: 'flex-end' },
  rewardGems: { color: '#38bdf8', fontWeight: '700', fontSize: 13 },
  rewardXp: { color: '#facc15', fontWeight: '600', fontSize: 12, marginTop: 2 },

  progressBg: {
    height: 8,
    backgroundColor: '#1a1a2a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 4,
  },
  weeklyFill: { backgroundColor: '#a855f7' },
  progressText: { color: '#666', fontSize: 11, marginBottom: 8 },

  claimBtn: {
    backgroundColor: '#FFD700',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  claimBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  claimedBadge: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  claimedText: { color: '#4ade80', fontWeight: '700', fontSize: 12 },
});
