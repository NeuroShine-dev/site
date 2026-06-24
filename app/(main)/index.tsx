import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { AccessibleZone } from '../../src/components/AccessibleZone';
import { ObstacleAlertBanner } from '../../src/components/ObstacleAlertBanner';
import { VoiceInputOverlay } from '../../src/components/VoiceInputOverlay';
import { tts } from '../../src/services/tts';
import { haptics } from '../../src/services/haptics';
import { useVoiceCommands } from '../../src/hooks/useVoiceCommands';
import { HOME_ZONES, COLORS } from '../../src/constants';

export default function HomeScreen() {
  const router = useRouter();
  const { user, deviceCapabilities, activeObstacles } = useAppStore();

  useEffect(() => {
    const tierMsg = deviceCapabilities
      ? ` You are on tier ${deviceCapabilities.tier}.`
      : '';
    tts.speakNormal(
      `BlindAid ready.${tierMsg} Tap any zone to hear what it does. Double tap to activate.`,
    );
  }, [deviceCapabilities]);

  const handleCommand = useCallback(
    (command: string, fullText: string) => {
      switch (command) {
        case 'NAVIGATE':
          router.push('/(main)/navigate');
          break;
        case 'LOOK_AROUND':
          router.push('/(main)/look-around');
          break;
        case 'EMERGENCY':
          router.push('/(main)/emergency');
          break;
        case 'SETTINGS':
          router.push('/(main)/settings');
          break;
        case 'CONNECT_VEST':
          tts.speakNormal('Opening vest settings.');
          router.push('/(main)/settings');
          break;
        case 'RESTART_TUTORIAL':
          router.replace('/(auth)/onboarding');
          break;
        default:
          break;
      }
    },
    [router],
  );

  const { } = useVoiceCommands({
    onCommand: handleCommand,
    active: true,
  });

  const zones = [
    {
      id: 'navigate',
      label: 'Navigate',
      description: 'Get turn-by-turn directions to any destination. Say where you want to go.',
      onActivate: () => router.push('/(main)/navigate'),
      style: styles.topLeft,
    },
    {
      id: 'look_around',
      label: 'Look Around',
      description: "I'll describe everything around you right now.",
      onActivate: () => router.push('/(main)/look-around'),
      style: styles.topRight,
    },
    {
      id: 'emergency',
      label: 'Emergency',
      description: 'Alert your emergency contacts and share your live location.',
      onActivate: () => router.push('/(main)/emergency'),
      style: styles.bottomLeft,
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Change how the app speaks, navigates, and alerts you.',
      onActivate: () => router.push('/(main)/settings'),
      style: styles.bottomRight,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ObstacleAlertBanner alerts={activeObstacles} />

      <Text
        style={styles.srOnly}
        accessible
        accessibilityLabel={`BlindAid home screen. ${user?.name ? `Welcome, ${user.name}.` : ''} Four zones available: Navigate, Look Around, Emergency, and Settings.`}
        accessibilityLiveRegion="polite"
      >
        {''}
      </Text>

      <View style={styles.grid}>
        <View style={styles.row}>
          {zones.slice(0, 2).map((z) => (
            <AccessibleZone
              key={z.id}
              label={z.label}
              description={z.description}
              onActivate={z.onActivate}
              style={z.style}
            />
          ))}
        </View>
        <View style={[styles.row, styles.rowDivider]}>
          {zones.slice(2).map((z) => (
            <AccessibleZone
              key={z.id}
              label={z.label}
              description={z.description}
              onActivate={z.onActivate}
              style={z.id === 'emergency' ? [z.style, styles.emergencyZone] : z.style}
            />
          ))}
        </View>
      </View>

      <VoiceInputOverlay listening={true} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  grid: {
    flex: 1,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  topLeft: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0f2744',
  },
  topRight: {
    backgroundColor: '#0d2238',
  },
  bottomLeft: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.08)',
  },
  bottomRight: {
    backgroundColor: '#16213e',
  },
  emergencyZone: {
    backgroundColor: '#2d0a0a',
  },
  srOnly: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});
