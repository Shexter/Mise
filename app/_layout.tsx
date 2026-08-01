import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
} from '@expo-google-fonts/archivo';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { seedFromEnvironment } from '@/api/keyStore';
import { ToastProvider } from '@/components/Toast';
import { color } from '@/constants/theme';
import { openDatabase } from '@/db';
import { useProfileStore } from '@/store/profileStore';

// The splash stays up until fonts and the database are both ready, so the first
// frame is never system-font text on a blank background.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
  });
  const [dataReady, setDataReady] = useState(false);
  const loadProfile = useProfileStore((state) => state.load);

  useEffect(() => {
    let active = true;
    void (async () => {
      // Storage must never leave the app stuck on the splash. On a real device
      // this resolves in milliseconds; the timeout only matters for the web
      // preview, where the SQLite worker never initialises and the open would
      // otherwise hang forever. Past the timeout the app renders without
      // persistence.
      const startup = (async () => {
        await openDatabase();
        await seedFromEnvironment();
        await loadProfile();
      })();
      try {
        await Promise.race([
          startup,
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('storage timeout')), 3000),
          ),
        ]);
      } catch (error) {
        console.warn('Startup: on-device storage is unavailable.', error);
      }
      if (active) setDataReady(true);
    })();
    return () => {
      active = false;
    };
  }, [loadProfile]);

  const ready = (fontsLoaded || fontError !== null) && dataReady;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.ground },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="capture"
              options={{ presentation: 'fullScreenModal', animation: 'fade' }}
            />
            <Stack.Screen name="review" options={{ presentation: 'modal' }} />
            <Stack.Screen name="manual" options={{ presentation: 'modal' }} />
            <Stack.Screen name="match-queue" options={{ presentation: 'modal' }} />
            <Stack.Screen name="merge-canonicals" options={{ presentation: 'modal' }} />
            <Stack.Screen name="debug/tokens" options={{ presentation: 'modal' }} />
          </Stack>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
