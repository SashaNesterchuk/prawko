import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, AppState } from "react-native";

import { useAnalytics } from "../../hooks/useAnalytics";
import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import { useAppShellStore } from "../../state/app-shell";

/** One quiet hint before the first accepted answer, never during a session. */
export function FirstStepNudge({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const { track } = useAnalytics();
  const country = useAppShellStore((s) => s.examCountry);
  const category = useAppShellStore((s) => s.preferredCategory);
  const shown = useRef(new Set<string>());
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [reducedMotion, setReducedMotion] = useState(true);
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReducedMotion(value); });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  const animate = enabled && focused && foreground && !reducedMotion;
  useEffect(() => {
    if (!animate || !country) return;
    const scope = `${country}:${category}`;
    const timer = setTimeout(() => {
      if (shown.current.has(scope)) return;
      shown.current.add(scope);
      track(ANALYTICS_EVENTS.firstStepNudgeShown.key, {
        exam_country: country, category, roadmap_step_id: `${country}:0:0`, animation: "double_bounce",
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [animate, country, category, track]);
  useEffect(() => {
    offset.setValue(0);
    if (!animate) return;
    const bounce = Animated.sequence([
      Animated.delay(500),
      Animated.loop(Animated.sequence([
        Animated.timing(offset, { toValue: -5, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(offset, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(100),
        Animated.timing(offset, { toValue: -5, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(offset, { toValue: 0, duration: 220, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(2000),
      ])),
    ]);
    bounce.start();
    return () => { bounce.stop(); offset.setValue(0); };
  }, [animate, offset]);
  return <Animated.View testID={enabled ? "roadmap-first-step-nudge" : undefined} style={{ transform: [{ translateY: offset }] }}>{children}</Animated.View>;
}
