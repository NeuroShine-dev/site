import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, AccessibilityInfo } from 'react-native';
import { COLORS } from '../constants';

interface VoiceInputOverlayProps {
  listening: boolean;
  prompt?: string;
}

export function VoiceInputOverlay({ listening, prompt }: VoiceInputOverlayProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const animation = useRef<Animated.CompositeAnimation>();

  useEffect(() => {
    if (listening) {
      animation.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      animation.current.start();
    } else {
      animation.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => animation.current?.stop();
  }, [listening, pulseAnim]);

  if (!listening) return null;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityLabel={prompt ?? 'Listening for your voice command'}
      accessibilityLiveRegion="polite"
    >
      <Animated.View style={[styles.orb, { transform: [{ scale: pulseAnim }] }]} />
      {prompt ? (
        <Text style={styles.prompt}>{prompt}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 48,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 12,
  },
  orb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.PRIMARY,
    opacity: 0.85,
  },
  prompt: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 260,
  },
});
