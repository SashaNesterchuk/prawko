import { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutRectangle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import {
  CText,
  getFontFamily,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

import {
  holesAreClose,
  holeRelativeToOverlay,
  paddedHole,
  spotlightCutoutPath,
} from "./spotlight-cutout";

const HOLE_PADDING = 8;
const STABLE_MEASURES = 2;
const MAX_MEASURE_FRAMES = 90;

export type HomeStartSpotlightProps = {
  visible: boolean;
  anchorRef: { current: View | null };
  title: string;
  body: string;
  skipLabel: string;
  onSkip: () => void;
  onStart: () => void;
  layoutNonce?: number;
};

export function HomeStartSpotlight({
  visible,
  anchorRef,
  title,
  body,
  skipLabel,
  onSkip,
  onStart,
  layoutNonce = 0,
}: HomeStartSpotlightProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { top: safeTop } = useSafeAreaInsets();
  const theme = useTheme();
  const styles = useStyles();
  const overlayRef = useRef<View>(null);
  const [hole, setHole] = useState<LayoutRectangle | null>(null);
  const [overlaySize, setOverlaySize] = useState({
    width: windowWidth,
    height: windowHeight,
  });

  const measureHole = useCallback((onResult: (next: LayoutRectangle | null) => void) => {
    const overlay = overlayRef.current;
    const anchor = anchorRef.current;
    if (overlay == null || anchor == null) {
      onResult(null);
      return;
    }

    overlay.measureInWindow((overlayX, overlayY, overlayWidth) => {
      anchor.measureInWindow((x, y, width, height) => {
        if (overlayWidth <= 0 || width <= 0 || height <= 0) {
          onResult(null);
          return;
        }

        onResult(
          paddedHole(
            holeRelativeToOverlay(
              { x: overlayX, y: overlayY },
              { x, y, width, height }
            ),
            HOLE_PADDING
          )
        );
      });
    });
  }, [anchorRef]);

  useEffect(() => {
    if (!visible) {
      setHole(null);
      return;
    }

    let cancelled = false;
    let raf = 0;
    let frame = 0;
    let consecutive = 0;
    let last: LayoutRectangle | null = null;

    const tick = () => {
      measureHole((next) => {
        if (cancelled) {
          return;
        }

        frame += 1;

        if (next != null) {
          if (holesAreClose(last, next)) {
            consecutive += 1;
          } else {
            consecutive = 1;
            last = next;
          }

          if (consecutive >= STABLE_MEASURES || frame >= MAX_MEASURE_FRAMES) {
            setHole(next);
            return;
          }
        }

        if (frame < MAX_MEASURE_FRAMES) {
          raf = requestAnimationFrame(tick);
        } else if (last != null) {
          setHole(last);
        }
      });
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [layoutNonce, measureHole, safeTop, visible, windowHeight, windowWidth]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onSkip();
      return true;
    });
    return () => sub.remove();
  }, [onSkip, visible]);

  if (!visible) {
    return null;
  }

  const overlayWidth = overlaySize.width;
  const overlayHeight = overlaySize.height;
  const cutout =
    hole == null
      ? null
      : spotlightCutoutPath({
          windowWidth: overlayWidth,
          windowHeight: overlayHeight,
          hole,
          radius: 20,
        });

  return (
      <View
        pointerEvents="auto"
        ref={overlayRef}
      style={styles.root}
      testID="home-start-spotlight"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setOverlaySize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height }
        );
      }}
    >
      {cutout ? (
        <Svg
          height={overlayHeight}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width={overlayWidth}
        >
          <Path
            d={cutout}
            fill={theme.colors.overlayBackdrop}
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </Svg>
      ) : (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim]} />
      )}
      <Pressable
        accessible={false}
        importantForAccessibility="no"
        onPress={onSkip}
        style={StyleSheet.absoluteFill}
        testID="home-start-spotlight-dismiss"
      />
      {hole ? (
        <Pressable
          accessibilityRole="button"
          onPress={onStart}
          style={[
            styles.hole,
            {
              top: hole.y,
              left: hole.x,
              width: hole.width,
              height: hole.height,
            },
          ]}
          testID="home-start-spotlight-target"
        />
      ) : null}
      {hole ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.tooltipAnchor,
            { top: hole.y + hole.height + 10, left: Math.max(24, hole.x) },
          ]}
        >
          <View style={styles.caret} />
          <View style={styles.tooltip}>
            <CText style={styles.title} semiBold>
              {title}
            </CText>
            <CText style={styles.body}>{body}</CText>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onSkip}
              testID="home-start-spotlight-skip"
            >
              <CText style={styles.skip}>{skipLabel}</CText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    root: {
      ...StyleSheet.absoluteFill,
      zIndex: 1000,
      elevation: 1000,
    },
    dim: {
      backgroundColor: colors.overlayBackdrop,
    },
    hole: {
      position: "absolute",
      borderRadius: radius.xxl,
    },
    tooltipAnchor: {
      position: "absolute",
      right: 24,
      alignItems: "flex-start",
    },
    caret: {
      width: 14,
      height: 14,
      marginLeft: 22,
      marginBottom: -7,
      transform: [{ rotate: "45deg" }],
      borderTopLeftRadius: 2,
      backgroundColor: colors.ink,
    },
    tooltip: {
      maxWidth: 320,
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.ink,
    },
    title: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(22),
      color: colors.onAccent,
    },
    body: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      fontFamily: getFontFamily("regular"),
      color: colors.onAccentMuted,
    },
    skip: {
      marginTop: spacing.xs,
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      fontFamily: getFontFamily("medium"),
      color: colors.onAccentSoft,
    },
  }));
}
