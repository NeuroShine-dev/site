import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { tts } from '../../src/services/tts';
import { haptics } from '../../src/services/haptics';
import { vestService } from '../../src/services/vest';
import { useVoiceCommands } from '../../src/hooks/useVoiceCommands';
import { COLORS } from '../../src/constants';
import { SpeechSpeed, SpeechGender, SupportedLanguage, ObstacleSensitivity, DEFAULT_SETTINGS } from '../../src/types';

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, updateSettings, vest, setVestState, user } = useAppStore();
  const [vestScanning, setVestScanning] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  const announce = useCallback(
    (text: string) => {
      haptics.tapFeedback();
      tts.speakNormal(text);
    },
    [],
  );

  const handleSpeedChange = useCallback(
    (speed: SpeechSpeed) => {
      updateSettings({ speechSpeed: speed });
      tts.configure(speed, settings.speechGender, settings.language);
      const msgs: Record<SpeechSpeed, string> = {
        slow: 'Speaking speed set to slow.',
        normal: 'Speaking speed set to normal.',
        fast: 'Speaking speed set to fast.',
      };
      tts.speakImmediate(msgs[speed]);
    },
    [settings.speechGender, settings.language, updateSettings],
  );

  const handleSensitivityChange = useCallback(
    (s: ObstacleSensitivity) => {
      updateSettings({ obstacleSensitivity: s });
      const msgs: Record<ObstacleSensitivity, string> = {
        low: 'Obstacle alerts set to low sensitivity. Alerts at 3 feet and closer.',
        medium: 'Obstacle alerts set to medium. Alerts at 5 feet and closer.',
        high: 'Obstacle alerts set to high. Alerts at 8 feet and closer.',
      };
      announce(msgs[s]);
    },
    [announce, updateSettings],
  );

  const connectVest = useCallback(async () => {
    setVestScanning(true);
    announce('Scanning for BlindAid Vest. Please make sure it is powered on.');
    try {
      const devices = await vestService.scan();
      if (devices.length === 0) {
        tts.speakNormal('No vest found nearby. Make sure the vest is powered on and in range.');
        setVestScanning(false);
        return;
      }
      const device = devices[0];
      await vestService.connect(device.id);
      const state = vestService.getState();
      setVestState(state);
      tts.speakNormal(
        `Vest connected. Battery at ${state.batteryPercent} percent. Haptic feedback enhanced. You now have full 360-degree awareness.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not connect to vest.';
      tts.speakNormal(msg);
    } finally {
      setVestScanning(false);
    }
  }, [announce, setVestState]);

  const disconnectVest = useCallback(async () => {
    await vestService.disconnect();
    setVestState({ connected: false, batteryPercent: 0 });
    announce('Vest disconnected. Falling back to phone-only obstacle detection.');
  }, [announce, setVestState]);

  const resetSettings = useCallback(() => {
    updateSettings(DEFAULT_SETTINGS);
    tts.configure(DEFAULT_SETTINGS.speechSpeed, DEFAULT_SETTINGS.speechGender, DEFAULT_SETTINGS.language);
    announce('All settings reset to defaults.');
  }, [announce, updateSettings]);

  const handleCommand = useCallback(
    (command: string) => {
      if (command === 'CONNECT_VEST') connectVest();
      if (command === 'RESTART_TUTORIAL') {
        router.replace('/(auth)/onboarding');
      }
    },
    [connectVest, router],
  );

  useVoiceCommands({ onCommand: handleCommand, active: true });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle} accessible accessibilityRole="header">
          Settings
        </Text>

        {/* Speech Speed */}
        <SettingSection title="Speaking Speed">
          <OptionRow
            options={[
              { value: 'slow', label: 'Slow' },
              { value: 'normal', label: 'Normal' },
              { value: 'fast', label: 'Fast' },
            ]}
            selected={settings.speechSpeed}
            onSelect={(v) => handleSpeedChange(v as SpeechSpeed)}
          />
        </SettingSection>

        {/* Voice Gender */}
        <SettingSection title="Voice">
          <OptionRow
            options={[
              { value: 'female', label: 'Female' },
              { value: 'male', label: 'Male' },
            ]}
            selected={settings.speechGender}
            onSelect={(v) => updateSettings({ speechGender: v as SpeechGender })}
          />
        </SettingSection>

        {/* Obstacle Sensitivity */}
        <SettingSection title="Obstacle Detection">
          <OptionRow
            options={[
              { value: 'low', label: 'Low (3 ft)' },
              { value: 'medium', label: 'Medium (5 ft)' },
              { value: 'high', label: 'High (8 ft)' },
            ]}
            selected={settings.obstacleSensitivity}
            onSelect={(v) => handleSensitivityChange(v as ObstacleSensitivity)}
          />
        </SettingSection>

        {/* Toggles */}
        <SettingSection title="Preferences">
          <SettingToggle
            label="Haptic Feedback"
            value={settings.hapticEnabled}
            onToggle={(v) => {
              updateSettings({ hapticEnabled: v });
              haptics.setEnabled(v);
              announce(v ? 'Haptic feedback on.' : 'Haptic feedback off.');
            }}
          />
          <SettingToggle
            label="Battery Saver Mode"
            value={settings.batterySaverMode}
            onToggle={(v) => {
              updateSettings({ batterySaverMode: v });
              announce(v ? 'Battery saver on. Scan frequency reduced.' : 'Battery saver off.');
            }}
          />
          <SettingToggle
            label="Notifications"
            value={settings.notificationsEnabled}
            onToggle={(v) => updateSettings({ notificationsEnabled: v })}
          />
        </SettingSection>

        {/* BlindAid Vest */}
        <SettingSection title="BlindAid Vest">
          {vest.connected ? (
            <View style={styles.vestStatus}>
              <Text style={styles.vestStatusText} accessible>
                Vest connected — Battery {vest.batteryPercent}%
              </Text>
              <TouchableOpacity
                style={styles.dangerButton}
                onPress={disconnectVest}
                accessible
                accessibilityLabel="Disconnect vest"
                accessibilityRole="button"
              >
                <Text style={styles.dangerButtonText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={connectVest}
              disabled={vestScanning}
              accessible
              accessibilityLabel={vestScanning ? 'Scanning for vest' : 'Connect BlindAid Vest'}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>
                {vestScanning ? 'Scanning...' : 'Connect Vest'}
              </Text>
            </TouchableOpacity>
          )}
        </SettingSection>

        {/* Emergency Contacts */}
        <SettingSection title="Emergency Contacts">
          {user?.emergencyContacts?.map((contact) => (
            <View key={contact.id} style={styles.contactRow}>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName} accessible accessibilityLabel={`Contact: ${contact.name}`}>
                  {contact.name}
                </Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
              </View>
            </View>
          ))}
          {addingContact && (
            <View style={styles.addContactForm}>
              <TextInput
                style={styles.input}
                value={newContactName}
                onChangeText={setNewContactName}
                placeholder="Name"
                placeholderTextColor={COLORS.TEXT_SECONDARY}
                accessible
                accessibilityLabel="New contact name"
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={newContactPhone}
                onChangeText={setNewContactPhone}
                placeholder="Phone number"
                placeholderTextColor={COLORS.TEXT_SECONDARY}
                keyboardType="phone-pad"
                accessible
                accessibilityLabel="New contact phone number"
              />
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setAddingContact(false);
                  setNewContactName('');
                  setNewContactPhone('');
                }}
                accessible
                accessibilityLabel="Save contact"
                accessibilityRole="button"
              >
                <Text style={styles.primaryButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
          {!addingContact && (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setAddingContact(true)}
              accessible
              accessibilityLabel="Add emergency contact"
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>+ Add Contact</Text>
            </TouchableOpacity>
          )}
        </SettingSection>

        {/* Reset */}
        <SettingSection title="Reset">
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={resetSettings}
            accessible
            accessibilityLabel="Reset all settings to defaults"
            accessibilityRole="button"
          >
            <Text style={styles.dangerButtonText}>Reset All Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, { marginTop: 10 }]}
            onPress={() => router.replace('/(auth)/onboarding')}
            accessible
            accessibilityLabel="Restart tutorial"
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Restart Tutorial</Text>
          </TouchableOpacity>
        </SettingSection>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessible
          accessibilityLabel="Go back to home"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>← Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessible accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

function OptionRow<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ value: T; label: string }>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.option, selected === opt.value && styles.optionSelected]}
          onPress={() => onSelect(opt.value)}
          accessible
          accessibilityLabel={opt.label}
          accessibilityRole="radio"
          accessibilityState={{ selected: selected === opt.value, checked: selected === opt.value }}
        >
          <Text style={[styles.optionText, selected === opt.value && styles.optionTextSelected]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function SettingToggle({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View
      style={styles.toggleRow}
      accessible
      accessibilityLabel={`${label}: ${value ? 'on' : 'off'}`}
    >
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#333', true: COLORS.PRIMARY }}
        thumbColor="#fff"
        accessible
        accessibilityLabel={label}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  scroll: {
    padding: 24,
    gap: 8,
  },
  pageTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 36,
    fontWeight: '900',
    marginBottom: 16,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  optionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  option: {
    flex: 1,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: `${COLORS.PRIMARY}20`,
  },
  optionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: COLORS.TEXT_PRIMARY,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
  },
  primaryButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
  },
  dangerButton: {
    backgroundColor: 'rgba(231,76,60,0.2)',
    borderWidth: 1,
    borderColor: COLORS.EMERGENCY,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: COLORS.EMERGENCY,
    fontSize: 16,
    fontWeight: '700',
  },
  vestStatus: {
    gap: 12,
  },
  vestStatusText: {
    color: COLORS.SUCCESS,
    fontSize: 17,
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  contactInfo: {
    gap: 2,
  },
  contactName: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 17,
    fontWeight: '600',
  },
  contactPhone: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 15,
  },
  addContactForm: {
    gap: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    padding: 14,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
  },
  backButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  backButtonText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
  },
});
