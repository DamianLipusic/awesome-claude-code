import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { MarketScreen } from '../screens/market/MarketScreen';
import { CreateListingScreen } from '../screens/market/CreateListingScreen';
import { ContractScreen } from '../screens/market/ContractScreen';
import type { MarketStackParamList } from '../screens/market/MarketScreen';

const Stack = createStackNavigator<MarketStackParamList>();

export function MarketStack() {
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
        name="MarketMain"
        component={MarketScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateListing"
        component={CreateListingScreen}
        options={{ title: 'Create Listing' }}
      />
      <Stack.Screen
        name="ContractScreen"
        component={ContractScreen}
        options={{ title: 'Trade Contracts' }}
      />
    </Stack.Navigator>
  );
}
