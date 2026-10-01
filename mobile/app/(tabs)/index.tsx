import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../../src/components/icons";
import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { ExamReadinessCard } from "../../src/components/shell/ExamReadinessCard";
import { useReadinessCard } from "../../src/features/home/ReadinessIndexBlock";
import {
  getRoadmap,
  type RoadmapSection,
  type RoadmapStep,
} from "../../src/features/home/roadmap";
import {
  resolveRoadmapStepVisuals,
  roadmapStepId,
  useRoadmapProgressStore,
  type RoadmapStepVisual,
} from "../../src/features/home/roadmap-progress";
import { getExamProfileForCountry } from "../../src/features/exam/exam-profile";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { buildExamRouteParams } from "../../src/features/exam/exam-routes";
import { ANALYTICS_EVENTS } from "../../src/analytics/catalog";
import { openTrackedPaywall } from "../../src/features/monetization/v2/analytics";
import { openStoreReview } from "../../src/features/profile/store-review";
import { useAnalytics } from "../../src/providers/AnalyticsProvider";
import {
  useEntitlementStore,
  useHasPlusAccess,
} from "../../src/state/entitlements";
import { useReviewPromptStore } from "../../src/state/review-prompt";
import {
  CText,
  getTypographyStyle,
  useResponsiveFonts,
  useResponsiveStyles,
  withResponsiveFont,
} from "../../src/portable-ui";
import { useTheme } from "../../src/providers/ThemeProvider";
import { useAppShellStore } from "../../src/state/app-shell";

type StepState = RoadmapStepVisual;

const STEPS_PER_ROW = 3;

const PERK_KEYS = [
  { icon: "repeat" as const, labelKey: "roadmap.perkLifetime" },
  { icon: "chart" as const, labelKey: "roadmap.perkTopics" },
  { icon: "like" as const, labelKey: "roadmap.perkPrice" },
];

export default function RoadmapScreen() {
  const examCountry = useAppShellStore((state) => state.examCountry);
  const hasPlusAccess = useHasPlusAccess();
  const setDebugPlusOverride = useEntitlementStore(
    (state) => state.setDebugPlusOverride
  );
  const sections = getRoadmap(examCountry);
  const readiness = useReadinessCard();
  const completedStepIds = useRoadmapProgressStore(
    (state) => state.completedStepIds
  );
  const roadmapProgress = useMemo(
    () =>
      resolveRoadmapStepVisuals(
        examCountry,
        sections,
        completedStepIds,
        hasPlusAccess
      ),
    [completedStepIds, examCountry, hasPlusAccess, sections]
  );
  const { bottom: safeBottom } = useSafeAreaInsets();
  const styles = useStyles({ safeBottom });

  return (
    <GreenWaveScreen>
      <StatusBar style="dark" />
      <SafeAreaView edges={["top"]} style={styles.safeArea} testID="screen-home">
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <ExamReadinessCard
            coveredLabel={`${roadmapProgress.completedCount} / ${roadmapProgress.totalCount}`}
            detailsLabel={readiness.t("dash.readinessDetails", {
              defaultValue: "Пройти тест",
            })}
            empty={readiness.isReadinessEmpty}
            loading={readiness.isReadinessLoading}
            onPress={() => {
              if (readiness.isReadinessEmpty) {
                readiness.startFirstSession("card");
                return;
              }

              router.navigate("/statistics");
            }}
            progress={readiness.readinessPercent}
            testID="home-exam-readiness"
            title={readiness.t("dash.examReadinessTitle", {
              defaultValue: "Готовність до іспиту",
            })}
            weekChangeLabel={readiness.readinessWeekChangeLabel}
            weekChangePercent={readiness.readinessWeekChangePercent}
          />
          {sections.map((section, sectionIndex) => (
            <SectionCard
              key={section.id}
              section={section}
              sectionIndex={sectionIndex}
              visuals={roadmapProgress.visuals[sectionIndex] ?? []}
              premiumUnlocked={hasPlusAccess}
            />
          ))}

          <ExamSimulatorCard
            premiumUnlocked={hasPlusAccess}
            questionCount={getExamProfileForCountry(examCountry).totalQuestions}
            sections={sections}
            visuals={roadmapProgress.visuals}
          />

          {hasPlusAccess ? <RatingCard /> : <UnlockCard />}
          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setDebugPlusOverride(!hasPlusAccess)}
              style={[
                styles.debugPlusButton,
                hasPlusAccess
                  ? styles.debugPlusOn
                  : styles.debugPlusOff,
              ]}
              testID="home-debug-plus"
            >
              <CText style={styles.debugPlusLabel}>
                {hasPlusAccess ? "DEV Premium: ON" : "DEV Premium: OFF"}
              </CText>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}


