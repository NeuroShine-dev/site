import { ObstacleUrgency, ObstacleSensitivity, SpeechSpeed } from '../types';

// ─── Obstacle Thresholds (feet) ───────────────────────────────────────────────

export const OBSTACLE_THRESHOLDS = {
  CRITICAL: 2,
  CLOSE: 3,
  MID: 5,
  FAR: 8,
} as const;

export const SENSITIVITY_MAX_DISTANCE: Record<ObstacleSensitivity, number> = {
  low: OBSTACLE_THRESHOLDS.CLOSE,
  medium: OBSTACLE_THRESHOLDS.MID,
  high: OBSTACLE_THRESHOLDS.FAR,
};

export const URGENCY_AT_DISTANCE = (feet: number): ObstacleUrgency => {
  if (feet <= OBSTACLE_THRESHOLDS.CRITICAL) return 'critical';
  if (feet <= OBSTACLE_THRESHOLDS.CLOSE) return 'close';
  if (feet <= OBSTACLE_THRESHOLDS.MID) return 'mid';
  return 'far';
};

// ─── Speech Rate ──────────────────────────────────────────────────────────────

export const SPEECH_RATE: Record<SpeechSpeed, number> = {
  slow: 0.75,
  normal: 1.0,
  fast: 1.4,
};

// ─── Timing ───────────────────────────────────────────────────────────────────

export const TIMING = {
  SCENE_DESCRIPTION_TIMEOUT_MS: 2000,
  PASSIVE_SCAN_DEFAULT_MS: 3000,
  EMERGENCY_CALL_COUNTDOWN_S: 10,
  OBSTACLE_ANNOUNCE_COOLDOWN_MS: 2500,
  NAVIGATION_CALLOUT_FEET: [500, 200, 50],
  VEST_RECONNECT_RETRY_MS: 5000,
  SHAKE_THRESHOLD: 2.5,
  SHAKE_WINDOW_MS: 1500,
} as const;

// ─── BLE ─────────────────────────────────────────────────────────────────────

export const BLE = {
  VEST_SERVICE_UUID: 'BA5E-0001-0000-0000-0000-000000000000',
  VEST_SENSOR_CHAR_UUID: 'BA5E-0002-0000-0000-0000-000000000000',
  VEST_HAPTIC_CHAR_UUID: 'BA5E-0003-0000-0000-0000-000000000000',
  VEST_BATTERY_CHAR_UUID: 'BA5E-0004-0000-0000-0000-000000000000',
  SCAN_TIMEOUT_MS: 10000,
  LOW_BATTERY_THRESHOLD: 20,
} as const;

// ─── Camera ───────────────────────────────────────────────────────────────────

export const CAMERA = {
  DEPTH_FPS_TIER1: 12,
  DEPTH_FPS_TIER2: 30,
  PASSIVE_SCAN_FPS: 1,
  OBSTACLE_DETECTION_FPS: 15,
  SIGNIFICANT_CHANGE_THRESHOLD: 0.25,
} as const;

// ─── API ─────────────────────────────────────────────────────────────────────

export const API = {
  OPENAI_VISION_MODEL: 'gpt-4o',
  OPENAI_MAX_TOKENS: 300,
  GOOGLE_DIRECTIONS_BASE: 'https://maps.googleapis.com/maps/api/directions/json',
  GOOGLE_PLACES_BASE: 'https://maps.googleapis.com/maps/api/place',
} as const;

// ─── Voice Commands ───────────────────────────────────────────────────────────

export const VOICE_COMMANDS = {
  LOOK_AROUND: ['look around', "what's around me", 'describe surroundings', 'what do you see'],
  NAVIGATE: ['navigate to', 'take me to', 'directions to', 'how do i get to'],
  EMERGENCY: ['emergency', 'help', 'call for help', 'sos'],
  CANCEL: ['cancel', "i'm okay", 'stop', 'nevermind'],
  SETTINGS: ['settings', 'preferences', 'options'],
  MORE_DETAIL: ['more detail', 'tell me more', 'describe more'],
  WHAT_SIGN: ['what does the sign say', 'read the sign'],
  ANYONE_NEAR: ['is anyone near me', 'are there people near me'],
  COLOR: ['what color is this'],
  READ_TEXT: ['read this', 'what does this say'],
  IDENTIFY: ['what am i holding', 'what is this'],
  CURRENCY: ['how much is this', 'what denomination'],
  MENU: ['what does the menu say', 'read the menu'],
  CONNECT_VEST: ['connect vest', 'pair vest'],
  RESTART_TUTORIAL: ['restart tutorial', 'redo onboarding', 'start over'],
  CALL_911: ['call 911', 'call nine one one'],
} as const;

// ─── Colors (internal use only — no UI dependency on color for core flow) ─────

export const COLORS = {
  PRIMARY: '#4A90D9',
  EMERGENCY: '#E74C3C',
  SUCCESS: '#27AE60',
  WARNING: '#F39C12',
  DARK_BG: '#1a1a2e',
  ZONE_OVERLAY: 'rgba(0,0,0,0.85)',
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#CCCCCC',
} as const;

// ─── Zone Labels ──────────────────────────────────────────────────────────────

export const HOME_ZONES = [
  {
    id: 'navigate',
    label: 'Navigate',
    description: 'Get turn-by-turn directions to any destination.',
    shortcut: 'Say "navigate to" followed by your destination.',
    quadrant: 'top-left' as const,
  },
  {
    id: 'look_around',
    label: 'Look Around',
    description: 'I will describe everything around you right now.',
    shortcut: 'Say "look around" anytime.',
    quadrant: 'top-right' as const,
  },
  {
    id: 'emergency',
    label: 'Emergency',
    description: 'Alert your emergency contacts and share your location.',
    shortcut: 'Say "emergency" or shake the phone three times.',
    quadrant: 'bottom-left' as const,
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Change how the app speaks, navigates, and alerts you.',
    shortcut: 'Say "settings" anytime.',
    quadrant: 'bottom-right' as const,
  },
] as const;

// ─── Onboarding Steps ─────────────────────────────────────────────────────────

export const ONBOARDING_STEPS = [
  'welcome',
  'name',
  'speech_speed',
  'voice_gender',
  'language',
  'emergency_contact',
  'guardian_link',
  'device_tier',
  'gesture_tutorial',
  'complete',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
