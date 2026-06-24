import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { UserProfile, EmergencyContact, EmergencyEvent, SafeZone, LatLng } from '../types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signInWithPhone(phone: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) throw error;
}

export async function verifyOtp(phone: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data as UserProfile;
}

export async function upsertProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profile)
    .select()
    .single();
  if (error) throw error;
  return data as UserProfile;
}

export async function updateEmergencyContacts(
  userId: string,
  contacts: EmergencyContact[],
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ emergency_contacts: contacts })
    .eq('id', userId);
  if (error) throw error;
}

// ─── Emergency Events ─────────────────────────────────────────────────────────

export async function logEmergencyEvent(event: EmergencyEvent): Promise<void> {
  const { error } = await supabase.from('emergency_events').insert(event);
  if (error) throw error;
}

export async function resolveEmergencyEvent(
  eventId: string,
  resolvedBy: 'user' | 'guardian',
): Promise<void> {
  const { error } = await supabase
    .from('emergency_events')
    .update({ resolved_at: new Date().toISOString(), resolved_by: resolvedBy })
    .eq('id', eventId);
  if (error) throw error;
}

// ─── Location Broadcast ───────────────────────────────────────────────────────

export async function broadcastLocation(userId: string, location: LatLng): Promise<void> {
  await supabase.from('location_broadcasts').upsert({
    user_id: userId,
    latitude: location.latitude,
    longitude: location.longitude,
    updated_at: new Date().toISOString(),
  });
}

export function subscribeToLocation(
  userId: string,
  onUpdate: (location: LatLng) => void,
) {
  return supabase
    .channel(`location:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'location_broadcasts', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { latitude: number; longitude: number };
        onUpdate({ latitude: row.latitude, longitude: row.longitude });
      },
    )
    .subscribe();
}

// ─── Guardian ─────────────────────────────────────────────────────────────────

export async function linkGuardian(userId: string, guardianPhone: string): Promise<void> {
  const { error } = await supabase.from('guardian_links').insert({
    blind_user_id: userId,
    guardian_phone: guardianPhone,
    status: 'pending',
  });
  if (error) throw error;
}

export async function getLinkedUsers(guardianId: string) {
  const { data, error } = await supabase
    .from('guardian_links')
    .select('*, profiles(*)')
    .eq('guardian_id', guardianId)
    .eq('status', 'active');
  if (error) throw error;
  return data;
}

export async function upsertSafeZone(userId: string, zone: SafeZone): Promise<void> {
  const { error } = await supabase.from('safe_zones').upsert({ ...zone, user_id: userId });
  if (error) throw error;
}

export async function deleteSafeZone(zoneId: string): Promise<void> {
  const { error } = await supabase.from('safe_zones').delete().eq('id', zoneId);
  if (error) throw error;
}

// ─── Guardian Message Push ────────────────────────────────────────────────────

export async function pushGuardianMessage(userId: string, message: string): Promise<void> {
  const { error } = await supabase.from('guardian_messages').insert({
    user_id: userId,
    message,
    sent_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export function subscribeToGuardianMessages(
  userId: string,
  onMessage: (message: string) => void,
) {
  return supabase
    .channel(`guardian_messages:${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'guardian_messages', filter: `user_id=eq.${userId}` },
      (payload) => {
        const row = payload.new as { message: string };
        onMessage(row.message);
      },
    )
    .subscribe();
}