function SectionCard({
  premiumUnlocked,
  section,
  sectionIndex,
  visuals,
}: {
  premiumUnlocked: boolean;
  section: RoadmapSection;
  sectionIndex: number;
  visuals: RoadmapStepVisual[];
}) {
  const { t } = useTranslation();
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom: 0 });
  const done = visuals.filter((visual) => visual === "completed").length;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.sectionIcon}>
          <Icon
            color={accents.green.ink}
            name={section.icon}
            size={responsiveFont(20)}
          />
        </View>
        <CText style={styles.sectionTitle}>
          {`${sectionIndex + 1}. ${t(section.titleKey)}`}
        </CText>
        <CText style={styles.progress}>
          {done}/{section.steps.length}
        </CText>
        <Icon
          color="#8FA099"
          name="chevron"
          size={responsiveFont(18)}
          style={styles.chevronUp}
        />
      </View>

      <StepRows
        examPrep={section.examPrep}
        premiumUnlocked={premiumUnlocked}
        sectionIndex={sectionIndex}
        steps={section.steps}
        topics={section.topics}
        visuals={visuals}
      />
    </View>
  );
}

function StepRows({
  examPrep,
  premiumUnlocked,
  sectionIndex,
  steps,
  topics,
  visuals,
}: {
  examPrep: boolean;
  premiumUnlocked: boolean;
  sectionIndex: number;
  steps: RoadmapStep[];
  topics: RoadmapSection["topics"];
  visuals: RoadmapStepVisual[];
}) {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const styles = useStyles({ safeBottom: 0 });
  const rows: RoadmapStep[][] = [];

  for (let index = 0; index < steps.length; index += STEPS_PER_ROW) {
    rows.push(steps.slice(index, index + STEPS_PER_ROW));
  }

  return (
    <View style={styles.snake}>
      {rows.map((row, rowIndex) => (
        <View key={row[0]?.labelKey} style={styles.stepRow}>
          {row.length > 1 ? (
            <View
              style={[
                styles.rowRail,
                {
                  left: `${50 / row.length}%`,
                  right: `${50 / row.length}%`,
                },
              ]}
            />
          ) : null}
          {row.map((step, columnIndex) => {
            const stepIndex = rowIndex * STEPS_PER_ROW + columnIndex;
            const state = visuals[stepIndex] ?? "upcoming";
            const premiumLocked = state === "premium" && !premiumUnlocked;
            const canStart =
              state === "active" ||
              state === "completed" ||
              state === "upcoming" ||
              (state === "premium" && premiumUnlocked);

            const label = t(step.labelKey);
            const bubble = (
              <>
                <StepBubble index={stepIndex + 1} state={state} />
                <CText
                  style={[
                    styles.stepLabel,
                    state === "active" || state === "completed"
                      ? styles.stepLabelActive
                      : null,
                  ]}
                >
                  {label}
                </CText>
              </>
            );

            if (!canStart && !premiumLocked) {
              return (
                <View key={step.labelKey} style={styles.stepCell}>
                  {bubble}
                </View>
              );
            }

            return (
              <Pressable
                accessibilityRole="button"
                key={step.labelKey}
                onPress={() => {
                  const stepId = roadmapStepId(
                    examCountry,
                    sectionIndex,
                    stepIndex
                  );
                  track(ANALYTICS_EVENTS.roadmapStepOpened.key, {
                    locked: premiumLocked,
                    premium: step.premium,
                    roadmap_step_id: stepId,
                    section_index: sectionIndex,
                    step_index: stepIndex,
                  });

                  if (!canStart || premiumLocked) {
                    openTrackedPaywall(track, {
                      roadmapStepId: stepId,
                      source: "roadmap",
                      surface: "home_step",
                    });
                    return;
                  }

                  if (step.startsExam) {
                    router.navigate({
                      pathname: "/exam",
                      params: buildExamRouteParams({ mode: "exam" }),
                    });
                    return;
                  }

                  router.navigate({
                    pathname: "/question",
                    params: buildQuestionRouteParams({
                      mode: "learning",
                      questionLimit: step.questionLimit,
                      roadmapStepId: stepId,
                      title: label,
                      topic:
                        !examPrep && topics.length === 1 ? topics[0] : undefined,
                      topics:
                        !examPrep && topics.length > 1 ? topics : undefined,
                    }),
                  });
                }}
                style={styles.stepCell}
                testID={`roadmap-step-${sectionIndex}-${stepIndex}`}
              >
                {bubble}
              </Pressable>
            );
          })}
          {row.length < STEPS_PER_ROW
            ? Array.from({ length: STEPS_PER_ROW - row.length }, (_, index) => (
                <View key={`pad-${index}`} style={styles.stepCell} />
              ))
            : null}
        </View>
      ))}
    </View>
  );
}

