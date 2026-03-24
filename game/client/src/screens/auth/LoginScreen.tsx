import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthStack';
import { useAuthStore } from '../../stores/authStore';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Validation', 'Please enter your email and password.');
      return;
    }

    clearError();
    try {
      await login(email.trim().toLowerCase(), password);
      // Navigation handled by RootNavigator reacting to isAuthenticated
    } catch {
      // Error is set in the store
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🏛️</Text>
          <Text style={styles.title}>EmpireOS</Text>
          <Text style={styles.subtitle}>The Multiplayer Economy Game</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#4b5563"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#4b5563"
              secureTextEntry
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>{isLoading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.linkText}>
              Don't have an account?{' '}
              <Text style={styles.linkHighlight}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#030712' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
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
  },
  form: {
    gap: 16,
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
  field: {
    gap: 6,
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
  },
  button: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#030712',
    fontSize: 16,
    fontWeight: '700',
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: '#6b7280',
    fontSize: 14,
  },
  linkHighlight: {
    color: '#22c55e',
    fontWeight: '600',
  },
});
