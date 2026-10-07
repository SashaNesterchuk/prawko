import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Svg, {
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

import NoLeftTurnSign from "../../../assets/pl-road-signs-wikimedia/PL_road_sign_B-21.svg";
import PrioritySign from "../../../assets/pl-road-signs-wikimedia/PL_road_sign_D-1.svg";
import { CText, useResponsiveStyles } from "../../portable-ui";
import { paywall2Palette as palette } from "./palette";

type RoadSceneProps = {
  height: number;
  sign?: "priority" | "noLeftTurn";
};

export function Paywall2RoadScene({ height, sign = "priority" }: RoadSceneProps) {
  const styles = useStyles();
  const signSize = Math.round(height * 0.34);
  const SignIcon = sign === "priority" ? PrioritySign : NoLeftTurnSign;

  return (
    <View style={[styles.scene, { height }]}>
      <Svg height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 200 110" width="100%">
        <Defs>
          <SvgLinearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0" stopColor="#7DB7EA" />
            <Stop offset="1" stopColor="#D9ECFA" />
          </SvgLinearGradient>
        </Defs>
        <Rect fill="url(#sky)" height="110" width="200" />
        <Ellipse cx="22" cy="44" fill="#3E7D3A" rx="26" ry="22" />
        <Ellipse cx="52" cy="50" fill="#4C8F45" rx="20" ry="16" />
        <Ellipse cx="168" cy="42" fill="#3E7D3A" rx="30" ry="24" />
        <Ellipse cx="140" cy="52" fill="#4C8F45" rx="16" ry="12" />
        <Rect fill="#7FA65A" height="50" width="200" y="60" />
        <Path d="M88 60 L112 60 L190 110 L10 110 Z" fill="#62676C" />
        <Path d="M99 64 L101 64 L102 72 L98 72 Z" fill="#FFFFFF" opacity={0.9} />
        <Path d="M97.5 78 L102.5 78 L104 92 L96 92 Z" fill="#FFFFFF" opacity={0.9} />
        <Path d="M95 100 L105 100 L106 110 L94 110 Z" fill="#FFFFFF" opacity={0.9} />
        <Rect fill="#1E2328" height="11" rx="2" width="22" x="104" y="64" />
        <Rect fill="#9FB4C4" height="4" rx="1" width="16" x="107" y="65" />
        <Rect fill="#D94444" height="2" width="4" x="105" y="71" />
        <Rect fill="#D94444" height="2" width="4" x="121" y="71" />
      </Svg>
      <View style={[styles.sceneSign, { right: height * 0.12, top: height * 0.16 }]}>
        <SignIcon height={signSize} width={signSize} />
        <View style={[styles.signPole, { height: height * 0.3 }]} />
      </View>
    </View>
  );
}

export function Paywall2PhoneMock({ width }: { width: number }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const height = width * 2.05;
  const bezel = width * 0.045;

  return (
    <View
      style={[
        styles.phone,
        { width, height, borderRadius: width * 0.18, padding: bezel },
      ]}
    >
      <View style={[styles.phoneScreen, { borderRadius: width * 0.15 }]}>
        <View style={styles.notch} />
        <View style={styles.mockTopBar}>
          <CText style={styles.mockCounter}>12/32</CText>
          <View style={styles.mockProgressTrack}>
            <View style={styles.mockProgressFill} />
          </View>
        </View>
        <Paywall2RoadScene height={width * 0.62} />
        <View style={styles.mockBody}>
          <CText numberOfLines={3} semiBold style={styles.mockQuestion}>
            {t("paywall2.mockQuestion")}
          </CText>
          <MockAnswer label="A" selected text={t("paywall2.mockAnswerYes")} />
          <MockAnswer label="B" text={t("paywall2.mockAnswerNo")} />
          <MockAnswer label="C" text={t("paywall2.mockAnswerRight")} />
          <View style={styles.mockActions}>
            <View style={styles.mockBack}>
              <MaterialCommunityIcons color={palette.greenDeep} name="arrow-left" size={10} />
            </View>
            <View style={styles.mockNext}>
              <CText semiBold style={styles.mockNextLabel}>{t("paywall2.mockNext")}</CText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function MockAnswer({ label, selected = false, text }: { label: string; selected?: boolean; text: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.mockAnswer, selected ? styles.mockAnswerSelected : null]}>
      <View style={[styles.mockAnswerBullet, selected ? styles.mockAnswerBulletSelected : null]}>
        <CText semiBold style={[styles.mockAnswerBulletText, selected ? styles.mockAnswerBulletTextSelected : null]}>
          {label}
        </CText>
      </View>
      <CText numberOfLines={1} style={styles.mockAnswerText}>{text}</CText>
    </View>
  );
}

export function Paywall2ExamPreview() {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.preview}>
      <View style={styles.previewHeader}>
        <CText style={styles.previewCounter}>1/32</CText>
        <View style={styles.mockProgressTrack}>
          <View style={[styles.mockProgressFill, { width: "45%" }]} />
        </View>
      </View>
      <Paywall2RoadScene height={72} />
      <View style={styles.previewFooter}>
        <MockAnswer label="A" text={t("paywall2.mockAnswerYes")} />
      </View>
    </View>
  );
}

