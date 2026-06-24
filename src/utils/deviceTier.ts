import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { DeviceCapabilities, DeviceTier } from '../types';

export async function detectDeviceTier(): Promise<DeviceCapabilities> {
  // Check for LiDAR (iPhone 12 Pro and later)
  const hasLiDAR = await checkLiDAR();

  // Check for ARCore (supported Android devices)
  const hasARCore = Platform.OS === 'android' && (await checkARCore());

  const tier: DeviceTier = hasLiDAR || hasARCore ? 2 : 1;

  return {
    tier,
    hasLiDAR,
    hasARCore,
    hasVest: false, // Updated when vest connects
    announcement: buildTierAnnouncement(tier, hasLiDAR, hasARCore),
  };
}

async function checkLiDAR(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  // iPhone 12 Pro and later have LiDAR. We detect by model year.
  // expo-device provides modelId which can be mapped to model year.
  const modelName = Device.modelName ?? '';
  const proModels = [
    'iPhone 12 Pro', 'iPhone 13 Pro', 'iPhone 14 Pro', 'iPhone 15 Pro',
    'iPhone 16 Pro', 'iPad Pro',
  ];
  return proModels.some((m) => modelName.includes(m));
}

async function checkARCore(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  // ARCore support detection would require a native module.
  // This is a placeholder — real detection uses Google's ARCore SDK availability check.
  return false;
}

function buildTierAnnouncement(tier: DeviceTier, hasLiDAR: boolean, hasARCore: boolean): string {
  if (hasLiDAR) {
    return "Your phone has a LiDAR sensor. You're on our highest accuracy tier. Obstacle detection will be very precise.";
  }
  if (hasARCore) {
    return "Your phone supports Google's depth sensing. You're on our enhanced accuracy tier. Obstacle detection is highly accurate.";
  }
  return "Your phone uses camera-based depth sensing. This works great for most situations. You can enhance it further with the BlindAid Vest.";
}
