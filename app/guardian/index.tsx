import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, subscribeToLocation, pushGuardianMessage, upsertSafeZone } from '../../src/services/supabase';
import { COLORS } from '../../src/constants';
import { LatLng, SafeZone } from '../../src/types';
import { generateId } from '../../src/utils/id';

interface LinkedUser {
  id: string;
  name: string;
  location: LatLng | null;
  lastSeen: string;
  safeZones: SafeZone[];
  isInEmergency: boolean;
}

export default function GuardianDashboard() {
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const selectedUser = linkedUsers.find((u) => u.id === selectedUserId) ?? null;

  // Load linked users on mount
  useEffect(() => {
    loadLinkedUsers();
  }, []);

  // Subscribe to real-time location for each linked user
  useEffect(() => {
    const unsubs = linkedUsers.map((user) =>
      subscribeToLocation(user.id, (location) => {
        setLinkedUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, location, lastSeen: new Date().toISOString() } : u)),
        );
      }),
    );
    return () => {
      unsubs.forEach((ch) => ch.unsubscribe());
    };
  }, [linkedUsers.length]);

  // Subscribe to emergency events
  useEffect(() => {
    const channel = supabase
      .channel('emergency_events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'emergency_events' },
        (payload) => {
          const row = payload.new as { blind_user_id: string };
          setLinkedUsers((prev) =>
            prev.map((u) => (u.id === row.blind_user_id ? { ...u, isInEmergency: true } : u)),
          );
          Alert.alert(
            '⚠️ Emergency Alert',
            `${linkedUsers.find((u) => u.id === row.blind_user_id)?.name ?? 'A linked user'} has triggered emergency mode.`,
            [{ text: 'View', onPress: () => setSelectedUserId(row.blind_user_id) }],
          );
        },
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [linkedUsers]);

  const loadLinkedUsers = async () => {
    // In production, fetch actual linked users from Supabase
    // Mocked for initial build
    setLinkedUsers([]);
  };

  const sendMessage = useCallback(async () => {
    if (!selectedUserId || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      await pushGuardianMessage(selectedUserId, messageText.trim());
      setMessageText('');
      Alert.alert('Sent', 'Your message was delivered to the app.');
    } catch {
      Alert.alert('Error', 'Could not send message right now.');
    } finally {
      setSendingMessage(false);
    }
  }, [selectedUserId, messageText]);

  const addSafeZone = useCallback(
    async (userId: string, location: LatLng, name: string) => {
      const zone: SafeZone = {
        id: generateId(),
        name,
        center: location,
        radiusMeters: 100,
      };
      await upsertSafeZone(userId, zone);
      setLinkedUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, safeZones: [...u.safeZones, zone] } : u,
        ),
      );
    },
    [],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView>
        <Text style={styles.title}>Guardian Dashboard</Text>
        <Text style={styles.subtitle}>Monitoring {linkedUsers.length} user{linkedUsers.length !== 1 ? 's' : ''}</Text>

        {/* User selector */}
        {linkedUsers.length > 1 && (
          <ScrollView horizontal style={styles.userTabs} showsHorizontalScrollIndicator={false}>
            {linkedUsers.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.userTab, selectedUserId === u.id && styles.userTabSelected, u.isInEmergency && styles.userTabEmergency]}
                onPress={() => setSelectedUserId(u.id)}
                accessible
                accessibilityLabel={`View ${u.name}${u.isInEmergency ? ', in emergency' : ''}`}
                accessibilityRole="button"
              >
                <Text style={styles.userTabText}>{u.name}</Text>
                {u.isInEmergency && <Text style={styles.emergencyDot}>⚠️</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {selectedUser ? (
          <>
            {/* Live Map */}
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                region={
                  selectedUser.location
                    ? {
                        latitude: selectedUser.location.latitude,
                        longitude: selectedUser.location.longitude,
                        latitudeDelta: 0.005,
                        longitudeDelta: 0.005,
                      }
                    : undefined
                }
                accessible={false}
              >
                {selectedUser.location && (
                  <Marker
                    coordinate={selectedUser.location}
                    title={selectedUser.name}
                    pinColor={selectedUser.isInEmergency ? 'red' : 'blue'}
                  />
                )}
                {selectedUser.safeZones.map((zone) => (
                  <React.Fragment key={zone.id}>
                    <Circle
                      center={zone.center}
                      radius={zone.radiusMeters}
                      fillColor="rgba(74,144,217,0.1)"
                      strokeColor={COLORS.PRIMARY}
                    />
                    <Marker coordinate={zone.center} title={zone.name} pinColor="green" />
                  </React.Fragment>
                ))}
              </MapView>
            </View>

            {/* Status */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{selectedUser.name}</Text>
              <Text style={styles.infoRow}>
                Last seen: {formatLastSeen(selectedUser.lastSeen)}
              </Text>
              {selectedUser.location && (
                <Text style={styles.infoRow}>
                  {selectedUser.location.latitude.toFixed(5)}, {selectedUser.location.longitude.toFixed(5)}
                </Text>
              )}
              {selectedUser.isInEmergency && (
                <View style={styles.emergencyBanner}>
                  <Text style={styles.emergencyBannerText}>⚠️ EMERGENCY ACTIVE</Text>
                </View>
              )}
            </View>

            {/* Send Voice Message */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Send Voice Message</Text>
              <Text style={styles.cardNote}>
                This message will play aloud in {selectedUser.name}'s app immediately.
              </Text>
              <TextInput
                style={styles.messageInput}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type your message..."
                placeholderTextColor={COLORS.TEXT_SECONDARY}
                multiline
                accessible
                accessibilityLabel="Message to send"
              />
              <TouchableOpacity
                style={[styles.sendButton, sendingMessage && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={sendingMessage}
                accessible
                accessibilityLabel={sendingMessage ? 'Sending message' : 'Send message'}
                accessibilityRole="button"
              >
                <Text style={styles.sendButtonText}>
                  {sendingMessage ? 'Sending...' : 'Send to App'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Safe Zones */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Safe Zones</Text>
              {selectedUser.safeZones.length === 0 ? (
                <Text style={styles.cardNote}>No safe zones defined yet.</Text>
              ) : (
                selectedUser.safeZones.map((zone) => (
                  <View key={zone.id} style={styles.zoneRow}>
                    <Text style={styles.zoneName}>{zone.name}</Text>
                    <Text style={styles.zoneRadius}>{zone.radiusMeters}m radius</Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {linkedUsers.length === 0
                ? 'No linked users yet. The BlindAid user must link your account from their Settings.'
                : 'Select a user above to view their location and status.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatLastSeen(isoString: string): string {
  if (!isoString) return 'Unknown';
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)} hr ago`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1923',
  },
  title: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  userTabs: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  userTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userTabSelected: {
    backgroundColor: COLORS.PRIMARY,
  },
  userTabEmergency: {
    backgroundColor: 'rgba(231,76,60,0.3)',
    borderWidth: 1,
    borderColor: COLORS.EMERGENCY,
  },
  userTabText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
  },
  emergencyDot: {
    fontSize: 14,
  },
  mapContainer: {
    height: 280,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  cardTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  cardNote: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
  },
  emergencyBanner: {
    backgroundColor: 'rgba(231,76,60,0.2)',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  emergencyBannerText: {
    color: COLORS.EMERGENCY,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  messageInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 14,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  zoneName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
  },
  zoneRadius: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
  },
});
