import { Linking } from 'react-native';
import * as Location from 'expo-location';
import { supabase, logEmergencyEvent, broadcastLocation } from './supabase';
import { tts } from './tts';
import { haptics } from './haptics';
import { EmergencyContact, EmergencyEvent, EmergencyTrigger, LatLng } from '../types';
import { TIMING } from '../constants';
import { generateId } from '../utils/id';

class EmergencyService {
  private countdownTimer: ReturnType<typeof setTimeout> | null = null;
  private locationInterval: ReturnType<typeof setInterval> | null = null;
  private onStateChange: ((active: boolean, event?: EmergencyEvent) => void) | null = null;
  private onCountdownTick: ((secondsRemaining: number) => void) | null = null;
  private isActive = false;

  setCallbacks(
    onStateChange: (active: boolean, event?: EmergencyEvent) => void,
    onCountdownTick: (secondsRemaining: number) => void,
  ) {
    this.onStateChange = onStateChange;
    this.onCountdownTick = onCountdownTick;
  }

  async trigger(
    trigger: EmergencyTrigger,
    contacts: EmergencyContact[],
    userId: string,
    userName: string,
  ): Promise<void> {
    if (this.isActive) return;
    this.isActive = true;

    await haptics.emergencyAlert();

    const primaryContact = contacts[0];
    const contactName = primaryContact?.name ?? 'your emergency contact';

    tts.speakImmediate(
      `Emergency mode activated. Alerting ${contactName}. Sending your location now.`,
    );

    const location = await this.getCurrentLocation();

    const event: EmergencyEvent = {
      id: generateId(),
      triggeredAt: new Date().toISOString(),
      trigger,
      location: location ?? undefined,
    };

    // Log to Supabase
    await logEmergencyEvent(event);

    // Broadcast live location
    if (location) {
      await broadcastLocation(userId, location);
      this.startLocationBroadcast(userId);
    }

    // Send SMS to all contacts via Supabase Edge Function
    // (Twilio credentials are server-side only)
    await this.sendEmergencySMS(contacts, userName, location);

    this.onStateChange?.(true, event);

    // Start countdown to auto-call primary contact
    this.startCallCountdown(primaryContact, TIMING.EMERGENCY_CALL_COUNTDOWN_S);
  }

  private startCallCountdown(contact: EmergencyContact | undefined, seconds: number): void {
    let remaining = seconds;

    const tick = () => {
      this.onCountdownTick?.(remaining);
      if (remaining <= 0) {
        this.callContact(contact);
        return;
      }
      if (remaining === 5) {
        tts.speakImmediate(
          `Calling ${contact?.name ?? 'emergency contact'} in 5 seconds. Say "cancel" if you are okay.`,
        );
      }
      remaining -= 1;
      this.countdownTimer = setTimeout(tick, 1000);
    };

    this.countdownTimer = setTimeout(tick, 1000);
  }

  cancel(): void {
    if (!this.isActive) return;

    this.clearTimers();
    this.isActive = false;
    this.onStateChange?.(false);
    tts.speakImmediate("Okay, emergency cancelled. I'm glad you're safe.");
  }

  private callContact(contact: EmergencyContact | undefined): void {
    if (!contact) {
      tts.speakImmediate('No emergency contact configured. Please call 911 if you need help.');
      return;
    }
    const number = contact.phone.replace(/\D/g, '');
    Linking.openURL(`tel:${number}`);
  }

  call911(): void {
    Linking.openURL('tel:911');
  }

  async resolve(userId?: string): Promise<void> {
    this.clearTimers();
    this.isActive = false;
    this.onStateChange?.(false);
    tts.speakImmediate('Emergency resolved. Stay safe.');
  }

  private async getCurrentLocation(): Promise<LatLng | null> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return null;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      return null;
    }
  }

  private startLocationBroadcast(userId: string): void {
    this.locationInterval = setInterval(async () => {
      const location = await this.getCurrentLocation();
      if (location) {
        await broadcastLocation(userId, location);
      }
    }, 10_000);
  }

  private async sendEmergencySMS(
    contacts: EmergencyContact[],
    userName: string,
    location: LatLng | null,
  ): Promise<void> {
    try {
      const locationText = location
        ? `https://maps.google.com/?q=${location.latitude},${location.longitude}`
        : 'Location unavailable';

      await supabase.functions.invoke('send-emergency-sms', {
        body: { contacts, userName, locationText },
      });
    } catch {
      // Non-fatal — voice call is still triggered
    }
  }

  private clearTimers(): void {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.locationInterval) {
      clearInterval(this.locationInterval);
      this.locationInterval = null;
    }
  }

  isEmergencyActive(): boolean {
    return this.isActive;
  }
}

export const emergencyService = new EmergencyService();