export function Paywall2MistakesPreview() {
  const { t } = useTranslation();
  const styles = useStyles();
  const rows = [
    { key: "priority", label: t("paywall2.topicPriority"), count: 8, color: palette.red, icon: "alert" as const },
    { key: "signs", label: t("paywall2.topicSigns"), count: 6, color: palette.amber, icon: "sign-direction" as const },
    { key: "situations", label: t("paywall2.topicSituations"), count: 4, color: "#3B82F6", icon: "car" as const },
  ];

  return (
    <View style={styles.preview}>
      <CText semiBold style={styles.previewTitle}>{t("paywall2.mockMistakesTitle")}</CText>
      {rows.map((row) => (
        <View key={row.key} style={styles.mistakeRow}>
          <View style={[styles.mistakeIcon, { backgroundColor: row.color }]}>
            <MaterialCommunityIcons color="#FFFFFF" name={row.icon} size={10} />
          </View>
          <View style={styles.mistakeText}>
            <CText numberOfLines={1} semiBold style={styles.mistakeLabel}>{row.label}</CText>
            <CText numberOfLines={1} style={styles.mistakeCount}>
              {t("paywall2.mockMistakesCount", { count: row.count })}
            </CText>
          </View>
        </View>
      ))}
    </View>
  );
}

export function Paywall2TrapPreview() {
  const { t } = useTranslation();
  const styles = useStyles();
  return (
    <View style={styles.preview}>
      <View style={styles.trapBadge}>
        <MaterialCommunityIcons color={palette.red} name="alert-circle" size={10} />
        <CText semiBold style={styles.trapBadgeText}>{t("paywall2.mockTrapBadge")}</CText>
      </View>
      <Paywall2RoadScene height={64} sign="noLeftTurn" />
      <View style={styles.previewFooter}>
        <CText numberOfLines={1} semiBold style={styles.previewTitle}>{t("paywall2.mockTrapQuestion")}</CText>
        <MockAnswer label="A" text={t("paywall2.mockTrapAnswer")} />
      </View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ responsiveFont, spacing }) => ({
    scene: {
      width: "100%",
      overflow: "hidden",
      backgroundColor: "#D9ECFA",
    },
    sceneSign: {
      position: "absolute",
      alignItems: "center",
    },
    signPole: {
      width: 2,
      backgroundColor: "#8C9399",
    },
    phone: {
      backgroundColor: "#1B2420",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.18)",
      shadowColor: palette.green,
      shadowOpacity: 0.35,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 0 },
    },
    phoneScreen: {
      flex: 1,
      overflow: "hidden",
      backgroundColor: palette.mockPaper,
    },
    notch: {
      alignSelf: "center",
      width: "34%",
      height: spacing.exact(10),
      marginTop: spacing.exact(4),
      borderRadius: spacing.exact(6),
      backgroundColor: "#0B0F0D",
    },
    mockTopBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(6),
      paddingHorizontal: spacing.exact(8),
      paddingVertical: spacing.exact(6),
    },
    mockCounter: {
      fontSize: responsiveFont(8),
      lineHeight: responsiveFont(10),
      color: palette.mockInkMuted,
    },
    mockProgressTrack: {
      flex: 1,
      height: spacing.exact(4),
      borderRadius: spacing.exact(2),
      backgroundColor: palette.mockLine,
      overflow: "hidden",
    },
    mockProgressFill: {
      width: "38%",
      height: "100%",
      borderRadius: spacing.exact(2),
      backgroundColor: palette.ctaEnd,
    },
    mockBody: {
      flex: 1,
      gap: spacing.exact(4),
      padding: spacing.exact(8),
    },
    mockQuestion: {
      fontSize: responsiveFont(8),
      lineHeight: responsiveFont(10),
      color: palette.mockInk,
      marginBottom: spacing.exact(2),
    },
    mockAnswer: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(4),
      paddingHorizontal: spacing.exact(5),
      paddingVertical: spacing.exact(4),
      borderRadius: spacing.exact(6),
      borderWidth: 1,
      borderColor: palette.mockLine,
      backgroundColor: "#FFFFFF",
    },
    mockAnswerSelected: {
      borderColor: palette.ctaEnd,
      backgroundColor: "#E7FBEA",
    },
    mockAnswerBullet: {
      width: spacing.exact(12),
      height: spacing.exact(12),
      borderRadius: spacing.exact(6),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.mockLine,
    },
    mockAnswerBulletSelected: {
      backgroundColor: palette.greenDeep,
    },
    mockAnswerBulletText: {
      fontSize: responsiveFont(6),
      lineHeight: responsiveFont(8),
      color: palette.mockInk,
    },
    mockAnswerBulletTextSelected: {
      color: "#FFFFFF",
    },
    mockAnswerText: {
      flex: 1,
      fontSize: responsiveFont(7),
      lineHeight: responsiveFont(9),
      color: palette.mockInk,
    },
    mockActions: {
      flexDirection: "row",
      gap: spacing.exact(4),
      marginTop: "auto",
    },
    mockBack: {
      width: spacing.exact(24),
      height: spacing.exact(18),
      borderRadius: spacing.exact(5),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#E7FBEA",
    },
    mockNext: {
      flex: 1,
      height: spacing.exact(18),
      borderRadius: spacing.exact(5),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: palette.greenDeep,
    },
    mockNextLabel: {
      fontSize: responsiveFont(7),
      lineHeight: responsiveFont(9),
      color: "#FFFFFF",
    },
    preview: {
      overflow: "hidden",
      borderRadius: spacing.exact(10),
      backgroundColor: palette.mockPaper,
      paddingBottom: spacing.exact(6),
      gap: spacing.exact(4),
      height: spacing.exact(124),
    },
    previewHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(6),
      paddingHorizontal: spacing.exact(8),
      paddingTop: spacing.exact(6),
    },
    previewCounter: {
      fontSize: responsiveFont(8),
      lineHeight: responsiveFont(10),
      color: palette.mockInkMuted,
    },
    previewFooter: {
      gap: spacing.exact(4),
      paddingHorizontal: spacing.exact(6),
    },
    previewTitle: {
      fontSize: responsiveFont(9),
      lineHeight: responsiveFont(12),
      color: palette.mockInk,
      paddingHorizontal: spacing.exact(2),
      paddingTop: spacing.exact(4),
    },
    mistakeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(6),
      marginHorizontal: spacing.exact(6),
      padding: spacing.exact(5),
      borderRadius: spacing.exact(6),
      backgroundColor: "#FFFFFF",
    },
    mistakeIcon: {
      width: spacing.exact(16),
      height: spacing.exact(16),
      borderRadius: spacing.exact(8),
      alignItems: "center",
      justifyContent: "center",
    },
    mistakeText: {
      flex: 1,
    },
    mistakeLabel: {
      fontSize: responsiveFont(8),
      lineHeight: responsiveFont(10),
      color: palette.mockInk,
    },
    mistakeCount: {
      fontSize: responsiveFont(7),
      lineHeight: responsiveFont(9),
      color: palette.mockInkMuted,
    },
    trapBadge: {
      position: "absolute",
      zIndex: 1,
      top: spacing.exact(6),
      left: spacing.exact(6),
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(3),
      paddingHorizontal: spacing.exact(6),
      paddingVertical: spacing.exact(2),
      borderRadius: spacing.exact(8),
      backgroundColor: "#FFFFFF",
    },
    trapBadgeText: {
      fontSize: responsiveFont(7),
      lineHeight: responsiveFont(9),
      color: palette.red,
    },
  }));
}
