import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { GAME_EVENTS } from '../data/events';
import { ActiveEvent } from '../store/types';
import { formatDuration } from '../utils/formatMoney';

interface Props {
  activeEvent: ActiveEvent | null;
}

export function EventBanner({ activeEvent }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!activeEvent) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeEvent?.eventId]);

  if (!activeEvent || Date.now() >= activeEvent.endTime) return null;

  const event = GAME_EVENTS.find(e => e.id === activeEvent.eventId);
  if (!event) return null;

  const timeLeft = Math.max(0, activeEvent.endTime - Date.now());

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: event.backgroundColor,
          borderColor: event.color,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <Text style={styles.emoji}>{event.emoji}</Text>
      <View style={styles.info}>
        <Text style={[styles.title, { color: event.color }]}>{event.title}</Text>
        <Text style={styles.desc}>{event.description}</Text>
      </View>
      <Text style={[styles.timer, { color: event.color }]}>
        {formatDuration(timeLeft)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  emoji: { fontSize: 24 },
  info: { flex: 1 },
  title: { fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  desc: { color: '#aaa', fontSize: 11, marginTop: 2 },
  timer: { fontWeight: '800', fontSize: 13 },
});
