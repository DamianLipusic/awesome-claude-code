import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen';

export type MainTabParamList = {
  Dashboard: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ emoji }: { emoji: string }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={tabStyles.emoji}>{emoji}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 22,
  },
});

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#0a0a0f' },
        headerTintColor: '#e0e0e0',
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: '#12121a',
          borderTopColor: '#2a2a3e',
          borderTopWidth: 1,
          paddingBottom: 6,
          paddingTop: 6,
          height: 64,
        },
        tabBarActiveTintColor: '#6c5ce7',
        tabBarInactiveTintColor: '#a0a0b0',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 2,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'EmpireOS',
          tabBarIcon: () => <TabIcon emoji="🏠" />,
        }}
      />
    </Tab.Navigator>
  );
}
