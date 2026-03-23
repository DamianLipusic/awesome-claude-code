import 'react-native-get-random-values';
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider, MD3LightTheme } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProjektStore } from '../src/store/projectStore';
import { useEinstellungenStore } from '../src/store/settingsStore';
import { useCostsStore } from '../src/store/costsStore';
import { useIapStore } from '../src/store/iapStore';
import { ONBOARDING_KEY } from './onboarding';

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#1565C0',
    secondary: '#F57F17',
    background: '#F5F5F5',
    surface: '#FFFFFF',
  },
};

export default function RootLayout() {
  const ladeProjekte = useProjektStore(s => s.ladeProjekte);
  const ladeEinstellungen = useEinstellungenStore(s => s.ladeEinstellungen);
  const ladePreise = useCostsStore(s => s.ladePreise);
  const initialisierenIap = useIapStore(s => s.initialisieren);

  useEffect(() => {
    ladeProjekte();
    ladeEinstellungen();
    ladePreise();
    initialisierenIap();
    AsyncStorage.getItem(ONBOARDING_KEY).then(wert => {
      if (!wert) router.replace('/onboarding');
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider theme={theme}>
        <StatusBar style="light" backgroundColor="#1565C0" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#1565C0' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="project/new" options={{ title: 'Neues Projekt', presentation: 'modal' }} />
          <Stack.Screen name="project/[id]/index" options={{ title: 'Projektübersicht' }} />
          <Stack.Screen name="project/[id]/edit" options={{ title: 'Projekt bearbeiten', presentation: 'modal' }} />
          <Stack.Screen name="project/[id]/capture" options={{ title: 'Foto aufnehmen' }} />
          <Stack.Screen name="project/[id]/annotate/[photoId]" options={{ title: 'Maße erfassen' }} />
          <Stack.Screen name="project/[id]/measurements" options={{ title: 'Messungen prüfen' }} />
          <Stack.Screen name="project/[id]/photos" options={{ title: 'Fotos' }} />
          <Stack.Screen name="project/[id]/openings" options={{ title: 'Öffnungen' }} />
          <Stack.Screen name="project/[id]/plan" options={{ title: 'Gerüstplan' }} />
          <Stack.Screen name="project/[id]/materials" options={{ title: 'Materialliste' }} />
          <Stack.Screen name="project/[id]/export" options={{ title: 'PDF exportieren' }} />
          <Stack.Screen name="project/[id]/costs" options={{ title: 'Kostenschätzung' }} />
          <Stack.Screen name="project/[id]/time" options={{ title: 'Zeiterfassung' }} />
          <Stack.Screen name="project/[id]/checklist" options={{ title: 'Abnahme-Checkliste' }} />
          <Stack.Screen name="project/[id]/quote" options={{ title: 'Angebot erstellen' }} />
          <Stack.Screen name="paywall" options={{ title: 'Gerüstbau Pro', presentation: 'modal' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        </Stack>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
