import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { ACHIEVEMENTS } from '../data/achievements';

export function AchievementPopup() {
  const unlockedAchievements = useGameStore(s => s.unlockedAchievements);
  const [shown, setShown] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const newOnes = unlockedAchievements.filter(id => !shown.includes(id));
    if (newOnes.length === 0 || current) return;

    const nextId = newOnes[0];
    setShown(prev => [...prev, nextId]);
    setCurrent(nextId);

    Animated.sequence([
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.delay(3000),
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -120, duration: 400, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    ]).start(() => {
      setCurrent(null);
      slideAnim.setValue(-120);
      opacityAnim.setValue(0);
    });
  }, [unlockedAchievements.length]);

  if (!current) return null;
  const ach = ACHIEVEMENTS.find(a => a.id === current);
  if (!ach) return null;

  return (
    <Animated.View
      style={[
        styles.popup,
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <Text style={styles.emoji}>{ach.emoji}</Text>
      <View style={styles.info}>
        <Text style={styles.label}>ACHIEVEMENT UNLOCKED</Text>
        <Text style={styles.title}>{ach.title}</Text>
        <Text style={styles.desc}>{ach.description}</Text>
      </View>
      <View style={styles.reward}>
        <Text style={styles.rewardText}>+{ach.gemReward} 💎</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  popup: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a14',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    gap: 12,
    zIndex: 1000,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  emoji: { fontSize: 32 },
  info: { flex: 1 },
  label: { color: '#FFD700', fontSize: 9, letterSpacing: 2, fontWeight: '800' },
  title: { color: '#fff', fontWeight: '900', fontSize: 15, marginTop: 2 },
  desc: { color: '#888', fontSize: 11, marginTop: 2 },
  reward: {
    backgroundColor: '#FFD70022',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rewardText: { color: '#FFD700', fontWeight: '800', fontSize: 13 },
});
