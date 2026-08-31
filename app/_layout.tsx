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
import { useCallback, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { seedFromEnvironment } from '@/api/keyStore';
import { ToastProvider } from '@/components/Toast';
import { StorageUnavailable } from '@/components/StorageUnavailable';
import { color } from '@/constants/theme';
import { openDatabase } from '@/db';
import { databaseReadiness, useDbReadiness } from '@/db/readiness';
import { useCookingPreferencesStore } from '@/store/cookingPreferencesStore';
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
  const loadProfile = useProfileStore((state) => state.load);
  const loadCookingPreferences = useCookingPreferencesStore((state) => state.load);
  const readiness = useDbReadiness();

  const startStorage = useCallback(() => databaseReadiness.initialise(async () => {
    try {
      await openDatabase();
      await seedFromEnvironment();
      await Promise.all([loadProfile(), loadCookingPreferences()]);
    } catch (e) {
      console.error('[DATABASE_START_ERROR]', e);
      throw e;
    }
  }), [loadProfile, loadCookingPreferences]);

  const retryStorage = useCallback(() => databaseReadiness.retry(async () => {
    try {
      await openDatabase();
      await seedFromEnvironment();
      await Promise.all([loadProfile(), loadCookingPreferences()]);
    } catch (e) {
      console.error('[DATABASE_RETRY_ERROR]', e);
      throw e;
    }
  }), [loadProfile, loadCookingPreferences]);

  useEffect(() => {
    void startStorage();
  }, [startStorage]);

  const fontsReady = fontsLoaded || fontError !== null;
  const ready = fontsReady && readiness.phase !== 'opening';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          {readiness.phase === 'unavailable' ? (
            <StorageUnavailable readiness={readiness} onRetry={() => void retryStorage()} />
          ) : (
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
            <Stack.Screen name="pantry-capture" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
            <Stack.Screen name="pantry-capture-review" options={{ presentation: 'modal' }} />
            <Stack.Screen name="pantry-voice" options={{ presentation: 'modal' }} />
            <Stack.Screen name="pantry-voice-review" options={{ presentation: 'modal' }} />
            <Stack.Screen name="barcode-review" options={{ presentation: 'modal' }} />
            <Stack.Screen name="barcode-fallback" options={{ presentation: 'modal' }} />
            <Stack.Screen name="barcode-history" options={{ presentation: 'modal' }} />
            <Stack.Screen name="barcode-recovery" options={{ presentation: 'modal' }} />
            <Stack.Screen name="receipt-history" options={{ presentation: 'modal' }} />
            <Stack.Screen name="add-pantry-item" options={{ presentation: 'modal' }} />
            <Stack.Screen name="pending-captures" options={{ presentation: 'modal' }} />
            <Stack.Screen name="review" options={{ presentation: 'modal' }} />
            <Stack.Screen name="manual" options={{ presentation: 'modal' }} />
            <Stack.Screen name="meal/[id]" />
            <Stack.Screen name="analytics" />
            <Stack.Screen name="fasting" />
            <Stack.Screen name="shops" />
            <Stack.Screen name="match-queue" options={{ presentation: 'modal' }} />
            <Stack.Screen name="locations" options={{ presentation: 'modal' }} />
            <Stack.Screen name="nutrient-search" options={{ presentation: 'modal' }} />
            <Stack.Screen name="merge-canonicals" options={{ presentation: 'modal' }} />
            <Stack.Screen name="recipes" />
            <Stack.Screen name="recipe-intake" options={{ presentation: 'modal' }} />
            <Stack.Screen name="recipe/[id]" />
            <Stack.Screen name="debug/tokens" options={{ presentation: 'modal' }} />
          </Stack>
          )}
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
