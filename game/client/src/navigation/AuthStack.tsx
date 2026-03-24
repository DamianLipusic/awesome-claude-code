import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

const Stack = createStackNavigator<AuthStackParamList>();

export function AuthStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#030712' },
        headerTintColor: '#f9fafb',
        headerShadowVisible: false,
        cardStyle: { backgroundColor: '#030712' },
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
    </Stack.Navigator>
  );
}
