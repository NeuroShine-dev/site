import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ObstacleAlert } from '../types';
import { COLORS } from '../constants';

interface ObstacleAlertBannerProps {
  alerts: ObstacleAlert[];
}

export function ObstacleAlertBanner({ alerts }: ObstacleAlertBannerProps) {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const mostCritical = alerts.reduce<ObstacleAlert | null>((acc, a) => {
    if (!acc) return a;
    const order = { critical: 3, close: 2, mid: 1, far: 0 };
    return order[a.urgency] > order[acc.urgency] ? a : acc;
  }, null);

  useEffect(() => {
    if (mostCritical) {
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [mostCritical, opacityAnim]);

  if (!mostCritical) return null;

  const urgencyColor = {
    critical: '#E74C3C',
    close: '#E67E22',
    mid: '#F39C12',
    far: '#27AE60',
  }[mostCritical.urgency];

  const zoneLabel: Record<ObstacleAlert['zone'], string> = {
    left: 'LEFT',
    'front-left': 'AHEAD LEFT',
    center: 'AHEAD',
    'front-right': 'AHEAD RIGHT',
    right: 'RIGHT',
    'rear-left': 'BEHIND LEFT',
    'rear-right': 'BEHIND RIGHT',
  };

  return (
    <Animated.View
      style={[styles.banner, { borderColor: urgencyColor, opacity: opacityAnim }]}
      accessible={true}
      accessibilityLiveRegion="assertive"
      accessibilityLabel={`Obstacle ${zoneLabel[mostCritical.zone]}, ${Math.round(mostCritical.distanceFeet)} feet`}
    >
      <Text style={[styles.zone, { color: urgencyColor }]}>
        {zoneLabel[mostCritical.zone]}
      </Text>
      <Text style={styles.distance}>
        {Math.round(mostCritical.distanceFeet)} ft
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderBottomWidth: 3,
  },
  zone: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
  distance: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 20,
    fontWeight: '600',
  },
});
