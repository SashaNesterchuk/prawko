import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type ProgressRingProps = {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
};

function resolveColor(progress: number) {
  if (progress >= 85) {
    return greenWaveAccent.green.fill;
  }

  if (progress >= 40) {
    return greenWaveAccent.amber.fill;
  }

  return greenWaveAccent.red.fill;
}

export function ProgressRing({
  progress,
  size = 116,
  stroke = 8,
  color,
  trackColor = greenWave.color.track,
  children,
}: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(progress, 100));
  const fillColor = color ?? resolveColor(clamped);
  const half = size / 2;

  const firstAngle = (Math.min(clamped, 50) / 50) * 180;
  const secondAngle = ((Math.max(clamped, 50) - 50) / 50) * 180;

  const circle = {
    position: "absolute" as const,
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: stroke,
  };

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[circle, { borderColor: trackColor }]}
        pointerEvents="none"
      />

      <View
        style={[styles.clip, { width: half, height: size, left: half }]}
        pointerEvents="none"
      >
        <View
          style={[
            circle,
            {
              left: -half,
              borderColor: "transparent",
              borderTopColor: fillColor,
              borderRightColor: fillColor,
              transform: [{ rotate: `${-135 + firstAngle}deg` }],
            },
          ]}
        />
      </View>

      <View
        style={[styles.clip, { width: half, height: size, left: 0 }]}
        pointerEvents="none"
      >
        <View
          style={[
            circle,
            {
              left: 0,
              borderColor: "transparent",
              borderBottomColor: fillColor,
              borderLeftColor: fillColor,
              transform: [{ rotate: `${-135 + secondAngle}deg` }],
            },
          ]}
        />
      </View>

      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    position: "absolute",
    top: 0,
    overflow: "hidden",
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
