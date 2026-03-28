import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LogisticsHubScreen } from '../screens/logistics/LogisticsHubScreen';
import { DeliveryBoardScreen } from '../screens/logistics/DeliveryBoardScreen';
import { MyDeliveriesScreen } from '../screens/logistics/MyDeliveriesScreen';
import { FleetScreen } from '../screens/logistics/FleetScreen';
import type { LogisticsStackParamList } from '../screens/logistics/LogisticsHubScreen';

const Stack = createStackNavigator<LogisticsStackParamList>();

export function LogisticsStack() {
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
        name="LogisticsHub"
        component={LogisticsHubScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DeliveryBoard"
        component={DeliveryBoardScreen}
        options={{ title: 'Delivery Board' }}
      />
      <Stack.Screen
        name="MyDeliveries"
        component={MyDeliveriesScreen}
        options={{ title: 'My Deliveries' }}
      />
      <Stack.Screen
        name="Fleet"
        component={FleetScreen}
        options={{ title: 'Fleet Management' }}
      />
    </Stack.Navigator>
  );
}
