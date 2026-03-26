import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { BusinessHubScreen } from '../screens/business/BusinessHubScreen';
import { BusinessDetailScreen } from '../screens/business/BusinessDetailScreen';
import { EmployeeMarketScreen } from '../screens/business/EmployeeMarketScreen';
import { ManagerMarketScreen } from '../screens/business/ManagerMarketScreen';
import type { BusinessStackParamList } from '../screens/business/BusinessHubScreen';

const Stack = createStackNavigator<BusinessStackParamList>();

export function BusinessStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0f' },
        headerTintColor: '#e0e0e0',
        headerShadowVisible: false,
        cardStyle: { backgroundColor: '#0a0a0f' },
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
      <Stack.Screen
        name="ManagerMarket"
        component={ManagerMarketScreen}
        options={{ title: 'Manager Market' }}
      />
    </Stack.Navigator>
  );
}
