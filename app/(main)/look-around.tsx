import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { describeScene, checkForSignificantChange } from '../../src/services/openaiVision';
import { tts } from '../../src/services/tts';
import { haptics } from '../../src/services/haptics';
import { useVoiceCommands } from '../../src/hooks/useVoiceCommands';
import { COLORS, TIMING } from '../../src/constants';
import { SceneQuery } from '../../src/types';

type State = 'idle' | 'capturing' | 'describing' | 'passive';

export default function LookAroundScreen() {
  const router = useRouter();
  const { isOffline, setLookAroundActive } = useAppStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [appState, setAppState] = useState<State>('idle');
  const [lastDescription, setLastDescription] = useState('');
  const cameraRef = useRef<CameraView>(null);
  const passiveTimer = useRef<ReturnType<typeof setInterval>>();
  const lastFrameB64 = useRef<string>('');

  useEffect(() => {
    setLookAroundActive(true);
    tts.speakNormal(
      'Look Around. I can see through your camera. Double tap to describe what's around you. Or say: "what's around me", "read this", "is anyone near me", "what does the sign say".',
    );
    return () => {
      setLookAroundActive(false);
      clearInterval(passiveTimer.current);
    };
  }, [setLookAroundActive]);

  const captureAndDescribe = useCallback(
    async (query: SceneQuery = 'full') => {
      if (isOffline) {
        tts.speakNormal(
          'Offline mode. Scene description is unavailable. Obstacle detection is still active.',
        );
        return;
      }
      if (appState === 'capturing' || appState === 'describing') return;
      if (!cameraRef.current) return;

      setAppState('capturing');
      await haptics.confirmAction();

      const timeoutId = setTimeout(() => {
        if (appState !== 'describing') {
          tts.speakLow('Looking around, one moment.');
        }
      }, TIMING.SCENE_DESCRIPTION_TIMEOUT_MS);

      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
          skipProcessing: true,
        });

        if (!photo?.base64) throw new Error('No image data');

        clearTimeout(timeoutId);
        setAppState('describing');

        const description = await describeScene(photo.base64, query);
        lastFrameB64.current = photo.base64;
        setLastDescription(description.summary);

        tts.speakNormal(description.summary);
        await haptics.confirmAction();
      } catch (err) {
        clearTimeout(timeoutId);
        tts.speakNormal("I couldn't get a description right now. Please try again.");
      } finally {
        setAppState('idle');
      }
    },
    [appState, isOffline],
  );

  const startPassiveMode = useCallback(() => {
    setAppState('passive');
    tts.speakNormal('Passive mode on. I will alert you when something significant changes.');

    passiveTimer.current = setInterval(async () => {
      if (!cameraRef.current) return;
      try {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.3,
          skipProcessing: true,
        });
        if (!photo?.base64) return;

        if (lastFrameB64.current) {
          const { changed, description } = await checkForSignificantChange(
            lastFrameB64.current,
            photo.base64,
          );
          if (changed && description) {
            tts.speak({ text: description, priority: 'high' });
            await haptics.confirmAction();
          }
        }
        lastFrameB64.current = photo.base64;
      } catch {
        // Silent — passive scan failures are non-fatal
      }
    }, TIMING.PASSIVE_SCAN_DEFAULT_MS * 1000);
  }, []);

  const stopPassiveMode = useCallback(() => {
    clearInterval(passiveTimer.current);
    setAppState('idle');
    tts.speakNormal('Passive mode off.');
  }, []);

  const handleCommand = useCallback(
    (command: string) => {
      const queryMap: Partial<Record<string, SceneQuery>> = {
        MORE_DETAIL: 'full',
        WHAT_SIGN: 'sign',
        ANYONE_NEAR: 'people',
        COLOR: 'color',
        READ_TEXT: 'read_text',
        IDENTIFY: 'identify_object',
        CURRENCY: 'currency',
        MENU: 'menu',
      };
      const query = queryMap[command];
      if (query) {
        captureAndDescribe(query);
      } else if (command === 'LOOK_AROUND') {
        captureAndDescribe('full');
      }
    },
    [captureAndDescribe],
  );

  useVoiceCommands({ onCommand: handleCommand, active: true });

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permissionText}>
          Camera access is needed to describe your surroundings.
        </Text>
        <TouchableOpacity
          style={styles.permButton}
          onPress={requestPermission}
          accessible
          accessibilityLabel="Grant camera access"
          accessibilityRole="button"
        >
          <Text style={styles.permButtonText}>Allow Camera</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />

      {/* Translucent overlay so screen content is auditory, not visual */}
      <View style={styles.overlay} accessible={false} pointerEvents="none" />

      <View style={styles.controls}>
        <Text
          style={styles.statusText}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={
            appState === 'describing' ? 'Describing scene' :
            appState === 'capturing' ? 'Capturing image' :
            appState === 'passive' ? 'Passive mode active, watching for changes' :
            'Ready. Double tap to describe your surroundings.'
          }
        >
          {appState === 'capturing' && 'Capturing...'}
          {appState === 'describing' && 'Describing...'}
          {appState === 'passive' && 'Passive mode on'}
          {appState === 'idle' && 'Ready'}
        </Text>

        <TouchableOpacity
          style={styles.mainButton}
          onPress={() => captureAndDescribe('full')}
          accessible
          accessibilityLabel="Describe surroundings"
          accessibilityHint="Double tap to take a photo and describe what is around you"
          accessibilityRole="button"
          disabled={appState === 'capturing' || appState === 'describing'}
        >
          <Text style={styles.mainButtonText}>Describe</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, appState === 'passive' && styles.activeButton]}
          onPress={appState === 'passive' ? stopPassiveMode : startPassiveMode}
          accessible
          accessibilityLabel={appState === 'passive' ? 'Stop passive mode' : 'Start passive mode'}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>
            {appState === 'passive' ? 'Stop Passive' : 'Passive Mode'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            tts.stop();
            router.back();
          }}
          accessible
          accessibilityLabel="Go back to home"
          accessibilityRole="button"
        >
          <Text style={styles.secondaryButtonText}>← Home</Text>
        </TouchableOpacity>
      </View>

      {lastDescription ? (
        <View
          style={styles.lastResult}
          accessible
          accessibilityLabel={`Last description: ${lastDescription}`}
        >
          <Text style={styles.lastResultText} numberOfLines={3}>
            {lastDescription}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  controls: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 14,
  },
  statusText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  mainButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  mainButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 24,
    fontWeight: '800',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: `${COLORS.PRIMARY}44`,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
  },
  secondaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
  },
  lastResult: {
    position: 'absolute',
    top: 60,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.PRIMARY,
  },
  lastResultText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    lineHeight: 22,
  },
  permissionText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    textAlign: 'center',
    padding: 40,
    lineHeight: 30,
  },
  permButton: {
    backgroundColor: COLORS.PRIMARY,
    margin: 24,
    padding: 20,
    borderRadius: 14,
    alignItems: 'center',
  },
  permButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
});
