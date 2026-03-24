import React, { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { LoadingScreen } from '../components/ui/LoadingScreen';

export function RootNavigator() {
  const { isAuthenticated, isLoading, refreshSession } = useAuthStore();

  useEffect(() => {
    refreshSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return <LoadingScreen message="Starting EmpireOS..." />;
  }

  return isAuthenticated ? <MainTabs /> : <AuthStack />;
}
