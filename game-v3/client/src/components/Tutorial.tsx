import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
} from "react-native";

const TUTORIAL_KEY = "empireOS_v3_tutorial_complete";

interface TutorialStep {
  title: string;
  body: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to EmpireOS V3!",
    body: "Build your criminal empire from the ground up. Earn money, expand operations, and climb the ranks.",
  },
  {
    title: "Start a Business",
    body: "Create a business to start generating income. Each business produces goods on every tick automatically.",
  },
  {
    title: "Hire Employees",
    body: "Hire employees to boost your productivity and unlock new capabilities.",
  },
  {
    title: "Trade on the Market",
    body: "Buy and sell resources on the open market. Watch prices and trade smart to maximize profits.",
  },
];

function isTutorialComplete(): boolean {
  if (Platform.OS === "web") {
    return localStorage.getItem(TUTORIAL_KEY) === "true";
  }
  return true; // Skip on native for now
}

function markTutorialComplete(): void {
  if (Platform.OS === "web") {
    localStorage.setItem(TUTORIAL_KEY, "true");
  }
}

export function Tutorial() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isTutorialComplete()) {
      setVisible(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [step]);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      markTutorialComplete();
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setVisible(false);
      });
    }
  };

  const handleSkip = () => {
    markTutorialComplete();
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  };

  if (!visible) return null;

  const currentStep = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {/* Progress dots */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]} />
          ))}
        </View>

        <Text style={styles.title}>{currentStep.title}</Text>
        <Text style={styles.body}>{currentStep.body}</Text>

        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>{step + 1} of {STEPS.length}</Text>
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.nextBtnText}>{isLast ? "Start Playing" : "Next"}</Text>
        </TouchableOpacity>

        {!isLast && (
          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
            <Text style={styles.skipBtnText}>Skip Tutorial</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

export function resetTutorial(): void {
  if (Platform.OS === "web") {
    localStorage.removeItem(TUTORIAL_KEY);
  }
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(3, 7, 18, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
    padding: 24,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 32,
    maxWidth: 420,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#374151",
  },
  dotActive: {
    backgroundColor: "#6c5ce7",
    width: 24,
  },
  dotDone: {
    backgroundColor: "#22c55e",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f9fafb",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    maxWidth: 340,
  },
  stepIndicator: {
    marginBottom: 16,
  },
  stepText: {
    fontSize: 12,
    color: "#4b5563",
    fontWeight: "600",
  },
  nextBtn: {
    backgroundColor: "#6c5ce7",
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  nextBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  skipBtn: {
    paddingVertical: 8,
  },
  skipBtnText: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
});
