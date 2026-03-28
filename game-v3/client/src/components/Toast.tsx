import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from "react-native";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: "#052e16", border: "#22c55e", text: "#22c55e", icon: "\u2713" },
  error:   { bg: "#2a0a0a", border: "#ef4444", text: "#ef4444", icon: "\u2717" },
  info:    { bg: "#0a1628", border: "#3b82f6", text: "#3b82f6", icon: "\u2139" },
  warning: { bg: "#1a1400", border: "#f97316", text: "#f97316", icon: "\u26A0" },
};

const AUTO_DISMISS_MS = 3000;

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const colors = TOAST_COLORS[toast.type];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start(() => onDismiss(toast.id));
    }, AUTO_DISMISS_MS);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: colors.bg, borderColor: colors.border, opacity, transform: [{ translateY }] },
      ]}
    >
      <Text style={[styles.toastIcon, { color: colors.text }]}>{colors.icon}</Text>
      <Text style={[styles.toastMessage, { color: colors.text }]} numberOfLines={3}>
        {toast.message}
      </Text>
      <TouchableOpacity onPress={() => onDismiss(toast.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.toastClose, { color: colors.text }]}>{"\u2715"}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: Platform.OS === "web" ? 16 : 50,
    right: 16,
    left: Platform.OS === "web" ? undefined : 16,
    width: Platform.OS === "web" ? 360 : undefined,
    alignSelf: "flex-end",
    zIndex: 9999,
    gap: 8,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 10,
    ...(Platform.OS === "web"
      ? { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }
      : { elevation: 6 }),
  },
  toastIcon: {
    fontSize: 16,
    fontWeight: "800",
    width: 20,
    textAlign: "center",
  },
  toastMessage: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  toastClose: {
    fontSize: 14,
    fontWeight: "700",
    opacity: 0.7,
    padding: 2,
  },
});
