import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BusinessListScreen } from '../screens/BusinessListScreen';
import { BusinessDetailScreen } from '../screens/BusinessDetailScreen';

export type BusinessStackParamList = {
  BusinessList: undefined;
  BusinessDetail: { businessId: string };
};

const Stack = createNativeStackNavigator<BusinessStackParamList>();

export function BusinessStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f172a' },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="BusinessList" component={BusinessListScreen} />
      <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen as React.ComponentType<any>} />
    </Stack.Navigator>
  );
}
