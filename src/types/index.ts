// ─── Device Tiers ────────────────────────────────────────────────────────────

export type DeviceTier = 1 | 2 | 3;

export interface DeviceCapabilities {
  tier: DeviceTier;
  hasLiDAR: boolean;
  hasARCore: boolean;
  hasVest: boolean;
  announcement: string;
}

// ─── User & Auth ─────────────────────────────────────────────────────────────

export type UserRole = 'blind_user' | 'guardian';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  language: SupportedLanguage;
  speechSpeed: SpeechSpeed;
  speechGender: SpeechGender;
  deviceTier: DeviceTier;
  onboardingComplete: boolean;
  emergencyContacts: EmergencyContact[];
  guardianId?: string;
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  priority: number;
}

export type SpeechSpeed = 'slow' | 'normal' | 'fast';
export type SpeechGender = 'male' | 'female';
export type SupportedLanguage = 'en' | 'es' | 'hi';

// ─── Obstacle Detection ───────────────────────────────────────────────────────

export type ObstacleZone =
  | 'left'
  | 'front-left'
  | 'center'
  | 'front-right'
  | 'right'
  | 'rear-left'
  | 'rear-right';

export type ObstacleUrgency = 'far' | 'mid' | 'close' | 'critical';

export interface ObstacleAlert {
  zone: ObstacleZone;
  distanceFeet: number;
  urgency: ObstacleUrgency;
  isMoving: boolean;
  timestamp: number;
}

export type ObstacleSensitivity = 'low' | 'medium' | 'high';

export interface DepthFrame {
  data: Float32Array;
  width: number;
  height: number;
  source: 'lidar' | 'arcore' | 'depth_estimation';
  timestamp: number;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export interface NavigationRoute {
  destination: string;
  distanceMiles: number;
  durationMinutes: number;
  steps: NavigationStep[];
  currentStepIndex: number;
}

export interface NavigationStep {
  instruction: string;
  distanceFeet: number;
  landmark?: string;
  maneuver: string;
  coordinates: LatLng;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export type NavigationMode = 'walking' | 'transit' | 'indoor';

// ─── Scene Description ────────────────────────────────────────────────────────

export interface SceneDescription {
  summary: string;
  hazards: string[];
  people: string[];
  obstacles: string[];
  signage: string[];
  exits: string[];
  context: string;
  timestamp: number;
}

export type SceneQuery =
  | 'full'
  | 'sign'
  | 'people'
  | 'color'
  | 'read_text'
  | 'identify_object'
  | 'currency'
  | 'menu';

// ─── Emergency ────────────────────────────────────────────────────────────────

export type EmergencyTrigger =
  | 'double_tap'
  | 'voice'
  | 'shake'
  | 'vest_fall'
  | 'manual';

export interface EmergencyEvent {
  id: string;
  triggeredAt: string;
  trigger: EmergencyTrigger;
  location?: LatLng;
  resolvedAt?: string;
  resolvedBy?: 'user' | 'guardian';
}

// ─── Vest (BLE) ───────────────────────────────────────────────────────────────

export type VestHapticZone =
  | 'left_shoulder'
  | 'right_shoulder'
  | 'left_chest'
  | 'right_chest'
  | 'center_chest'
  | 'upper_back_left'
  | 'upper_back_right'
  | 'lower_front_left'
  | 'lower_front_right'
  | 'full_torso';

export type VestHapticPattern =
  | 'single_pulse'
  | 'double_pulse'
  | 'rapid_continuous'
  | 'long_hold'
  | 'compass_rotate'
  | 'ascending'
  | 'descending'
  | 'full_burst';

export interface VestState {
  connected: boolean;
  batteryPercent: number;
  lastConnectedAt?: string;
  deviceId?: string;
  deviceName?: string;
}

export interface VestSensorPacket {
  zone: ObstacleZone;
  distanceMeters: number;
  timestamp: number;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AppSettings {
  speechSpeed: SpeechSpeed;
  speechGender: SpeechGender;
  language: SupportedLanguage;
  obstacleSensitivity: ObstacleSensitivity;
  passiveScanFrequencySeconds: number;
  batterySaverMode: boolean;
  offlinePreference: 'on_device' | 'cloud' | 'auto';
  notificationsEnabled: boolean;
  hapticEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  speechSpeed: 'normal',
  speechGender: 'female',
  language: 'en',
  obstacleSensitivity: 'medium',
  passiveScanFrequencySeconds: 3,
  batterySaverMode: false,
  offlinePreference: 'auto',
  notificationsEnabled: true,
  hapticEnabled: true,
};

// ─── Guardian ─────────────────────────────────────────────────────────────────

export interface GuardianUser {
  id: string;
  name: string;
  email: string;
  linkedUsers: LinkedBlindUser[];
}

export interface LinkedBlindUser {
  userId: string;
  userName: string;
  currentLocation?: LatLng;
  lastSeen: string;
  safeZones: SafeZone[];
}

export interface SafeZone {
  id: string;
  name: string;
  center: LatLng;
  radiusMeters: number;
}

// ─── Audio Priority ───────────────────────────────────────────────────────────

export type AudioPriority = 'critical' | 'high' | 'normal' | 'low';

export interface AudioMessage {
  text: string;
  priority: AudioPriority;
  interruptCurrent?: boolean;
  hapticPattern?: VestHapticPattern;
}
