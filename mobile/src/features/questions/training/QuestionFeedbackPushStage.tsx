import { LinearGradient } from "expo-linear-gradient";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, type StyleProp, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useResponsiveStyles } from "../../../portable-ui";
import { useTheme } from "../../../providers/ThemeProvider";

const ENTER_MS = 320;
const ENTER_EASING = Easing.inOut(Easing.ease);
const EXIT_MS = 200;
const EXIT_EASING = Easing.out(Easing.cubic);

/** Breathing room between the question and whatever follows it. */
const CONTENT_GAP = 12;

/** How far the content has to scroll before the top fade is at full strength. */
const FADE_RAMP = 24;

/**
 * Minimum panel peek above the pinned actions. Used until the explanation has
 * been measured, so the verdict is readable even on the first frame.
 */
const PANEL_HEADER_REVEAL = 64;

/**
 * Backstop for the case where the panel does not change the content size, so
 * `onContentSizeChange` never fires — happens on surfaces that keep the panel
 * up while swapping the question underneath it.
 */
const SCROLL_FALLBACK_MS = 64;

type QuestionFeedbackPushStageProps = {
  children: ReactNode;
  /**
   * Bottom padding the content needs while no panel is shown (home indicator,
   * screen padding). Once the panel is in the flow it reaches the bottom edge
   * on its own and this is no longer applied.
   */
  contentBottomInset?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  feedback: ReactNode;
  /** Pinned over the panel, above the fade, instead of scrolling with it. */
  feedbackActions?: ReactNode;
  /**
   * Changing this re-runs the scroll positioning. Needed on surfaces that keep
   * the panel up while swapping the question underneath it, where `visible`
   * alone never flips.
   */
  resetKey?: string | number;
  visible: boolean;
};

/**
 * Appends the feedback panel to the question content, so question, options and
 * explanation scroll as one block, and pins the actions over a bottom fade. The
 * scroller never unmounts, so the media and options are never re-created
 * mid-transition.
 */
