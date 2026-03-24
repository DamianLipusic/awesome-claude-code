import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { BusinessHubScreen } from '../screens/business/BusinessHubScreen';
import { BusinessDetailScreen } from '../screens/business/BusinessDetailScreen';
import { EmployeeMarketScreen } from '../screens/business/EmployeeMarketScreen';
import type { BusinessStackParamList } from '../screens/business/BusinessHubScreen';

const Stack = createStackNavigator<BusinessStackParamList>();

export function BusinessStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#030712' },
        headerTintColor: '#f9fafb',
        headerShadowVisible: false,
        cardStyle: { backgroundColor: '#030712' },
      }}
    >
      <Stack.Screen
        name="BusinessHub"
        component={BusinessHubScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="BusinessDetail"
        component={BusinessDetailScreen}
        options={{ title: 'Business Details' }}
      />
      <Stack.Screen
        name="EmployeeMarket"
        component={EmployeeMarketScreen}
        options={{ title: 'Hire Employees' }}
      />
    </Stack.Navigator>
  );
}
