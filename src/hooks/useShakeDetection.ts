import { useEffect, useRef, useCallback } from 'react';
import { Accelerometer } from 'expo-sensors';
import { TIMING } from '../constants';

export function useShakeDetection(onShake: () => void) {
  const buffer = useRef<number[]>([]);
  const onShakeRef = useRef(onShake);
  onShakeRef.current = onShake;

  useEffect(() => {
    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();

      if (magnitude > TIMING.SHAKE_THRESHOLD) {
        buffer.current.push(now);
        buffer.current = buffer.current.filter((t) => now - t < TIMING.SHAKE_WINDOW_MS);

        if (buffer.current.length >= 3) {
          buffer.current = [];
          onShakeRef.current();
        }
      }
    });

    return () => subscription.remove();
  }, []);
}
