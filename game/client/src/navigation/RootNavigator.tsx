import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { LoadingScreen } from '../components/ui/LoadingScreen';

function Navigator() {
  const { isAuthenticated, isLoading, refreshSession } = useAuthStore();

  useEffect(() => {
    refreshSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <LoadingScreen message="Starting EmpireOS..." />;
  }

  return isAuthenticated ? <MainTabs /> : <AuthStack />;
}

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Navigator />
    </NavigationContainer>
  );
}
