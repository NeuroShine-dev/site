import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { navigationService } from '../../src/services/navigation';
import { tts } from '../../src/services/tts';
import { haptics } from '../../src/services/haptics';
import { useVoiceCommands } from '../../src/hooks/useVoiceCommands';
import { NavigationRoute, NavigationStep } from '../../src/types';
import { COLORS } from '../../src/constants';

type NavState = 'idle' | 'entering_destination' | 'confirming' | 'navigating' | 'arrived';

export default function NavigateScreen() {
  const router = useRouter();
  const { setCurrentRoute } = useAppStore();
  const [navState, setNavState] = useState<NavState>('idle');
  const [destination, setDestination] = useState('');
  const [route, setRoute] = useState<NavigationRoute | null>(null);
  const [currentStep, setCurrentStep] = useState<NavigationStep | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const destinationRef = useRef('');

  useEffect(() => {
    tts.speakNormal(
      'Navigation. Where would you like to go? Say your destination or type it in.',
    );
    setNavState('entering_destination');
  }, []);

  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  const startNavigation = useCallback(
    async (dest: string) => {
      if (!dest.trim()) {
        tts.speakNormal('Where would you like to go?');
        return;
      }

      tts.speakNormal(`Looking up directions to ${dest}. One moment.`);
      try {
        const r = await navigationService.startNavigation(dest);
        setRoute(r);
        setCurrentRoute(r);
        setNavState('navigating');

        const durationStr = r.durationMinutes === 1 ? '1 minute' : `${r.durationMinutes} minutes`;
        const distStr = r.distanceMiles < 0.1
          ? `${Math.round(r.distanceMiles * 5280)} feet`
          : `${r.distanceMiles.toFixed(1)} miles`;

        tts.speakNormal(
          `Navigating to ${dest}. ${distStr}, about ${durationStr} walking. Starting now.`,
        );
        await haptics.navigationTurn();

        navigationService.setCallbacks(
          (step, idx) => {
            setCurrentStep(step);
            setCurrentStepIndex(idx);
            const announcement = navigationService.buildStepAnnouncement(step);
            tts.speak({ text: announcement, priority: 'high' });
            haptics.navigationTurn();
          },
          (arrivedAt) => {
            setNavState('arrived');
            setCurrentRoute(null);
            haptics.arrival();
            tts.speak({
              text: `You've arrived at ${arrivedAt}. Based on the camera, check ahead and to your sides for the entrance.`,
              priority: 'high',
            });
          },
          (rerouteMsg) => {
            tts.speak({ text: rerouteMsg, priority: 'high' });
          },
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Could not get directions right now.';
        tts.speakNormal(msg);
        setNavState('entering_destination');
      }
    },
    [setCurrentRoute],
  );

  const stopNavigation = useCallback(() => {
    navigationService.stopNavigation();
    setCurrentRoute(null);
    setRoute(null);
    setNavState('idle');
    tts.speakNormal('Navigation stopped.');
  }, [setCurrentRoute]);

  const handleCommand = useCallback(
    (command: string, fullText: string) => {
      if (command === 'CANCEL') {
        stopNavigation();
      } else if (command === 'NAVIGATE') {
        // Extract destination from full text
        const match = fullText.match(/(?:navigate to|take me to|directions to)\s+(.+)/i);
        if (match?.[1]) {
          setDestination(match[1]);
          startNavigation(match[1]);
        }
      }
    },
    [stopNavigation, startNavigation],
  );

  useVoiceCommands({ onCommand: handleCommand, active: true });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Map is visual context only — all navigation is audio */}
      {route && (
        <MapView
          style={styles.map}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}

      <View style={[styles.panel, route && styles.panelPartial]}>
        {navState === 'entering_destination' && (
          <View style={styles.section}>
            <Text style={styles.label} accessible accessibilityRole="header">
              Where to?
            </Text>
            <TextInput
              style={styles.input}
              value={destination}
              onChangeText={setDestination}
              placeholder="Destination — type or speak"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              accessible
              accessibilityLabel="Enter destination"
              autoFocus
              returnKeyType="go"
              onSubmitEditing={() => startNavigation(destination)}
            />
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => startNavigation(destination)}
              accessible
              accessibilityLabel="Start navigation"
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Go</Text>
            </TouchableOpacity>
          </View>
        )}

        {navState === 'navigating' && currentStep && (
          <View style={styles.section}>
            <Text
              style={styles.stepInstruction}
              accessible
              accessibilityLiveRegion="polite"
              accessibilityLabel={`Current direction: ${currentStep.instruction}`}
            >
              {currentStep.instruction}
            </Text>
            <Text style={styles.stepDistance}>
              {currentStep.distanceFeet < 200
                ? `${currentStep.distanceFeet} feet`
                : `${Math.round(currentStep.distanceFeet / 528) / 10} mi`}
            </Text>
            {route && (
              <Text style={styles.stepProgress} accessible accessibilityLabel={`Step ${currentStepIndex + 1} of ${route.steps.length}`}>
                Step {currentStepIndex + 1} of {route.steps.length}
              </Text>
            )}
            <TouchableOpacity
              style={styles.stopButton}
              onPress={stopNavigation}
              accessible
              accessibilityLabel="Stop navigation"
              accessibilityRole="button"
            >
              <Text style={styles.stopButtonText}>Stop Navigation</Text>
            </TouchableOpacity>
          </View>
        )}

        {navState === 'arrived' && (
          <View style={styles.section}>
            <Text style={styles.arrivedText} accessible accessibilityRole="header">
              You've Arrived
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setNavState('entering_destination');
                setDestination('');
                setRoute(null);
                setCurrentStep(null);
              }}
              accessible
              accessibilityLabel="Navigate somewhere else"
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Navigate Somewhere Else</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navState === 'navigating') stopNavigation();
            router.back();
          }}
          accessible
          accessibilityLabel="Go back to home"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>← Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  map: {
    flex: 1,
  },
  panel: {
    backgroundColor: COLORS.DARK_BG,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  panelPartial: {
    maxHeight: 320,
  },
  section: {
    gap: 16,
  },
  label: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '800',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 22,
    fontWeight: '800',
  },
  stepInstruction: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
  },
  stepDistance: {
    color: COLORS.PRIMARY,
    fontSize: 36,
    fontWeight: '800',
  },
  stepProgress: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
  stopButton: {
    backgroundColor: '#c0392b',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  stopButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  arrivedText: {
    color: COLORS.SUCCESS,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
});
