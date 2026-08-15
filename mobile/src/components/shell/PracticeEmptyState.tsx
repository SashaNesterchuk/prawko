import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { Icon, type IconName } from "../icons";
import { buildQuestionRouteParams } from "../../features/questions/question-routes";
import { useQuestionModeCountDialog } from "../../features/questions/useQuestionModeCountDialog";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { ActionTile } from "./ActionTile";
import { GreenWaveScreen } from "./GreenWaveScreen";
import { NavigationButton } from "./NavigationButton";

type PracticeEmptyStateProps = {
  description: string;
  dueReviews?: number;
  headerTitle: string;
  iconName?: IconName;
  onBack?: () => void;
  testID?: string;
  title: string;
};

export function PracticeEmptyState({
  description,
  dueReviews = 0,
  headerTitle,
  iconName = "like",
  onBack,
  testID = "screen-practice-empty",
  title,
}: PracticeEmptyStateProps) {
  const { t } = useTranslation();
  const { bottom: safeBottom } = useSafeAreaInsets();
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom });
  const iconSize = responsiveFont(24);
  const heroIconSize = responsiveFont(40);

  const { openMode, dialog: countDialog } = useQuestionModeCountDialog();
  const trapsTitle = t("learn.tileTrapsTitle", {
    defaultValue: "Питання-пастки",
  });

  const openQuestionMode = (
    mode: Parameters<typeof buildQuestionRouteParams>[0]["mode"]
  ) =>
    router.replace({
      pathname: "/question",
      params: buildQuestionRouteParams({ mode }),
    });

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]} testID={testID}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <NavigationButton
            inset
            type="back"
            accessibilityLabel={t("common.back")}
            onPress={onBack ?? (() => router.back())}
          />
          <CText style={styles.headerTitle}>{headerTitle}</CText>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroIconWrap}>
            <Icon
              color={accents.green.fill}
              name={iconName}
              size={heroIconSize}
            />
          </View>

          <CText style={styles.title}>{title}</CText>
          <CText style={styles.description}>{description}</CText>

          <View style={styles.actions}>
            <ActionTile
              accent="amber"
              style="faded"
              premium
              testID="practice-empty-tile-traps"
              title={trapsTitle}
              subtitle={t("learn.tileTrapsSubtitle", {
                defaultValue: "Найчастіше плутають",
              })}
              icon={
                <Icon
                  color={accents.amber.fill}
                  name="warning"
                  size={iconSize}
                />
              }
              onPress={() =>
                openMode({
                  mode: "high_points",
                  title: trapsTitle,
                })
              }
            />
            <ActionTile
              accent="amber"
              style="faded"
              premium
              testID="practice-empty-tile-srs"
              title={t("learn.tileSrsTitle", {
                defaultValue: "Розумні повторення",
              })}
              subtitle={t("learn.tileSrsSubtitle", {
                defaultValue: "Питання на сьогодні: {{count}}",
                count: dueReviews,
              })}
              icon={
                <Icon color={accents.amber.fill} name="idea" size={iconSize} />
              }
              onPress={() => openQuestionMode("review_due")}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
      {countDialog}
    </GreenWaveScreen>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      gap: spacing.exact(16),
      paddingHorizontal: spacing.exact(24),
      paddingTop: spacing.exact(0),
      paddingBottom: spacing.exact(8),
    },
    headerTitle: {
      flex: 1,
      fontSize: responsiveFont(20),
      lineHeight: responsiveFont(28),
      fontFamily: getFontFamily("semiBold"),
      letterSpacing: -0.2,
      color: colors.textPrimary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      alignItems: "center" as const,
      paddingHorizontal: spacing.exact(24),
      paddingTop: spacing.exact(24),
      paddingBottom: spacing.exact(24) + safeBottom,
    },
    heroIconWrap: {
      alignItems: "center" as const,
      justifyContent: "center" as const,
      padding: spacing.exact(32),
      borderRadius: radius.pill,
      backgroundColor: colors.white,
    },
    title: {
      marginTop: spacing.exact(32),
      fontSize: responsiveFont(32),
      lineHeight: responsiveFont(32),
      fontFamily: getFontFamily("bold"),
      letterSpacing: -0.64,
      color: colors.textPrimary,
      textAlign: "center" as const,
    },
    description: {
      marginTop: spacing.exact(16),
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      color: colors.textSecondary,
      textAlign: "center" as const,
    },
    actions: {
      width: "100%" as const,
      marginTop: spacing.exact(32),
      gap: spacing.exact(8),
    },
  }));
}
