import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useResponsiveStyles } from "../../portable-ui";

type ExamQuestionProgressBarProps = {
  /**
   * Continuous remaining fraction in [0, 1]. Used as the live source when
   * `timedDurationMs` is null (video media phase).
   */
  progressFraction: number;
  /**
   * When set with `animationKey`, run one linear deplete animation over this
   * duration (read/answer phases). Ignore live `progressFraction` ticks.
   */
  timedDurationMs?: number | null;
  /** Bumps when a new timed phase starts so the animation restarts once. */
  animationKey?: string | number;
};

export function ExamQuestionProgressBar({
  progressFraction,
  timedDurationMs = null,
  animationKey,
}: ExamQuestionProgressBarProps) {
  const styles = useStyles();
  const progress = useSharedValue(clamp01(progressFraction));
  const trackWidth = useSharedValue(0);
  const isTimed = timedDurationMs != null && timedDurationMs > 0;

  useEffect(() => {
    if (!isTimed || timedDurationMs == null) {
      return;
    }

    progress.value = 1;
    progress.value = withTiming(0, {
      duration: timedDurationMs,
      easing: Easing.linear,
    });
  }, [animationKey, isTimed, progress, timedDurationMs]);

  useEffect(() => {
    if (isTimed) {
      return;
    }

    progress.value = clamp01(progressFraction);
  }, [isTimed, progress, progressFraction]);

  const fillStyle = useAnimatedStyle(() => ({
    width: trackWidth.value * progress.value,
  }));

  return (
    <View
      style={styles.progressTrack}
      onLayout={(event) => {
        trackWidth.value = event.nativeEvent.layout.width;
      }}
    >
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function useStyles() {
  return useResponsiveStyles(({ accents, colors, radius, spacing }) => ({
    progressTrack: {
      height: spacing.exact(8),
      borderRadius: radius.pill,
      backgroundColor: colors.track,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: radius.pill,
      backgroundColor: accents.green.fill,
    },
  }));
}
