import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CrimeHubScreen } from '../screens/crime/CrimeHubScreen';
import { CrimeOperationsScreen } from '../screens/crime/CrimeOperationsScreen';
import { LaunderingScreen } from '../screens/crime/LaunderingScreen';
import { HeatManagementScreen } from '../screens/crime/HeatManagementScreen';
import type { CrimeStackParamList } from '../screens/crime/CrimeHubScreen';

const Stack = createNativeStackNavigator<CrimeStackParamList>();

export function CrimeStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#030712' },
        headerTintColor: '#f9fafb',
        headerShadowVisible: false,
        contentStyle: { backgroundColor: '#030712' },
      }}
    >
      <Stack.Screen
        name="CrimeHub"
        component={CrimeHubScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CrimeOperations"
        component={CrimeOperationsScreen}
        options={{ title: 'Operations' }}
      />
      <Stack.Screen
        name="Laundering"
        component={LaunderingScreen}
        options={{ title: 'Laundering' }}
      />
      <Stack.Screen
        name="HeatManagement"
        component={HeatManagementScreen}
        options={{ title: 'Heat Management' }}
      />
    </Stack.Navigator>
  );
}
