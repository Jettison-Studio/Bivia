import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, View } from 'react-native';
import { T, c, font } from './ui';

/** Presentation only: the existing attempt clock owns when the question starts. */
export function CountdownTakeover({ seconds }: { seconds: number }) {
  const count = Math.max(1, Math.min(3, seconds));
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    scale.setValue(reduceMotion ? 1 : 0.8);
    if (reduceMotion) return;
    const animation = Animated.spring(scale, { toValue: 1, damping: 15, stiffness: 180, mass: 0.7, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [count, reduceMotion, scale]);
  return <View testID="countdown-takeover" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary }}>
    <View pointerEvents="none" style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1, borderColor: '#ffffff20' }} />
    <Animated.View style={{ transform: [{ scale }] }}>
      <T accessibilityLiveRegion="polite" accessibilityLabel={`Starting in ${count}`} style={{ fontFamily: font.bold, fontSize: 156, lineHeight: 190, letterSpacing: -6, color: 'white', textAlign: 'center' }}>{count}</T>
    </Animated.View>
  </View>;
}
