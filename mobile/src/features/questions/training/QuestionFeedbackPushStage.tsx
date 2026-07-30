import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useEffect, useState } from "react";
import { StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";

const ENTER_MS = 480;
const ENTER_EASING = Easing.inOut(Easing.ease);
const EXIT_MS = 200;
const EXIT_EASING = Easing.out(Easing.cubic);

/** Breathing room left between the question and the panel edge. */
const CONTENT_GAP = 12;

/** How far the question has to travel before the top fade is at full strength. */
const FADE_RAMP = 24;

type QuestionFeedbackPushStageProps = {
  children: ReactNode;
  /**
   * Bottom padding the content needs while the panel is down (home indicator,
   * screen padding). It is excluded from the lift, so once the panel is up the
   * question still lands on it with just `CONTENT_GAP` to spare.
   */
  contentBottomInset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  feedback: ReactNode;
  visible: boolean;
};

/**
 * Slides the feedback panel up and lifts the question by exactly the amount
 * the panel would otherwise overlap it. Both moves read the same `progress`,
 * so they always travel together, and the scroller never unmounts, so the
 * media and options are never re-created mid-transition.
 */
export function QuestionFeedbackPushStage({
  children,
  contentBottomInset = 0,
  contentContainerStyle,
  feedback,
  visible,
}: QuestionFeedbackPushStageProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const progress = useSharedValue(0);
  const stageHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const panelHeight = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);
  const [measuredPanel, setMeasuredPanel] = useState(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }

    progress.value = withTiming(
      0,
      { duration: EXIT_MS, easing: EXIT_EASING },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      }
    );
  }, [progress, visible]);

  useEffect(() => {
    if (!visible || measuredPanel <= 0) {
      return;
    }

    // Only matters when the question is long enough to scroll: brings its
    // bottom edge into view so the lift lands it right on top of the panel.
    scrollRef.current?.scrollToEnd({ animated: true });
    progress.value = withTiming(1, {
      duration: ENTER_MS,
      easing: ENTER_EASING,
    });
  }, [measuredPanel, progress, visible]);

  const lift = useDerivedValue(() => {
    const freeSpace = Math.max(0, stageHeight.value - contentHeight.value);

    return Math.max(0, panelHeight.value - freeSpace - contentBottomInset);
  });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * progress.value }],
  }));

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -panelHeight.value * progress.value }],
  }));

  // Nothing is clipped when the question fits without moving, so the fade
  // would just be a stray gradient over the top of the media.
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, lift.value / FADE_RAMP) * progress.value,
  }));

  return (
    <View
      style={styles.stage}
      onLayout={(event) => {
        stageHeight.value = event.nativeEvent.layout.height;
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        bounces={false}
        contentContainerStyle={[
          contentContainerStyle,
          { paddingBottom: contentBottomInset + CONTENT_GAP },
        ]}
        scrollEnabled={!visible}
        showsVerticalScrollIndicator={false}
        style={[styles.scroll, contentStyle]}
        onContentSizeChange={(_width, height) => {
          contentHeight.value = height;
        }}
      >
        {children}
      </Animated.ScrollView>

      {mounted ? (
        <Animated.View
          pointerEvents={visible ? "box-none" : "none"}
          style={[styles.panelHost, panelStyle]}
          onLayout={(event) => {
            const nextHeight = Math.round(event.nativeEvent.layout.height);
            if (nextHeight <= 0 || nextHeight === measuredPanel) {
              return;
            }

            panelHeight.value = nextHeight;
            setMeasuredPanel(nextHeight);
          }}
        >
          {feedback}
        </Animated.View>
      ) : null}

      <Animated.View pointerEvents="none" style={[styles.topFade, fadeStyle]}>
        <LinearGradient
          colors={[colors.paper, `${colors.paper}00`]}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ spacing }) => ({
    stage: {
      flex: 1,
      overflow: "hidden",
    },
    scroll: {
      flex: 1,
    },
    /** Parked just below the stage, so it is clipped away until it slides up. */
    panelHost: {
      position: "absolute",
      top: "100%",
      left: 0,
      right: 0,
    },
    topFade: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: spacing.exact(40),
      zIndex: 4,
    },
  }));
}
