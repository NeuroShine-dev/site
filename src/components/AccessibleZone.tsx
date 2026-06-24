import React, { useCallback, useRef } from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  AccessibilityRole,
  GestureResponderEvent,
} from 'react-native';
import { haptics } from '../services/haptics';
import { tts } from '../services/tts';
import { COLORS } from '../constants';

interface AccessibleZoneProps {
  label: string;
  description: string;
  onActivate: () => void;
  style?: object;
  children?: React.ReactNode;
  accessibilityHint?: string;
  disabled?: boolean;
}

/**
 * Full-screen-zone button for the audio-first home screen.
 * Single tap: announces zone label + description via TTS + haptic.
 * Double tap: activates the zone.
 * Fully VoiceOver/TalkBack compatible.
 */
export function AccessibleZone({
  label,
  description,
  onActivate,
  style,
  children,
  accessibilityHint,
  disabled = false,
}: AccessibleZoneProps) {
  const lastTap = useRef<number>(0);
  const DOUBLE_TAP_WINDOW = 400;

  const handlePress = useCallback(
    (_event: GestureResponderEvent) => {
      if (disabled) return;

      const now = Date.now();
      const timeSinceLast = now - lastTap.current;

      if (timeSinceLast < DOUBLE_TAP_WINDOW && lastTap.current > 0) {
        // Double tap — activate
        lastTap.current = 0;
        haptics.confirmAction();
        onActivate();
      } else {
        // Single tap — announce
        lastTap.current = now;
        haptics.tapFeedback();
        tts.speakNormal(`${label}. ${description}`);
      }
    },
    [disabled, label, description, onActivate],
  );

  return (
    <TouchableOpacity
      style={[styles.zone, style, disabled && styles.disabled]}
      onPress={handlePress}
      accessible={true}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint ?? `Double tap to ${label.toLowerCase()}`}
      accessibilityRole={'button' as AccessibilityRole}
      accessibilityState={{ disabled }}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={styles.label} allowFontScaling={false}>
          {label}
        </Text>
        {children}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  zone: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  content: {
    alignItems: 'center',
    padding: 16,
  },
  label: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.4,
  },
});
