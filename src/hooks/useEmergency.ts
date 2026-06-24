import { useEffect, useRef, useCallback } from 'react';
import { Accelerometer } from 'expo-sensors';
import { useAppStore } from '../store/appStore';
import { emergencyService } from '../services/emergency';
import { TIMING } from '../constants';

export function useEmergency() {
  const { user, isEmergencyActive, setEmergencyActive, resolveEmergency } = useAppStore();
  const shakeBuffer = useRef<number[]>([]);
  const accelSubscription = useRef<ReturnType<typeof Accelerometer.addListener>>();

  const trigger = useCallback(
    async (triggerType: 'double_tap' | 'voice' | 'shake' | 'vest_fall' | 'manual') => {
      if (isEmergencyActive || !user) return;
      await emergencyService.trigger(
        triggerType,
        user.emergencyContacts,
        user.id,
        user.name,
      );
    },
    [isEmergencyActive, user],
  );

  const cancel = useCallback(() => {
    emergencyService.cancel();
    resolveEmergency();
  }, [resolveEmergency]);

  const call911 = useCallback(() => {
    emergencyService.call911();
  }, []);

  // Wire emergency service callbacks to store
  useEffect(() => {
    emergencyService.setCallbacks(
      (active, event) => setEmergencyActive(active, event),
      (_secondsRemaining) => {
        // Countdown ticks handled by emergencyService TTS
      },
    );
  }, [setEmergencyActive]);

  // Shake-to-trigger: three rapid shakes in SHAKE_WINDOW_MS
  useEffect(() => {
    Accelerometer.setUpdateInterval(100);

    accelSubscription.current = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > TIMING.SHAKE_THRESHOLD) {
        shakeBuffer.current.push(now);
        // Remove shakes outside window
        shakeBuffer.current = shakeBuffer.current.filter(
          (t) => now - t < TIMING.SHAKE_WINDOW_MS,
        );

        if (shakeBuffer.current.length >= 3) {
          shakeBuffer.current = [];
          trigger('shake');
        }
      }
    });

    return () => {
      accelSubscription.current?.remove();
    };
  }, [trigger]);

  return { trigger, cancel, call911, isEmergencyActive };
}