export function QuestionFeedbackPushStage({
  children,
  contentBottomInset = 0,
  contentContainerStyle,
  feedback,
  feedbackActions,
  resetKey,
  visible,
}: QuestionFeedbackPushStageProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const progress = useSharedValue(0);
  const stageHeight = useSharedValue(0);
  const panelTop = useSharedValue(0);
  const panelContentHeight = useSharedValue(0);
  const actionsHeight = useSharedValue(0);
  const [actionsHeightPx, setActionsHeightPx] = useState(0);
  const [mounted, setMounted] = useState(visible);
  const [measured, setMeasured] = useState(false);
  const contentHeightRef = useRef(0);
  const pendingRevealRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  // Runs once the panel is laid out inside the content, otherwise the target
  // offset would be computed against the pre-panel content size.
  const flushPendingReveal = useCallback(() => {
    if (!pendingRevealRef.current || stageHeight.value === 0) {
      return;
    }

    pendingRevealRef.current = false;
    clearFallbackTimer();

    const maxScroll = Math.max(0, contentHeightRef.current - stageHeight.value);
    // Show as much of the explanation as fits above the pinned actions,
    // lifting the question only as far as the text needs. Never scroll the
    // panel header off-screen — longer copy stays reachable by hand.
    const reveal = Math.max(PANEL_HEADER_REVEAL, panelContentHeight.value);
    const target = Math.min(
      maxScroll,
      Math.max(0, panelTop.value),
      Math.max(
        0,
        panelTop.value +
          actionsHeight.value +
          reveal -
          stageHeight.value
      )
    );

    scrollRef.current?.scrollTo({ y: target, animated: true });
  }, [
    actionsHeight,
    clearFallbackTimer,
    panelContentHeight,
    panelTop,
    scrollRef,
    stageHeight,
  ]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      return;
    }

    pendingRevealRef.current = false;
    panelContentHeight.value = 0;
    clearFallbackTimer();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    progress.value = withTiming(
      0,
      { duration: EXIT_MS, easing: EXIT_EASING },
      (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
          runOnJS(setMeasured)(false);
        }
      }
    );
  }, [clearFallbackTimer, progress, scrollRef, visible]);

  // Armed only once the panel is measured, because that is the render in which
  // its offset inside the content is known.
  useEffect(() => {
    if (!visible || !measured) {
      return;
    }

    progress.value = withTiming(1, {
      duration: ENTER_MS,
      easing: ENTER_EASING,
    });

    pendingRevealRef.current = true;
    clearFallbackTimer();
    fallbackTimerRef.current = setTimeout(
      flushPendingReveal,
      SCROLL_FALLBACK_MS
    );

    return clearFallbackTimer;
    // `resetKey` re-runs the positioning for surfaces that swap the question
    // while the panel stays up, where `visible` never flips.
  }, [
    clearFallbackTimer,
    flushPendingReveal,
    measured,
    progress,
    resetKey,
    visible,
  ]);

  useEffect(() => clearFallbackTimer, [clearFallbackTimer]);

  // Slides in from wherever the panel currently pokes into the viewport, so it
  // reads as rising from the bottom edge no matter how far the list is scrolled.
  const panelStyle = useAnimatedStyle(() => {
    const exposed = Math.min(
      stageHeight.value,
      Math.max(0, stageHeight.value - (panelTop.value - scrollOffset.value))
    );

    return {
      opacity: progress.value,
      transform: [{ translateY: exposed * (1 - progress.value) }],
    };
  });

  const actionsStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: actionsHeight.value * (1 - progress.value) },
    ],
  }));

  const topFadeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, scrollOffset.value) / FADE_RAMP),
  }));

  return (
    <View
      style={styles.stage}
      onLayout={(event) => {
        stageHeight.value = event.nativeEvent.layout.height;
        flushPendingReveal();
      }}
    >
      <Animated.ScrollView
        ref={scrollRef}
        bounces={false}
        contentContainerStyle={[
          contentContainerStyle,
          styles.content,
          { paddingBottom: visible ? 0 : contentBottomInset + CONTENT_GAP },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        onContentSizeChange={(_width, height) => {
          contentHeightRef.current = height;
          flushPendingReveal();
        }}
      >
        {children}

        {mounted ? (
          <Animated.View
            style={[styles.panelSlot, panelStyle]}
            onLayout={(event) => {
              panelTop.value = event.nativeEvent.layout.y;
              setMeasured(true);
              flushPendingReveal();
            }}
          >
            <View
              onLayout={(event) => {
                const nextHeight = event.nativeEvent.layout.height;
                if (nextHeight === panelContentHeight.value) {
                  return;
                }

                panelContentHeight.value = nextHeight;
                pendingRevealRef.current = true;
                flushPendingReveal();
              }}
            >
              {feedback}
            </View>
            {/* Continues the panel gradient's white end down to the screen
                edge, both behind the pinned actions and on questions whose
                content is shorter than the viewport. */}
            <View style={[styles.panelFiller, { minHeight: actionsHeightPx }]} />
          </Animated.View>
        ) : null}
      </Animated.ScrollView>

      <Animated.View pointerEvents="none" style={[styles.topFade, topFadeStyle]}>
        <LinearGradient
          colors={[colors.paper, `${colors.paper}00`]}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {mounted && feedbackActions ? (
        <Animated.View
          pointerEvents={visible ? "box-none" : "none"}
          style={[styles.actionsBar, actionsStyle]}
          onLayout={(event) => {
            const nextHeight = Math.round(event.nativeEvent.layout.height);
            if (nextHeight <= 0 || nextHeight === actionsHeight.value) {
              return;
            }

            actionsHeight.value = nextHeight;
            setActionsHeightPx(nextHeight);
            flushPendingReveal();
          }}
        >
          <LinearGradient
            colors={[`${colors.white}00`, colors.white]}
            end={{ x: 0.5, y: 1 }}
            pointerEvents="none"
            start={{ x: 0.5, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="box-none"
            style={[
              styles.actionsContent,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
            {feedbackActions}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, spacing }) => ({
    stage: {
      flex: 1,
      overflow: "hidden",
    },
    scroll: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
    },
    panelSlot: {
      flexGrow: 1,
      marginTop: spacing.exact(CONTENT_GAP),
    },
    panelFiller: {
      flexGrow: 1,
      backgroundColor: colors.white,
    },
    topFade: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: spacing.exact(40),
      zIndex: 4,
    },
    actionsBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 5,
    },
    actionsContent: {
      paddingHorizontal: spacing.exact(24),
      paddingTop: spacing.exact(24),
    },
  }));
}
