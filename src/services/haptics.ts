import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { ObstacleZone, ObstacleUrgency } from '../types';

class HapticsService {
  private enabled = true;

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  private async trigger(
    style: Haptics.ImpactFeedbackStyle | 'notification' | 'selection',
  ): Promise<void> {
    if (!this.enabled) return;
    try {
      if (style === 'notification') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else if (style === 'selection') {
        await Haptics.selectionAsync();
      } else {
        await Haptics.impactAsync(style);
      }
    } catch {
      // Haptics unavailable on simulator or device
    }
  }

  async obstacleAlert(zone: ObstacleZone, urgency: ObstacleUrgency): Promise<void> {
    if (!this.enabled) return;

    switch (urgency) {
      case 'critical':
        // Rapid burst — stop immediately
        await this.trigger(Haptics.ImpactFeedbackStyle.Heavy);
        await delay(80);
        await this.trigger(Haptics.ImpactFeedbackStyle.Heavy);
        await delay(80);
        await this.trigger(Haptics.ImpactFeedbackStyle.Heavy);
        break;

      case 'close':
        await this.trigger(Haptics.ImpactFeedbackStyle.Heavy);
        await delay(150);
        await this.trigger(Haptics.ImpactFeedbackStyle.Heavy);
        break;

      case 'mid':
        await this.trigger(Haptics.ImpactFeedbackStyle.Medium);
        await delay(200);
        await this.trigger(Haptics.ImpactFeedbackStyle.Medium);
        break;

      case 'far':
        await this.trigger(Haptics.ImpactFeedbackStyle.Light);
        break;
    }

    // Zone-specific second pulse to indicate direction
    // On devices without vest, we use vibration timing to convey left/center/right
    if (Platform.OS === 'ios') {
      await delay(300);
      if (zone.includes('left')) {
        await this.trigger(Haptics.ImpactFeedbackStyle.Light);
      } else if (zone.includes('right')) {
        await delay(100);
        await this.trigger(Haptics.ImpactFeedbackStyle.Light);
        await delay(100);
        await this.trigger(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }

  async confirmAction(): Promise<void> {
    await this.trigger(Haptics.ImpactFeedbackStyle.Light);
  }

  async confirmSuccess(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async confirmError(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }

  async navigationTurn(): Promise<void> {
    await this.trigger(Haptics.ImpactFeedbackStyle.Medium);
  }

  async emergencyAlert(): Promise<void> {
    if (!this.enabled) return;
    for (let i = 0; i < 5; i++) {
      await this.trigger(Haptics.ImpactFeedbackStyle.Heavy);
      await delay(200);
    }
  }

  async tapFeedback(): Promise<void> {
    await this.trigger(Haptics.ImpactFeedbackStyle.Light);
  }

  async arrival(): Promise<void> {
    if (!this.enabled) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await delay(300);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const haptics = new HapticsService();
