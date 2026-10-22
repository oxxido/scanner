import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold, useFonts } from '@expo-google-fonts/barlow';
import { BarlowCondensed_500Medium, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StatusScreen } from '../src/components/ui';
import { cleanupStorage } from '../src/storage/cleanup';
import { loadDocuments } from '../src/storage/store';
import { colors } from '../src/theme';

void SplashScreen.preventAutoHideAsync();

type Boot = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  const [boot, setBoot] = useState<Boot>({ state: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        await loadDocuments();
      } catch (err) {
        setBoot({ state: 'error', message: err instanceof Error ? err.message : String(err) });
        return;
      }
      // La limpieza nunca debe impedir abrir la app.
      await cleanupStorage().catch((err) => console.warn('[boot] limpieza fallida', err));
      setBoot({ state: 'ready' });
    })();
  }, []);

  const fontsDone = fontsLoaded || !!fontError;
  useEffect(() => {
    if (fontsDone && boot.state !== 'loading') void SplashScreen.hideAsync();
  }, [fontsDone, boot.state]);

  if (!fontsDone || boot.state === 'loading') return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {boot.state === 'error' ? (
          <StatusScreen icon="!" tone="danger" title="No se pudo abrir" body={`Los documentos guardados no se pudieron leer. ${boot.message}`} />
        ) : (
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
            <Stack.Screen name="permission" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: colors.dark } }} />
            <Stack.Screen name="document/[id]/corners/[pageId]" options={{ contentStyle: { backgroundColor: colors.dark } }} />
          </Stack>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
