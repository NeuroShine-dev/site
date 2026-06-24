import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useAppStore } from '../src/store/appStore';
import { tts } from '../src/services/tts';
import { haptics } from '../src/services/haptics';
import { detectDeviceTier } from '../src/utils/deviceTier';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { hydrate, settings, setDeviceCapabilities, onboardingComplete } = useAppStore();

  useEffect(() => {
    async function init() {
      await hydrate();
      const caps = await detectDeviceTier();
      setDeviceCapabilities(caps);

      // Configure TTS with persisted settings
      tts.configure(settings.speechSpeed, settings.speechGender, settings.language);
      haptics.setEnabled(settings.hapticEnabled);

      await SplashScreen.hideAsync();
    }

    init();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" hidden />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(main)" />
        <Stack.Screen name="guardian" />
      </Stack>
    </SafeAreaProvider>
  );
}
