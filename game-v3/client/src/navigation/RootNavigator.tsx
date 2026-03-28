import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { LoadingScreen } from '../components/ui/LoadingScreen';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { ProfileScreen } from '../screens/ProfileScreen';

const darkTheme = {
  dark: true,
  colors: {
    primary: '#22c55e',
    background: '#0f172a',
    card: '#111827',
    text: '#f9fafb',
    border: '#1f2937',
    notification: '#ef4444',
  },
};

export type RootStackParamList = {
  Main: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const refreshSession = useAuthStore((s) => s.refreshSession);

  useEffect(() => {
    refreshSession();
  }, []);

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <NavigationContainer theme={darkTheme}>
      {isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ presentation: 'modal', headerShown: true, headerTitle: 'Profile', headerStyle: { backgroundColor: '#111827' }, headerTintColor: '#f9fafb' }}
          />
        </Stack.Navigator>
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}
