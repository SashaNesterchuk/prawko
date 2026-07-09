import { useMemo, type ReactNode } from "react";
import { View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

type ProgressRingProps = {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
};

export function ProgressRing({
  progress,
  size = 116,
  stroke = 8,
  color,
  trackColor,
  children,
}: ProgressRingProps) {
  const theme = useTheme();
  const styles = useStyles();
  const clamped = Math.max(0, Math.min(progress, 100));
  const fillColor =
    color ??
    (clamped >= 85
      ? theme.accents.green.fill
      : clamped >= 40
        ? theme.accents.amber.fill
        : theme.accents.red.fill);
  const resolvedTrackColor = trackColor ?? theme.colors.track;
  const half = size / 2;

  const firstAngle = (Math.min(clamped, 50) / 50) * 180;
  const secondAngle = ((Math.max(clamped, 50) - 50) / 50) * 180;

  const ringStyles = useMemo(
    () => ({
      root: {
        width: size,
        height: size,
      },
      trackCircle: {
        position: "absolute" as const,
        width: size,
        height: size,
        borderRadius: half,
        borderWidth: stroke,
        borderColor: resolvedTrackColor,
      },
      rightClip: {
        width: half,
        height: size,
        left: half,
      },
      leftClip: {
        width: half,
        height: size,
        left: 0,
      },
      rightArc: {
        position: "absolute" as const,
        width: size,
        height: size,
        borderRadius: half,
        borderWidth: stroke,
        left: -half,
        borderColor: theme.colors.transparent,
        borderTopColor: fillColor,
        borderRightColor: fillColor,
        transform: [{ rotate: `${-135 + firstAngle}deg` }],
      },
      leftArc: {
        position: "absolute" as const,
        width: size,
        height: size,
        borderRadius: half,
        borderWidth: stroke,
        left: 0,
        borderColor: theme.colors.transparent,
        borderBottomColor: fillColor,
        borderLeftColor: fillColor,
        transform: [{ rotate: `${-135 + secondAngle}deg` }],
      },
    }),
    [
      fillColor,
      firstAngle,
      half,
      resolvedTrackColor,
      secondAngle,
      size,
      stroke,
    ]
  );

  return (
    <View style={ringStyles.root}>
      <View style={ringStyles.trackCircle} pointerEvents="none" />

      <View style={[styles.clip, ringStyles.rightClip]} pointerEvents="none">
        <View style={ringStyles.rightArc} />
      </View>

      <View style={[styles.clip, ringStyles.leftClip]} pointerEvents="none">
        <View style={ringStyles.leftArc} />
      </View>

      <View style={styles.center}>{children}</View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(() => ({
    clip: {
      position: "absolute",
      top: 0,
      overflow: "hidden",
    },
    center: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: "center",
      justifyContent: "center",
    },
  }));
}