function StepBubble({
  index,
  state,
}: {
  index: number;
  state: StepState;
}) {
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom: 0 });
  const active = state === "active";
  const completed = state === "completed";

  return (
    <View style={styles.bubbleSlot}>
      {active ? (
        <>
          <View style={styles.bubbleRingOuter} />
          <View style={styles.bubbleRingInner} />
        </>
      ) : null}
      <View
        style={[
          styles.bubble,
          active || completed ? styles.bubbleActive : styles.bubbleIdle,
        ]}
      >
        {completed ? (
          <Icon color="#FFFFFF" name="checkmark" size={responsiveFont(18)} />
        ) : (
          <CText style={active ? styles.bubbleIndexActive : styles.bubbleIndex}>
            {index}
          </CText>
        )}
        {state === "premium" ? (
          <View style={styles.crownBadge}>
            <Icon color="#F0A93A" name="premiumSmall" size={responsiveFont(10)} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ExamSimulatorCard({
  premiumUnlocked,
  questionCount,
  sections,
  visuals,
}: {
  premiumUnlocked: boolean;
  questionCount: number;
  sections: RoadmapSection[];
  visuals: RoadmapStepVisual[][];
}) {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const examCountry = useAppShellStore((state) => state.examCountry);
  const styles = useStyles({ safeBottom: 0 });
  const sectionIndex = sections.findIndex((section) => section.examPrep);
  const steps = sectionIndex >= 0 ? sections[sectionIndex].steps : [];
  const examStep = steps.findIndex((step) => step.startsExam);
  const stepIndex = examStep >= 0 ? examStep : Math.max(0, steps.length - 1);
  const state = visuals[sectionIndex]?.[stepIndex] ?? "active";
  const premiumLocked = state === "premium" && !premiumUnlocked;

  return (
    <View style={styles.card}>
      <View style={styles.finalHeader}>
        <CText style={styles.finalEyebrow}>{t("roadmap.finalStepEyebrow")}</CText>
        <View style={styles.finalTitleRow}>
          <CText style={styles.finalTitle}>{t("roadmap.finalStepTitle")}</CText>
          <View style={styles.finalBadge}>
            <CText style={styles.finalBadgeLabel}>
              {t("roadmap.finalStepBadge", { count: questionCount })}
            </CText>
          </View>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const stepId =
            sectionIndex >= 0
              ? roadmapStepId(examCountry, sectionIndex, stepIndex)
              : null;

          if (stepId) {
            track(ANALYTICS_EVENTS.roadmapStepOpened.key, {
              locked: premiumLocked,
              premium: true,
              roadmap_step_id: stepId,
              section_index: sectionIndex,
              step_index: stepIndex,
            });
          }

          if (premiumLocked && stepId) {
            openTrackedPaywall(track, {
              roadmapStepId: stepId,
              source: "roadmap",
              surface: "home_step",
            });
            return;
          }

          router.navigate({
            pathname: "/exam",
            params: buildExamRouteParams({ mode: "exam" }),
          });
        }}
        style={styles.finalButton}
        testID="roadmap-exam-simulator"
      >
        <View style={styles.finalDisc}>
          <Icon
            color={accents.green.ink}
            name="exam"
            size={responsiveFont(52)}
          />
          {premiumLocked ? (
            <View style={styles.finalCrown}>
              <Icon
                color="#F0A93A"
                name="premiumSmall"
                size={responsiveFont(12)}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

function UnlockCard() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { accents } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom: 0 });

  return (
    <View style={styles.unlockCard} testID="home-unlock-card">
      <View style={styles.crownHalo}>
        <Icon color="#F0A93A" name="premium" size={responsiveFont(28)} />
      </View>
      <CText style={styles.unlockTitle}>{t("roadmap.unlockTitle")}</CText>
      <CText style={styles.unlockBody}>{t("roadmap.unlockBody")}</CText>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          openTrackedPaywall(track, {
            source: "roadmap",
            surface: "home_unlock",
          })
        }
        style={styles.unlockButton}
      >
        <CText style={styles.unlockButtonLabel}>{t("roadmap.unlockCta")}</CText>
        <Icon color="#FFFFFF" name="chevron" size={responsiveFont(16)} />
      </Pressable>
      <View style={styles.perks}>
        {PERK_KEYS.map((perk) => (
          <View key={perk.labelKey} style={styles.perk}>
            <Icon
              color={accents.green.ink}
              name={perk.icon}
              size={responsiveFont(22)}
            />
            <CText style={styles.perkLabel}>{t(perk.labelKey)}</CText>
          </View>
        ))}
      </View>
    </View>
  );
}

function RatingCard() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const { responsiveFont } = useResponsiveFonts();
  const styles = useStyles({ safeBottom: 0 });

  const handleYes = () => {
    track(ANALYTICS_EVENTS.appReviewRequested.key, {
      mode: null,
      source: "roadmap",
    });
    useReviewPromptStore.getState().markPrompted();
    void openStoreReview().catch((error) => {
      console.warn("Failed to open store review.", error);
      track(ANALYTICS_EVENTS.appReviewFailed.key, {
        mode: null,
        reason: "store_unavailable",
        source: "roadmap",
      });
      Alert.alert(
        t("profile.reviewUnavailableTitle"),
        t("profile.reviewUnavailableMessage")
      );
    });
  };

  return (
    <View style={styles.ratingCard} testID="home-rating-card">
      <CText style={styles.ratingTitle}>{t("roadmap.ratingTitle")}</CText>
      <View style={styles.ratingActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            track(ANALYTICS_EVENTS.appReviewSkipped.key, {
              mode: null,
              reason: "not_enjoying",
              source: "roadmap",
            });
          }}
          style={styles.ratingButton}
          testID="home-rating-no"
        >
          <Ionicons
            color="#8E8E93"
            name="thumbs-down-outline"
            size={responsiveFont(22)}
          />
          <CText style={styles.ratingButtonLabel}>{t("roadmap.ratingNo")}</CText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleYes}
          style={styles.ratingButton}
          testID="home-rating-yes"
        >
          <Ionicons
            color="#8E8E93"
            name="thumbs-up-outline"
            size={responsiveFont(22)}
          />
          <CText style={styles.ratingButtonLabel}>{t("roadmap.ratingYes")}</CText>
        </Pressable>
      </View>
    </View>
  );
}

