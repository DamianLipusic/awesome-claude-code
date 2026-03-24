import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuthStore } from '../../stores/authStore';

const GUEST_PASSWORD = 'EmpireOS_Guest_2024!';

export function LoginScreen() {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, register } = useAuthStore();

  const handleEnter = async () => {
    const trimmed = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed || trimmed.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }
    if (trimmed.length > 20) {
      setError('Name must be 20 characters or less.');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setError('Only letters, numbers and underscores allowed.');
      return;
    }

    setError(null);
    setIsLoading(true);
    const email = `${trimmed}@empireos.guest`;

    try {
      await login(email, GUEST_PASSWORD);
    } catch {
      // Not registered yet — create account automatically
      try {
        await register(email, trimmed, GUEST_PASSWORD);
        await login(email, GUEST_PASSWORD);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Something went wrong.';
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>🏛️</Text>
        <Text style={styles.title}>EmpireOS</Text>
        <Text style={styles.subtitle}>The Multiplayer Economy Game</Text>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Choose your player name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. kingpin99"
            placeholderTextColor="#4b5563"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={handleEnter}
            editable={!isLoading}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleEnter}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#030712" />
            ) : (
              <Text style={styles.buttonText}>Enter Game →</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            Same name = same account. No password needed.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  logo: {
    fontSize: 56,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#f9fafb',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
    marginBottom: 40,
  },
  form: {
    width: '100%',
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#d1d5db',
    letterSpacing: 0.3,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#f9fafb',
    width: '100%',
  },
  button: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#030712',
    fontSize: 16,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#450a0a',
    borderWidth: 1,
    borderColor: '#7f1d1d',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
    marginTop: 4,
  },
});
