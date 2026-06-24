import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { emergencyService } from '../../src/services/emergency';
import { tts } from '../../src/services/tts';
import { haptics } from '../../src/services/haptics';
import { useVoiceCommands } from '../../src/hooks/useVoiceCommands';
import { COLORS } from '../../src/constants';
import { EmergencyEvent } from '../../src/types';

export default function EmergencyScreen() {
  const router = useRouter();
  const { user, isEmergencyActive, setEmergencyActive, resolveEmergency } = useAppStore();
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    emergencyService.setCallbacks(
      (active: boolean, event?: EmergencyEvent) => {
        setEmergencyActive(active, event);
        if (!active) {
          setCountdown(null);
        }
      },
      (seconds: number) => setCountdown(seconds),
    );
  }, [setEmergencyActive]);

  useEffect(() => {
    // Auto-trigger on opening this screen (it's always intentional)
    if (!isEmergencyActive && user) {
      emergencyService.trigger('double_tap', user.emergencyContacts, user.id, user.name);
    }
  }, []); // Only on mount

  const handleCancel = useCallback(() => {
    emergencyService.cancel();
    resolveEmergency();
    setCountdown(null);
    router.back();
  }, [resolveEmergency, router]);

  const handleCall911 = useCallback(() => {
    emergencyService.call911();
  }, []);

  const handleCommand = useCallback(
    (command: string) => {
      if (command === 'CANCEL') handleCancel();
      if (command === 'CALL_911') handleCall911();
    },
    [handleCancel, handleCall911],
  );

  useVoiceCommands({ onCommand: handleCommand, active: true });

  const primaryContact = user?.emergencyContacts?.[0];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text
          style={styles.title}
          accessible
          accessibilityRole="header"
          accessibilityLiveRegion="assertive"
        >
          Emergency Mode
        </Text>

        {isEmergencyActive ? (
          <>
            <Text
              style={styles.statusText}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Emergency active. Alerting ${primaryContact?.name ?? 'your emergency contact'} and sharing your live location.`}
            >
              Alerting {primaryContact?.name ?? 'your emergency contact'} and sharing your live location.
            </Text>

            {countdown !== null && countdown > 0 && (
              <View style={styles.countdownBox} accessible accessibilityLiveRegion="assertive">
                <Text style={styles.countdownLabel}>Calling in</Text>
                <Text style={styles.countdownNumber}>{countdown}</Text>
                <Text style={styles.countdownLabel}>seconds</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.statusText} accessible>
            Activating emergency mode...
          </Text>
        )}

        <TouchableOpacity
          style={styles.call911Button}
          onPress={handleCall911}
          accessible
          accessibilityLabel="Call 911"
          accessibilityRole="button"
          accessibilityHint="Immediately calls emergency services"
        >
          <Text style={styles.call911Text}>Call 911</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          accessible
          accessibilityLabel="Cancel emergency. Tap if you are okay."
          accessibilityRole="button"
          accessibilityHint="Say I'm okay or tap here to cancel"
        >
          <Text style={styles.cancelText}>I'm Okay — Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.hint} accessible accessibilityLabel="Say I'm okay or cancel to stop emergency mode">
          Say "I'm okay" or "cancel" to stop
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a0000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },
  title: {
    color: COLORS.EMERGENCY,
    fontSize: 40,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 1,
  },
  statusText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 30,
  },
  countdownBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(231,76,60,0.15)',
    borderWidth: 2,
    borderColor: COLORS.EMERGENCY,
    borderRadius: 20,
    paddingHorizontal: 48,
    paddingVertical: 24,
  },
  countdownLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  countdownNumber: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 80,
    fontWeight: '900',
    lineHeight: 90,
  },
  call911Button: {
    width: '100%',
    backgroundColor: COLORS.EMERGENCY,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  call911Text: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cancelButton: {
    width: '100%',
    backgroundColor: COLORS.SUCCESS,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '800',
  },
  hint: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    textAlign: 'center',
  },
});
