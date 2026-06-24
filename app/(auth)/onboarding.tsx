import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  AccessibilityInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../src/store/appStore';
import { tts } from '../../src/services/tts';
import { haptics } from '../../src/services/haptics';
import { upsertProfile } from '../../src/services/supabase';
import { ONBOARDING_STEPS, COLORS } from '../../src/constants';
import {
  UserProfile,
  SpeechSpeed,
  SpeechGender,
  SupportedLanguage,
  EmergencyContact,
} from '../../src/types';
import { generateId } from '../../src/utils/id';

type OnboardingStepType = (typeof ONBOARDING_STEPS)[number];

const STEP_SCRIPTS: Record<OnboardingStepType, string> = {
  welcome:
    "Welcome to BlindAid. I'll guide you through setup. This will take about three minutes. Tap anywhere to continue.",
  name: "What's your name? Tap the text field and speak or type your name.",
  speech_speed:
    'How fast would you like me to speak? Tap Slow, Normal, or Fast. I will demonstrate each one.',
  voice_gender:
    'Would you prefer a male or female voice? Tap Male or Female.',
  language: 'Which language would you like to use? English, Spanish, or Hindi.',
  emergency_contact:
    'Now let me set up your emergency contact. This is required. If you ever activate emergency mode, I will call and text this person. Please enter their name and phone number.',
  guardian_link:
    'Would you like to link a Guardian account? A Guardian is a sighted caregiver who can see your location and receive emergency alerts. Say skip to continue without one, or enter the phone number of the person you want to link.',
  device_tier: '', // Filled dynamically from device detection
  gesture_tutorial:
    'Let me teach you the four gestures you need. Single tap anywhere to hear what it does. Double tap to activate it. Swipe left to go back. Long press for quick settings. Try a single tap now.',
  complete:
    "You're all set. BlindAid is ready. You're on the home screen. Tap anywhere to hear your options.",
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { deviceCapabilities, updateSettings, setUser, setOnboardingComplete } = useAppStore();

  const [step, setStep] = useState<OnboardingStepType>('welcome');
  const [userName, setUserName] = useState('');
  const [speechSpeed, setSpeechSpeed] = useState<SpeechSpeed>('normal');
  const [speechGender, setSpeechGender] = useState<SpeechGender>('female');
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  const announced = useRef<Set<string>>(new Set());

  const announceStep = useCallback(
    (stepId: OnboardingStepType) => {
      if (announced.current.has(stepId)) return;
      announced.current.add(stepId);

      let script =
        stepId === 'device_tier'
          ? deviceCapabilities?.announcement ?? STEP_SCRIPTS.device_tier
          : STEP_SCRIPTS[stepId];

      tts.speakNormal(script);
    },
    [deviceCapabilities],
  );

  useEffect(() => {
    announceStep(step);
  }, [step, announceStep]);

  const advance = useCallback(() => {
    const idx = ONBOARDING_STEPS.indexOf(step);
    if (idx < ONBOARDING_STEPS.length - 1) {
      setStep(ONBOARDING_STEPS[idx + 1]);
    }
  }, [step]);

  const goBack = useCallback(() => {
    const idx = ONBOARDING_STEPS.indexOf(step);
    if (idx > 0) {
      setStep(ONBOARDING_STEPS[idx - 1]);
    }
  }, [step]);

  const handleComplete = useCallback(async () => {
    const contact: EmergencyContact = {
      id: generateId(),
      name: emergencyName,
      phone: emergencyPhone,
      relationship: 'emergency contact',
      priority: 0,
    };

    const profile: UserProfile = {
      id: generateId(),
      name: userName || 'Friend',
      role: 'blind_user',
      language,
      speechSpeed,
      speechGender,
      deviceTier: deviceCapabilities?.tier ?? 1,
      onboardingComplete: true,
      emergencyContacts: [contact],
      createdAt: new Date().toISOString(),
    };

    try {
      await upsertProfile(profile);
    } catch {
      // Offline — save locally via store
    }

    updateSettings({ speechSpeed, speechGender, language });
    tts.configure(speechSpeed, speechGender, language);
    setUser(profile);
    setOnboardingComplete(true);

    await haptics.confirmSuccess();
    tts.speakImmediate("You're all set. BlindAid is ready.");
    router.replace('/(main)');
  }, [
    emergencyName,
    emergencyPhone,
    language,
    userName,
    speechSpeed,
    speechGender,
    deviceCapabilities,
    updateSettings,
    setUser,
    setOnboardingComplete,
    router,
  ]);

  const demonstrateSpeechSpeed = useCallback(
    (speed: SpeechSpeed) => {
      setSpeechSpeed(speed);
      tts.configure(speed, speechGender, language);
      const demos: Record<SpeechSpeed, string> = {
        slow: 'This is the slow speaking speed.',
        normal: 'This is the normal speaking speed.',
        fast: 'This is the fast speaking speed.',
      };
      tts.speakImmediate(demos[speed]);
    },
    [speechGender, language],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text
          style={styles.stepIndicator}
          accessible={true}
          accessibilityLabel={`Step ${ONBOARDING_STEPS.indexOf(step) + 1} of ${ONBOARDING_STEPS.length}`}
        >
          {ONBOARDING_STEPS.indexOf(step) + 1} / {ONBOARDING_STEPS.length}
        </Text>

        {step === 'welcome' && (
          <StepView title="Welcome to BlindAid" onNext={advance} nextLabel="Get Started" />
        )}

        {step === 'name' && (
          <StepView title="What's your name?" onNext={() => {
            if (userName.trim()) {
              tts.speakNormal(`Nice to meet you, ${userName}. Is that correct?`);
              advance();
            } else {
              tts.speakNormal('Please enter your name.');
            }
          }} onBack={goBack}>
            <TextInput
              style={styles.input}
              value={userName}
              onChangeText={setUserName}
              placeholder="Your name"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              accessible={true}
              accessibilityLabel="Enter your name"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={advance}
            />
          </StepView>
        )}

        {step === 'speech_speed' && (
          <StepView title="Speaking Speed" onNext={advance} onBack={goBack}>
            <OptionGroup
              options={[
                { value: 'slow', label: 'Slow' },
                { value: 'normal', label: 'Normal' },
                { value: 'fast', label: 'Fast' },
              ]}
              selected={speechSpeed}
              onSelect={(v) => demonstrateSpeechSpeed(v as SpeechSpeed)}
            />
          </StepView>
        )}

        {step === 'voice_gender' && (
          <StepView title="Voice Preference" onNext={advance} onBack={goBack}>
            <OptionGroup
              options={[
                { value: 'female', label: 'Female' },
                { value: 'male', label: 'Male' },
              ]}
              selected={speechGender}
              onSelect={(v) => setSpeechGender(v as SpeechGender)}
            />
          </StepView>
        )}

        {step === 'language' && (
          <StepView title="Language" onNext={advance} onBack={goBack}>
            <OptionGroup
              options={[
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
                { value: 'hi', label: 'हिन्दी' },
              ]}
              selected={language}
              onSelect={(v) => setLanguage(v as SupportedLanguage)}
            />
          </StepView>
        )}

        {step === 'emergency_contact' && (
          <StepView
            title="Emergency Contact"
            onNext={() => {
              if (!emergencyName.trim() || !emergencyPhone.trim()) {
                tts.speakNormal('Please enter both a name and phone number for your emergency contact.');
                return;
              }
              advance();
            }}
            onBack={goBack}
          >
            <TextInput
              style={styles.input}
              value={emergencyName}
              onChangeText={setEmergencyName}
              placeholder="Contact name"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              accessible={true}
              accessibilityLabel="Emergency contact name"
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={emergencyPhone}
              onChangeText={setEmergencyPhone}
              placeholder="Phone number"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              keyboardType="phone-pad"
              accessible={true}
              accessibilityLabel="Emergency contact phone number"
              returnKeyType="done"
              onSubmitEditing={advance}
            />
          </StepView>
        )}

        {step === 'guardian_link' && (
          <StepView
            title="Link a Guardian (Optional)"
            onNext={advance}
            onBack={goBack}
            nextLabel="Skip"
          >
            <TextInput
              style={styles.input}
              value={guardianPhone}
              onChangeText={setGuardianPhone}
              placeholder="Guardian's phone number"
              placeholderTextColor={COLORS.TEXT_SECONDARY}
              keyboardType="phone-pad"
              accessible={true}
              accessibilityLabel="Guardian phone number, optional"
              returnKeyType="done"
            />
          </StepView>
        )}

        {step === 'device_tier' && (
          <StepView
            title="Your Device"
            onNext={advance}
            onBack={goBack}
            description={deviceCapabilities?.announcement}
          />
        )}

        {step === 'gesture_tutorial' && (
          <StepView title="Gesture Tutorial" onNext={advance} onBack={goBack}>
            <GestureTutorial />
          </StepView>
        )}

        {step === 'complete' && (
          <StepView title="You're Ready!" onNext={handleComplete} nextLabel="Start BlindAid" />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StepView({
  title,
  description,
  children,
  onNext,
  onBack,
  nextLabel = 'Continue',
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
}) {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle} accessible accessibilityRole="header">
        {title}
      </Text>
      {description && <Text style={styles.stepDescription}>{description}</Text>}
      {children}
      <View style={styles.buttonRow}>
        {onBack && (
          <TouchableOpacity
            style={[styles.button, styles.backButton]}
            onPress={onBack}
            accessible
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.button, styles.nextButton, !onBack && styles.buttonFullWidth]}
          onPress={onNext}
          accessible
          accessibilityLabel={nextLabel}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function OptionGroup<T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ value: T; label: string }>;
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <View style={styles.optionGroup}>
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

function GestureTutorial() {
  const gestures = [
    { label: 'Single Tap', description: 'Hear what a zone does' },
    { label: 'Double Tap', description: 'Activate the zone' },
    { label: 'Swipe Left', description: 'Go back to previous screen' },
    { label: 'Long Press', description: 'Open quick settings' },
  ];

  return (
    <View style={styles.gesturelist} accessible accessibilityLabel="Gesture reference">
      {gestures.map((g) => (
        <View key={g.label} style={styles.gestureItem}>
          <Text style={styles.gestureName}>{g.label}</Text>
          <Text style={styles.gestureDesc}>{g.description}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
  },
  stepIndicator: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  stepContent: {
    flex: 1,
    gap: 20,
  },
  stepTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepDescription: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 16,
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
  },
  optionGroup: {
    gap: 12,
  },
  option: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: `${COLORS.PRIMARY}22`,
  },
  optionText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 20,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: COLORS.TEXT_PRIMARY,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  button: {
    flex: 1,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonFullWidth: {
    flex: 1,
  },
  nextButton: {
    backgroundColor: COLORS.PRIMARY,
  },
  backButton: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  buttonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  gesturelist: {
    gap: 16,
  },
  gestureItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  gestureName: {
    color: COLORS.PRIMARY,
    fontSize: 16,
    fontWeight: '700',
    width: 120,
  },
  gestureDesc: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 16,
    flex: 1,
  },
});
