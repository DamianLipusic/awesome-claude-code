import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen';
import { BusinessStack } from './BusinessStack';
import { EmployeeScreen } from '../screens/EmployeeScreen';
import { MarketScreen } from '../screens/MarketScreen';
import { GameInfoScreen } from '../screens/GameInfoScreen';
import { LeaderboardScreen } from '../screens/LeaderboardScreen';
import { CrimeScreen } from '../screens/CrimeScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Businesses: undefined;
  Market: undefined;
  Employees: undefined;
  Crime: undefined;
  Ranking: undefined;
  Info: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#22c55e',
        tabBarInactiveTintColor: '#6b7280',
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>&#127968;</Text>,
        }}
      />
      <Tab.Screen
        name="Businesses"
        component={BusinessStack}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>&#127970;</Text>,
        }}
      />
      <Tab.Screen
        name="Market"
        component={MarketScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>&#128200;</Text>,
        }}
      />
      <Tab.Screen
        name="Employees"
        component={EmployeeScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>&#128101;</Text>,
        }}
      />
      <Tab.Screen
        name="Crime"
        component={CrimeScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>&#128123;</Text>,
        }}
      />
      <Tab.Screen
        name="Ranking"
        component={LeaderboardScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>&#127942;</Text>,
        }}
      />
      <Tab.Screen
        name="Info"
        component={GameInfoScreen}
        options={{
          tabBarIcon: ({ color }) => <Text style={[styles.tabIcon, { color }]}>&#128218;</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111827',
    borderTopColor: '#1f2937',
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tabIcon: {
    fontSize: 20,
  },
});
