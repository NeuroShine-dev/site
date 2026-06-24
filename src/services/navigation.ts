import * as Location from 'expo-location';
import { NavigationRoute, NavigationStep, LatLng } from '../types';
import { API, TIMING } from '../constants';

const MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

class NavigationService {
  private currentRoute: NavigationRoute | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private onStepChange: ((step: NavigationStep, stepIndex: number) => void) | null = null;
  private onArrival: ((destination: string) => void) | null = null;
  private onReroute: ((announcement: string) => void) | null = null;
  private announcedCallouts = new Set<string>();

  setCallbacks(
    onStepChange: (step: NavigationStep, stepIndex: number) => void,
    onArrival: (destination: string) => void,
    onReroute: (announcement: string) => void,
  ) {
    this.onStepChange = onStepChange;
    this.onArrival = onArrival;
    this.onReroute = onReroute;
  }

  async startNavigation(destination: string): Promise<NavigationRoute> {
    const origin = await this.getCurrentLocation();
    if (!origin) throw new Error('Location unavailable. Please enable location access.');

    const route = await this.fetchRoute(origin, destination);
    this.currentRoute = { ...route, currentStepIndex: 0 };

    this.startTracking();
    return this.currentRoute;
  }

  private async fetchRoute(origin: LatLng, destination: string): Promise<NavigationRoute> {
    const url = new URL(API.GOOGLE_DIRECTIONS_BASE);
    url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
    url.searchParams.set('destination', destination);
    url.searchParams.set('mode', 'walking');
    url.searchParams.set('key', MAPS_KEY);

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error('Could not get directions right now.');

    const data = (await resp.json()) as GoogleDirectionsResponse;
    if (data.status !== 'OK' || !data.routes.length) {
      throw new Error(`No route found to "${destination}".`);
    }

    const leg = data.routes[0].legs[0];
    const steps: NavigationStep[] = leg.steps.map((s) => ({
      instruction: stripHtml(s.html_instructions),
      distanceFeet: Math.round(s.distance.value * 3.28084),
      maneuver: s.maneuver ?? 'straight',
      coordinates: {
        latitude: s.end_location.lat,
        longitude: s.end_location.lng,
      },
    }));

    return {
      destination,
      distanceMiles: leg.distance.value / 1609.34,
      durationMinutes: Math.ceil(leg.duration.value / 60),
      steps,
      currentStepIndex: 0,
    };
  }

  private startTracking(): void {
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 2000,
        distanceInterval: 3,
      },
      (location) => this.handleLocationUpdate(location),
    ).then((sub) => {
      this.locationSubscription = sub;
    });
  }

  private handleLocationUpdate(location: Location.LocationObject): void {
    if (!this.currentRoute) return;

    const userPos: LatLng = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };

    const step = this.currentRoute.steps[this.currentRoute.currentStepIndex];
    if (!step) return;

    const distToStep = distanceBetween(userPos, step.coordinates);

    // Proactive callouts at 500, 200, 50 feet
    for (const calloutFeet of TIMING.NAVIGATION_CALLOUT_FEET) {
      const calloutKey = `${this.currentRoute.currentStepIndex}-${calloutFeet}`;
      if (step.distanceFeet > calloutFeet && distToStep * 3.28084 <= calloutFeet) {
        if (!this.announcedCallouts.has(calloutKey)) {
          this.announcedCallouts.add(calloutKey);
          this.onStepChange?.(step, this.currentRoute.currentStepIndex);
        }
      }
    }

    // Advance to next step when within 15 feet of waypoint
    if (distToStep * 3.28084 < 15) {
      const nextIdx = this.currentRoute.currentStepIndex + 1;
      if (nextIdx >= this.currentRoute.steps.length) {
        this.stopNavigation();
        this.onArrival?.(this.currentRoute.destination);
      } else {
        this.currentRoute.currentStepIndex = nextIdx;
        this.onStepChange?.(this.currentRoute.steps[nextIdx], nextIdx);
      }
    }

    // Off-route detection: if user is > 100 feet from expected path
    if (distToStep * 3.28084 > 100 && this.currentRoute.currentStepIndex > 0) {
      this.onReroute?.(
        "You've gone a bit off route. Hold on while I recalculate.",
      );
      this.reroute(userPos);
    }
  }

  private async reroute(userPos: LatLng): Promise<void> {
    if (!this.currentRoute) return;
    try {
      const newRoute = await this.fetchRoute(userPos, this.currentRoute.destination);
      this.currentRoute = { ...newRoute, currentStepIndex: 0 };
      this.announcedCallouts.clear();
      const firstStep = newRoute.steps[0];
      if (firstStep) this.onStepChange?.(firstStep, 0);
    } catch {
      // Reroute failed — stay on current route
    }
  }

  stopNavigation(): void {
    this.locationSubscription?.remove();
    this.locationSubscription = null;
    this.currentRoute = null;
    this.announcedCallouts.clear();
  }

  private async getCurrentLocation(): Promise<LatLng | null> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  }

  getCurrentRoute(): NavigationRoute | null {
    return this.currentRoute;
  }

  buildStepAnnouncement(step: NavigationStep, distanceFeet?: number): string {
    const dist = distanceFeet ?? step.distanceFeet;
    const distStr = dist < 50 ? 'in just a few steps' :
      dist < 200 ? `in about ${Math.round(dist / 10) * 10} feet` :
      `in about ${Math.round(dist / 100) * 100} feet`;

    const instruction = step.instruction;
    const landmark = step.landmark ? ` just past ${step.landmark}` : '';

    return `${distStr}, ${instruction}${landmark}.`;
  }
}

function distanceBetween(a: LatLng, b: LatLng): number {
  const R = 6371000; // meters
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sin_dLat = Math.sin(dLat / 2);
  const sin_dLng = Math.sin(dLng / 2);
  const a2 =
    sin_dLat * sin_dLat +
    Math.cos((a.latitude * Math.PI) / 180) *
      Math.cos((b.latitude * Math.PI) / 180) *
      sin_dLng * sin_dLng;
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// Google Directions API response shapes
interface GoogleDirectionsResponse {
  status: string;
  routes: Array<{
    legs: Array<{
      distance: { value: number; text: string };
      duration: { value: number; text: string };
      steps: Array<{
        html_instructions: string;
        distance: { value: number };
        duration: { value: number };
        maneuver?: string;
        end_location: { lat: number; lng: number };
      }>;
    }>;
  }>;
}

export const navigationService = new NavigationService();
