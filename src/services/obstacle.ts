import { ObstacleAlert, ObstacleZone, ObstacleUrgency, DepthFrame, DeviceTier } from '../types';
import { OBSTACLE_THRESHOLDS, SENSITIVITY_MAX_DISTANCE, URGENCY_AT_DISTANCE } from '../constants';
import type { ObstacleSensitivity } from '../types';

const METERS_TO_FEET = 3.28084;
const FRAME_WIDTH_ZONES = 5; // left, front-left, center, front-right, right
const HEAD_ZONE_TOP_FRACTION = 0.2; // top 20% of frame = head-level

type ObstacleListener = (alerts: ObstacleAlert[]) => void;

class ObstacleDetectionService {
  private listeners: ObstacleListener[] = [];
  private sensitivity: ObstacleSensitivity = 'medium';
  private lastAlertTimes: Partial<Record<ObstacleZone, number>> = {};
  private cooldownMs = 2500;
  private active = false;

  configure(sensitivity: ObstacleSensitivity) {
    this.sensitivity = sensitivity;
  }

  start() {
    this.active = true;
  }

  stop() {
    this.active = false;
    this.lastAlertTimes = {};
  }

  addListener(listener: ObstacleListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Process a depth frame from ARKit, ARCore, or on-device depth estimation.
   * depth.data is a Float32Array of distance values in meters, row-major.
   */
  processDepthFrame(frame: DepthFrame, _tier: DeviceTier): ObstacleAlert[] {
    if (!this.active) return [];

    const { data, width, height } = frame;
    const maxDistanceFeet = SENSITIVITY_MAX_DISTANCE[this.sensitivity];
    const maxDistanceMeters = maxDistanceFeet / METERS_TO_FEET;
    const now = Date.now();
    const alerts: ObstacleAlert[] = [];

    const zoneWidth = Math.floor(width / FRAME_WIDTH_ZONES);
    const zones: ObstacleZone[] = ['left', 'front-left', 'center', 'front-right', 'right'];

    for (let zoneIdx = 0; zoneIdx < FRAME_WIDTH_ZONES; zoneIdx++) {
      const zone = zones[zoneIdx];
      const xStart = zoneIdx * zoneWidth;
      const xEnd = xStart + zoneWidth;

      // Sample a grid within this zone (avoid full scan for performance)
      let minDistance = Infinity;
      let headLevelMin = Infinity;
      const step = 4;

      for (let y = 0; y < height; y += step) {
        const isHeadLevel = y < height * HEAD_ZONE_TOP_FRACTION;
        for (let x = xStart; x < xEnd; x += step) {
          const val = data[y * width + x];
          if (!val || !isFinite(val) || val <= 0) continue;
          if (val < minDistance) minDistance = val;
          if (isHeadLevel && val < headLevelMin) headLevelMin = val;
        }
      }

      if (minDistance < maxDistanceMeters) {
        const distFeet = minDistance * METERS_TO_FEET;
        const urgency = URGENCY_AT_DISTANCE(distFeet);

        // Cooldown per zone to avoid alert spam
        const lastAlert = this.lastAlertTimes[zone] ?? 0;
        const effectiveCooldown = urgency === 'critical' ? 500 : this.cooldownMs;

        if (now - lastAlert >= effectiveCooldown) {
          alerts.push({
            zone,
            distanceFeet: Math.round(distFeet * 10) / 10,
            urgency,
            isMoving: false, // motion detection handled separately
            timestamp: now,
          });
          this.lastAlertTimes[zone] = now;
        }
      }

      // Head-level obstacle (overhanging)
      if (headLevelMin < 1.5 && zone === 'center') {
        const lastAlert = this.lastAlertTimes['center'] ?? 0;
        if (now - lastAlert >= 4000) {
          alerts.push({
            zone: 'center',
            distanceFeet: headLevelMin * METERS_TO_FEET,
            urgency: 'close',
            isMoving: false,
            timestamp: now,
          });
          this.lastAlertTimes['center'] = now;
        }
      }
    }

    // Staircase / drop-off detection: look for sudden depth increase in lower frame
    const dropoffAlert = this.detectDropOff(data, width, height, now);
    if (dropoffAlert) alerts.push(dropoffAlert);

    if (alerts.length > 0) {
      this.notify(alerts);
    }

    return alerts;
  }

  private detectDropOff(
    data: Float32Array,
    width: number,
    height: number,
    now: number,
  ): ObstacleAlert | null {
    const lowerRowStart = Math.floor(height * 0.6);
    const step = 8;
    let prevDepth = 0;
    let maxJump = 0;

    for (let y = lowerRowStart; y < height - step; y += step) {
      for (let x = Math.floor(width * 0.3); x < Math.floor(width * 0.7); x += step) {
        const curr = data[y * width + x];
        const next = data[(y + step) * width + x];
        if (!curr || !next || !isFinite(curr) || !isFinite(next)) continue;
        const jump = next - curr;
        if (jump > maxJump) maxJump = jump;
        prevDepth = curr;
      }
    }

    // > 0.2 meters sudden drop = step or curb
    const lastAlert = this.lastAlertTimes['center'] ?? 0;
    if (maxJump > 0.2 && now - lastAlert >= 3000) {
      this.lastAlertTimes['center'] = now;
      return {
        zone: 'center',
        distanceFeet: prevDepth * METERS_TO_FEET,
        urgency: 'close',
        isMoving: false,
        timestamp: now,
      };
    }

    return null;
  }

  /**
   * Merge vest sensor data into the current spatial model.
   * Called when a BLE packet arrives from the vest.
   */
  processVestPacket(zone: ObstacleZone, distanceMeters: number): void {
    if (!this.active) return;

    const distFeet = distanceMeters * METERS_TO_FEET;
    const maxFeet = SENSITIVITY_MAX_DISTANCE[this.sensitivity];
    if (distFeet > maxFeet) return;

    const urgency = URGENCY_AT_DISTANCE(distFeet);
    const now = Date.now();
    const lastAlert = this.lastAlertTimes[zone] ?? 0;
    const effectiveCooldown = urgency === 'critical' ? 500 : this.cooldownMs;

    if (now - lastAlert >= effectiveCooldown) {
      this.lastAlertTimes[zone] = now;
      this.notify([
        { zone, distanceFeet: distFeet, urgency, isMoving: false, timestamp: now },
      ]);
    }
  }

  private notify(alerts: ObstacleAlert[]): void {
    this.listeners.forEach((l) => l(alerts));
  }
}

export function obstacleAudioAnnouncement(alert: ObstacleAlert): string {
  const { zone, distanceFeet, urgency, isMoving } = alert;

  const dirMap: Record<ObstacleZone, string> = {
    left: 'to your left',
    'front-left': 'ahead on your left',
    center: 'directly ahead',
    'front-right': 'ahead on your right',
    right: 'to your right',
    'rear-left': 'behind you on your left',
    'rear-right': 'behind you on your right',
  };

  const direction = dirMap[zone];
  const distStr =
    distanceFeet <= 1
      ? 'less than a foot away'
      : `about ${Math.round(distanceFeet)} feet away`;

  if (urgency === 'critical') {
    return `Stop. Something is ${direction}, ${distStr}.`;
  }

  if (isMoving) {
    return `Something is moving toward you from ${direction.replace('to your ', '').replace('ahead on your ', '')}. ${distStr}.`;
  }

  if (urgency === 'close') {
    return `Watch out — obstacle ${direction}, ${distStr}.`;
  }

  return `Obstacle ${direction}, ${distStr}.`;
}

export const obstacleDetector = new ObstacleDetectionService();
