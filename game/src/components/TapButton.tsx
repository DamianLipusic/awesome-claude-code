import React, { useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatMoney } from '../utils/formatMoney';

interface FloatingLabel {
  id: number;
  x: number;
  y: number;
  value: number;
  anim: Animated.Value;
}

interface Props {
  onTap: () => void;
  tapValue: number;
}

export function TapButton({ onTap, tapValue }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [floaters, setFloaters] = useState<FloatingLabel[]>([]);
  const nextId = useRef(0);

  const handleTap = (evt: any) => {
    onTap();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Scale bounce
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.93, duration: 60, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 4 }),
    ]).start();

    // Floating label
    const id = nextId.current++;
    const x = (Math.random() - 0.5) * 80;
    const y = -40 - Math.random() * 30;
    const floatAnim = new Animated.Value(0);

    setFloaters(prev => [...prev, { id, x, y, value: tapValue, anim: floatAnim }]);

    Animated.timing(floatAnim, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start(() => {
      setFloaters(prev => prev.filter(f => f.id !== id));
    });
  };

  return (
    <View style={styles.wrapper}>
      {floaters.map(f => (
        <Animated.Text
          key={f.id}
          style={[
            styles.floater,
            {
              transform: [
                { translateX: f.x },
                {
                  translateY: f.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -80],
                  }),
                },
              ],
              opacity: f.anim.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 1, 0],
              }),
            },
          ]}
        >
          +{formatMoney(tapValue)}
        </Animated.Text>
      ))}

      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleTap}
          activeOpacity={0.9}
        >
          <Text style={styles.emoji}>💰</Text>
          <Text style={styles.label}>TAP TO EARN</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 220,
  },
  button: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#1a1a2e',
    borderWidth: 3,
    borderColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  emoji: {
    fontSize: 64,
  },
  label: {
    color: '#FFD700',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 2,
    marginTop: 4,
  },
  floater: {
    position: 'absolute',
    color: '#FFD700',
    fontWeight: '800',
    fontSize: 20,
    textShadowColor: 'rgba(255,215,0,0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
