import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAppStore } from '../../src/store/appStore';
import { subscribeToGuardianMessages } from '../../src/services/supabase';
import { tts } from '../../src/services/tts';
import { useObstacleDetection } from '../../src/hooks/useObstacleDetection';
import { useEmergency } from '../../src/hooks/useEmergency';

export default function MainLayout() {
  const { user } = useAppStore();

  // Always-on obstacle detection across all main screens
  useObstacleDetection({ active: true });

  // Shake-to-emergency across all main screens
  useEmergency();

  // Guardian message subscription
  useEffect(() => {
    if (!user) return;
    const channel = subscribeToGuardianMessages(user.id, (message) => {
      tts.speak({
        text: `Message from your guardian: ${message}`,
        priority: 'high',
      });
    });
    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
      }}
    />
  );
}
