import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  UserProfile,
  AppSettings,
  DeviceCapabilities,
  VestState,
  NavigationRoute,
  ObstacleAlert,
  EmergencyEvent,
  DEFAULT_SETTINGS,
} from '../types';

interface AppState {
  // Auth
  user: UserProfile | null;
  isAuthenticated: boolean;
  onboardingComplete: boolean;

  // Device
  deviceCapabilities: DeviceCapabilities | null;

  // Settings
  settings: AppSettings;

  // Vest
  vest: VestState;

  // Active states
  isNavigating: boolean;
  currentRoute: NavigationRoute | null;
  activeObstacles: ObstacleAlert[];
  isEmergencyActive: boolean;
  activeEmergency: EmergencyEvent | null;
  isLookAroundActive: boolean;
  isOffline: boolean;

  // Actions
  setUser: (user: UserProfile | null) => void;
  setOnboardingComplete: (complete: boolean) => void;
  setDeviceCapabilities: (caps: DeviceCapabilities) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;
  setVestState: (vest: Partial<VestState>) => void;
  setCurrentRoute: (route: NavigationRoute | null) => void;
  setActiveObstacles: (obstacles: ObstacleAlert[]) => void;
  addObstacleAlert: (alert: ObstacleAlert) => void;
  clearObstacleAlerts: () => void;
  setEmergencyActive: (active: boolean, event?: EmergencyEvent) => void;
  resolveEmergency: () => void;
  setLookAroundActive: (active: boolean) => void;
  setOffline: (offline: boolean) => void;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
}

const STORAGE_KEY = '@blindaid:state';

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  onboardingComplete: false,
  deviceCapabilities: null,
  settings: DEFAULT_SETTINGS,
  vest: {
    connected: false,
    batteryPercent: 0,
  },
  isNavigating: false,
  currentRoute: null,
  activeObstacles: [],
  isEmergencyActive: false,
  activeEmergency: null,
  isLookAroundActive: false,
  isOffline: false,

  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
    get().persist();
  },

  setOnboardingComplete: (onboardingComplete) => {
    set({ onboardingComplete });
    get().persist();
  },

  setDeviceCapabilities: (deviceCapabilities) => {
    set({ deviceCapabilities });
  },

  updateSettings: (partial) => {
    set((state) => ({ settings: { ...state.settings, ...partial } }));
    get().persist();
  },

  setVestState: (vestPartial) => {
    set((state) => ({ vest: { ...state.vest, ...vestPartial } }));
  },

  setCurrentRoute: (currentRoute) => {
    set({ currentRoute, isNavigating: !!currentRoute });
  },

  setActiveObstacles: (activeObstacles) => {
    set({ activeObstacles });
  },

  addObstacleAlert: (alert) => {
    set((state) => ({
      activeObstacles: [
        ...state.activeObstacles.filter((o) => o.zone !== alert.zone),
        alert,
      ],
    }));
  },

  clearObstacleAlerts: () => {
    set({ activeObstacles: [] });
  },

  setEmergencyActive: (isEmergencyActive, event) => {
    set({
      isEmergencyActive,
      activeEmergency: event ?? null,
    });
  },

  resolveEmergency: () => {
    set({ isEmergencyActive: false, activeEmergency: null });
  },

  setLookAroundActive: (isLookAroundActive) => {
    set({ isLookAroundActive });
  },

  setOffline: (isOffline) => {
    set({ isOffline });
  },

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<AppState>;
      set({
        user: saved.user ?? null,
        isAuthenticated: !!saved.user,
        onboardingComplete: saved.onboardingComplete ?? false,
        settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) },
      });
    } catch {
      // Corrupt storage — start fresh
    }
  },

  persist: async () => {
    const { user, onboardingComplete, settings } = get();
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user, onboardingComplete, settings }),
      );
    } catch {
      // Storage full or unavailable — non-fatal
    }
  },
}));
