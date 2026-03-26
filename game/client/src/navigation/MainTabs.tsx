import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DashboardScreen } from '../screens/DashboardScreen';
import { MarketStack } from './MarketStack';
import { LogisticsStack } from './LogisticsStack';
import { BusinessStack } from './BusinessStack';
import { CrimeStack } from './CrimeStack';
import { StrategyStack } from './StrategyStack';
import { ProfileScreen } from '../screens/ProfileScreen';
import { useAlertStore } from '../stores/alertStore';
import { useAuthStore } from '../stores/authStore';

export type MainTabParamList = {
  Dashboard: undefined;
  Market: undefined;
  Logistics: undefined;
  Business: undefined;
  Crime: undefined;
  Strategy: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={tabStyles.emoji}>{emoji}</Text>
    </View>
  );
}

function BadgeIcon({ emoji, count }: { emoji: string; count?: number }) {
  return (
    <View style={tabStyles.iconContainer}>
      <Text style={tabStyles.emoji}>{emoji}</Text>
      {count != null && count > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
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
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});

export function MainTabs() {
  const unreadCount = useAlertStore((s) => s.unreadCount);
  const player = useAuthStore((s) => s.player);

  const hasCriminalActivity =
    player?.alignment === 'CRIMINAL' || player?.alignment === 'MIXED';

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
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <BadgeIcon emoji="🏠" count={focused ? 0 : unreadCount} />
          ),
        }}
      />
      <Tab.Screen
        name="Market"
        component={MarketStack}
        options={{
          title: 'Market',
          tabBarIcon: () => <TabIcon emoji="📊" label="Market" />,
        }}
      />
      <Tab.Screen
        name="Logistics"
        component={LogisticsStack}
        options={{
          title: 'Logistics',
          tabBarIcon: () => <TabIcon emoji="🚚" label="Logistics" />,
        }}
      />
      <Tab.Screen
        name="Business"
        component={BusinessStack}
        options={{
          title: 'Business',
          tabBarIcon: () => <TabIcon emoji="🏢" label="Business" />,
        }}
      />
      <Tab.Screen
        name="Crime"
        component={CrimeStack}
        options={{
          title: 'Crime',
          tabBarIcon: ({ focused }) => (
            <BadgeIcon
              emoji="🔥"
              count={hasCriminalActivity && !focused ? 1 : undefined}
            />
          ),
          tabBarItemStyle: hasCriminalActivity
            ? {}
            : { opacity: 0.5 },
        }}
      />
      <Tab.Screen
        name="Strategy"
        component={StrategyStack}
        options={{
          title: 'Strategy',
          tabBarIcon: () => <TabIcon emoji="🎯" label="Strategy" />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: () => <TabIcon emoji="👤" label="Profile" />,
        }}
      />
    </Tab.Navigator>
  );
}
