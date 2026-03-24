import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGameStore } from '../src/store/gameStore';

function TabBarBadge({ count }: { count: number }) {
  // Native badge via tabBarBadge prop
  return null;
}

export default function RootLayout() {
  const dailyMissions = useGameStore(s => s.dailyMissions);
  const unclaimedMissions = dailyMissions.filter(m => m.completed && !m.claimed).length;

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#0d0d1a',
            borderTopColor: '#1a1a2e',
            borderTopWidth: 1,
            paddingBottom: 4,
            height: 62,
          },
          tabBarActiveTintColor: '#FFD700',
          tabBarInactiveTintColor: '#3a3a5a',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '700',
            letterSpacing: 0.3,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Empire',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cash" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="businesses"
          options={{
            title: 'Business',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="business" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="shop"
          options={{
            title: 'Shop',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="cart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="hustle"
          options={{
            title: 'Hustle',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="flash" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="stocks"
          options={{
            title: 'Stocks',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trending-up" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="missions"
          options={{
            title: 'Missions',
            tabBarBadge: unclaimedMissions > 0 ? unclaimedMissions : undefined,
            tabBarBadgeStyle: { backgroundColor: '#f97316', fontSize: 10 },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="trophy" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="store"
          options={{
            title: 'Store',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="diamond" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="prestige"
          options={{
            title: 'Prestige',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="refresh-circle" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
