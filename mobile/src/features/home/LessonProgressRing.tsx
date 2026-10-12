import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

export function LessonProgressRing({ percent, wrongPercent, size, testID }: { percent: number; wrongPercent: number; size: number; testID: string }) {
  const radius = (size - 4) / 2;
  const length = 2 * Math.PI * radius;
  const correct = Math.max(0, Math.min(100, percent));
  const wrong = Math.max(0, Math.min(100 - correct, wrongPercent));
  const arc = (amount: number, start: number, color: string) => (
    <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={4}
      strokeLinecap="butt" strokeDasharray={`${length * amount / 100} ${length}`}
      rotation={-90 + 360 * start / 100} origin={`${size / 2}, ${size / 2}`} />
  );
  return (
    <View testID={testID} accessible accessibilityLabel={`Correct ${Math.round(correct)}%, mistakes ${Math.round(wrong)}%`}
      pointerEvents="none" style={{ position: "absolute", width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E9E5" strokeWidth={4} />
        {wrong > 0 ? arc(wrong, 0, "#F45B43") : null}
        {correct > 0 ? arc(correct, wrong, "#19AE76") : null}
      </Svg>
    </View>
  );
}
