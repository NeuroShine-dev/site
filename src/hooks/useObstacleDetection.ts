import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { obstacleDetector, obstacleAudioAnnouncement } from '../services/obstacle';
import { tts } from '../services/tts';
import { haptics } from '../services/haptics';
import { ObstacleAlert } from '../types';

interface ObstacleDetectionOptions {
  active?: boolean;
}

export function useObstacleDetection({ active = true }: ObstacleDetectionOptions = {}) {
  const { settings, deviceCapabilities, addObstacleAlert } = useAppStore();
  const lastCriticalAlert = useRef<number>(0);

  const handleObstacles = useCallback(
    (alerts: ObstacleAlert[]) => {
      if (!active) return;

      // Sort by urgency — process most critical first
      const sorted = [...alerts].sort((a, b) => urgencyOrder(b.urgency) - urgencyOrder(a.urgency));

      for (const alert of sorted) {
        addObstacleAlert(alert);

        // Critical alerts interrupt everything
        if (alert.urgency === 'critical') {
          const now = Date.now();
          if (now - lastCriticalAlert.current > 500) {
            lastCriticalAlert.current = now;
            const announcement = obstacleAudioAnnouncement(alert);
            tts.speak({ text: announcement, priority: 'critical', interruptCurrent: true });
            haptics.obstacleAlert(alert.zone, alert.urgency);
          }
        } else if (alert.urgency === 'close') {
          const announcement = obstacleAudioAnnouncement(alert);
          tts.speak({ text: announcement, priority: 'high' });
          haptics.obstacleAlert(alert.zone, alert.urgency);
        } else {
          const announcement = obstacleAudioAnnouncement(alert);
          tts.speak({ text: announcement, priority: 'normal' });
          haptics.obstacleAlert(alert.zone, alert.urgency);
        }
      }
    },
    [active, addObstacleAlert],
  );

  useEffect(() => {
    obstacleDetector.configure(settings.obstacleSensitivity);

    if (active) {
      obstacleDetector.start();
    } else {
      obstacleDetector.stop();
    }

    const removeListener = obstacleDetector.addListener(handleObstacles);

    return () => {
      removeListener();
      obstacleDetector.stop();
    };
  }, [active, settings.obstacleSensitivity, handleObstacles]);

  return { obstacleDetector };
}

function urgencyOrder(urgency: ObstacleAlert['urgency']): number {
  const order = { critical: 3, close: 2, mid: 1, far: 0 };
  return order[urgency];
}