function useStyles({ safeBottom }: { safeBottom: number }) {
  return useResponsiveStyles(
    ({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
      safeArea: {
        flex: 1,
      },
      scroll: {
        flex: 1,
      },
      content: {
        paddingTop: spacing.exact(8),
        paddingHorizontal: spacing.exact(16),
        paddingBottom: spacing.exact(96) + safeBottom,
        gap: spacing.exact(12),
      },
      debugPlusButton: {
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radius.pill,
        paddingVertical: spacing.exact(14),
      },
      debugPlusOn: {
        backgroundColor: "#14915A",
      },
      debugPlusOff: {
        backgroundColor: "#8FA099",
      },
      debugPlusLabel: {
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: colors.white,
      },
      card: {
        backgroundColor: colors.white,
        borderRadius: radius.xxxl,
        paddingHorizontal: spacing.exact(16),
        paddingTop: spacing.exact(16),
        paddingBottom: spacing.exact(18),
        gap: spacing.exact(16),
        ...elevation.card,
      },
      cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.exact(10),
      },
      sectionIcon: {
        width: responsiveFont(36),
        height: responsiveFont(36),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.accents.green.soft,
      },
      sectionTitle: {
        flex: 1,
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: colors.ink,
      },
      progress: {
        ...withResponsiveFont(getTypographyStyle("bodyS"), responsiveFont),
        color: colors.ink3,
      },
      chevronUp: {
        transform: [{ rotate: "-90deg" }],
      },
      snake: {
        gap: spacing.exact(8),
      },
      snakeRow: {
        flexDirection: "row",
        position: "relative",
      },
      snakeRowOffset: {
        flexDirection: "row",
        position: "relative",
        marginHorizontal: "16.66%",
      },
      snakeCell: {
        flex: 1,
        alignItems: "center",
        gap: spacing.exact(8),
        zIndex: 1,
      },
      snakeRail: {
        position: "absolute",
        top: responsiveFont(22),
        left: "16.66%",
        right: "16.66%",
        borderTopWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "#D5DED8",
      },
      snakeBend: {
        position: "absolute",
        top: responsiveFont(-36),
        right: "8%",
        width: responsiveFont(72),
        height: responsiveFont(56),
      },
      stepRow: {
        flexDirection: "row",
        position: "relative",
      },
      rowRail: {
        position: "absolute",
        top: responsiveFont(20),
        borderTopWidth: 1.5,
        borderStyle: "dashed",
        borderColor: "#D5DED8",
      },
      stepCell: {
        flex: 1,
        alignItems: "center",
        gap: spacing.exact(8),
        zIndex: 1,
      },
      stepLabel: {
        ...withResponsiveFont(getTypographyStyle("labelXS"), responsiveFont),
        color: colors.ink2,
        textAlign: "center",
      },
      stepLabelActive: {
        ...withResponsiveFont(getTypographyStyle("labelXS"), responsiveFont),
        color: colors.ink,
      },
      bubbleSlot: {
        width: responsiveFont(44),
        height: responsiveFont(44),
        alignItems: "center",
        justifyContent: "center",
      },
      bubbleRingOuter: {
        position: "absolute",
        width: responsiveFont(68),
        height: responsiveFont(68),
        borderRadius: radius.pill,
        backgroundColor: "rgba(31, 168, 106, 0.12)",
      },
      bubbleRingInner: {
        position: "absolute",
        width: responsiveFont(54),
        height: responsiveFont(54),
        borderRadius: radius.pill,
        backgroundColor: "rgba(31, 168, 106, 0.22)",
      },
      bubble: {
        width: responsiveFont(44),
        height: responsiveFont(44),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
      },
      bubbleActive: {
        backgroundColor: "#1FA86A",
      },
      bubbleIdle: {
        backgroundColor: "#E7EEEA",
      },
      bubbleIndex: {
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: "#C5D0CB",
      },
      bubbleIndexActive: {
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: colors.white,
      },
      crownBadge: {
        position: "absolute",
        top: responsiveFont(-2),
        right: responsiveFont(-2),
        width: responsiveFont(16),
        height: responsiveFont(16),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF6E4",
      },
      unlockCard: {
        backgroundColor: colors.white,
        borderRadius: radius.xxxl,
        paddingHorizontal: spacing.exact(20),
        paddingTop: spacing.exact(24),
        paddingBottom: spacing.exact(20),
        alignItems: "center",
        gap: spacing.exact(8),
        ...elevation.card,
      },
      crownHalo: {
        width: responsiveFont(56),
        height: responsiveFont(56),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF4D8",
        marginBottom: spacing.exact(4),
      },
      unlockTitle: {
        ...withResponsiveFont(getTypographyStyle("headingM"), responsiveFont),
        color: colors.ink,
        textAlign: "center",
      },
      unlockBody: {
        ...withResponsiveFont(getTypographyStyle("bodyS"), responsiveFont),
        color: colors.ink2,
        textAlign: "center",
        marginBottom: spacing.exact(8),
      },
      unlockButton: {
        alignSelf: "stretch",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(6),
        backgroundColor: "#14915A",
        borderRadius: radius.pill,
        paddingVertical: spacing.exact(14),
      },
      unlockButtonLabel: {
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: colors.white,
      },
      perks: {
        flexDirection: "row",
        alignSelf: "stretch",
        marginTop: spacing.exact(12),
        gap: spacing.exact(8),
      },
      perk: {
        flex: 1,
        alignItems: "center",
        gap: spacing.exact(6),
      },
      perkLabel: {
        ...withResponsiveFont(getTypographyStyle("labelXS"), responsiveFont),
        color: colors.ink2,
        textAlign: "center",
      },
      ratingCard: {
        backgroundColor: colors.white,
        borderRadius: radius.xxxl,
        paddingHorizontal: spacing.exact(20),
        paddingTop: spacing.exact(28),
        paddingBottom: spacing.exact(24),
        alignItems: "center",
        gap: spacing.exact(20),
        ...elevation.card,
      },
      ratingTitle: {
        ...withResponsiveFont(getTypographyStyle("headingM"), responsiveFont),
        color: colors.ink,
        textAlign: "center",
      },
      ratingActions: {
        flexDirection: "row",
        alignSelf: "stretch",
        gap: spacing.exact(12),
      },
      ratingButton: {
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.exact(8),
        backgroundColor: "#F2F2F7",
        borderRadius: radius.pill,
        paddingVertical: spacing.exact(16),
      },
      ratingButtonLabel: {
        ...withResponsiveFont(getTypographyStyle("headingS"), responsiveFont),
        color: "#8E8E93",
      },
      finalHeader: {
        gap: spacing.exact(2),
      },
      finalEyebrow: {
        ...withResponsiveFont(getTypographyStyle("labelXS"), responsiveFont),
        color: theme.accents.green.ink,
        letterSpacing: 0.8,
        textTransform: "uppercase",
      },
      finalTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      },
      finalTitle: {
        ...withResponsiveFont(getTypographyStyle("headingL"), responsiveFont),
        color: colors.ink,
        flexShrink: 1,
      },
      finalBadge: {
        backgroundColor: theme.accents.green.soft,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.exact(10),
        paddingVertical: spacing.exact(4),
      },
      finalBadgeLabel: {
        ...withResponsiveFont(getTypographyStyle("labelXS"), responsiveFont),
        color: theme.accents.green.ink,
      },
      finalButton: {
        alignItems: "center",
        paddingVertical: spacing.exact(8),
      },
      finalDisc: {
        width: responsiveFont(132),
        height: responsiveFont(132),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#E7F6EE",
        ...elevation.card,
      },
      finalCrown: {
        position: "absolute",
        top: responsiveFont(10),
        right: responsiveFont(10),
        width: responsiveFont(22),
        height: responsiveFont(22),
        borderRadius: radius.pill,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FFF6E4",
      },
    })
  );
}
