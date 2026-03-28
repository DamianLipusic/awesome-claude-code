import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { StrategyHubScreen } from '../screens/strategy/StrategyHubScreen';
import { AllianceScreen } from '../screens/alliance/AllianceScreen';
import { RivalryScreen } from '../screens/rivalry/RivalryScreen';
import { IntelScreen } from '../screens/intelligence/IntelScreen';
import { LogisticsScreen } from '../screens/logistics/LogisticsScreen';
import { EventsScreen } from '../screens/events/EventsScreen';
import { ManagerScreen } from '../screens/managers/ManagerScreen';
import { LocationScreen } from '../screens/locations/LocationScreen';

export type StrategyStackParamList = {
  StrategyHub: undefined;
  Alliance: undefined;
  Rivalry: undefined;
  Intelligence: undefined;
  Logistics: undefined;
  Events: undefined;
  Managers: undefined;
  Locations: undefined;
};

const Stack = createStackNavigator<StrategyStackParamList>();

export function StrategyStack() {
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
        name="StrategyHub"
        component={StrategyHubScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Alliance"
        component={AllianceScreen}
        options={{ title: 'Alliances' }}
      />
      <Stack.Screen
        name="Rivalry"
        component={RivalryScreen}
        options={{ title: 'Rivalries & War' }}
      />
      <Stack.Screen
        name="Intelligence"
        component={IntelScreen}
        options={{ title: 'Intelligence' }}
      />
      <Stack.Screen
        name="Logistics"
        component={LogisticsScreen}
        options={{ title: 'Logistics' }}
      />
      <Stack.Screen
        name="Events"
        component={EventsScreen}
        options={{ title: 'World Events' }}
      />
      <Stack.Screen
        name="Managers"
        component={ManagerScreen}
        options={{ title: 'Managers' }}
      />
      <Stack.Screen
        name="Locations"
        component={LocationScreen}
        options={{ title: 'Locations' }}
      />
    </Stack.Navigator>
  );
}
