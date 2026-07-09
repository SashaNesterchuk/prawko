import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { useResponsiveStyles } from "../../src/portable-ui";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  buildExamRouteParams,
} from "../../src/features/exam/exam-routes";
import {
  getExamQuestionTarget,
  isExamSimulatorMode,
} from "../../src/features/exam/exam-config";
import { fetchRecentExamSessions } from "../../src/features/exam/supabase-exam";
import type { RemoteExamSession } from "../../src/features/exam/types";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import { buildQuestionSession } from "../../src/features/questions/question-engine";
import { formatPlanDate } from "../../src/features/study-plan/generate-local-study-plan";
import {
  buildLocalTodayPlan,
  fetchRemoteTodayPlan,
  getWarsawIsoDate,
  type RemoteTodayPlan,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import { createPracticeSessionBinding } from "../../src/features/study-plan/today-task-bindings";
import {
  useAppShellStore,
  useCurrentStudyPlan,
  useCurrentUser,
} from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

type PracticeCard = {
  key: string;
  cta: string;
  count: number;
  description: string;
  params: Record<string, string>;
  routeType: "exam" | "question";
  title: string;
};

export default function PracticeScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const authMode = useAppShellStore((state) => state.authMode);
  const currentUser = useCurrentUser();
  const currentUserId = currentUser?.id ?? null;
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const currentStudyPlan = useCurrentStudyPlan();
  const isFocused = useIsFocused();
  const [remoteTodayPlan, setRemoteTodayPlan] = useState<RemoteTodayPlan | null>(
    null
  );
  const [recentExamSessions, setRecentExamSessions] = useState<
    RemoteExamSession[]
  >([]);
  const [isLoadingRecentExamSessions, setIsLoadingRecentExamSessions] =
    useState(false);
  const todayPlan = useMemo(
    () => remoteTodayPlan ?? buildLocalTodayPlan(currentStudyPlan, getWarsawIsoDate()),
    [currentStudyPlan, remoteTodayPlan]
  );
  const examBinding = useMemo(
    () => createPracticeSessionBinding("exam", todayPlan),
    [todayPlan]
  );
  const wrongAnswersBinding = useMemo(
    () => createPracticeSessionBinding("wrong_answers", todayPlan),
    [todayPlan]
  );
  const savedBinding = useMemo(
    () => createPracticeSessionBinding("saved", todayPlan),
    [todayPlan]
  );
  const seenNotMasteredBinding = useMemo(
    () => createPracticeSessionBinding("seen_not_mastered", todayPlan),
    [todayPlan]
  );
  const examMode = isExamSimulatorMode(examBinding.mode)
    ? examBinding.mode
    : "exam";
  const examQuestionTarget = getExamQuestionTarget(
    examMode,
    examMode === "exam" ? undefined : examBinding.questionLimit
  );

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (
      authMode !== "supabase" ||
      !currentUserId ||
      !isMobileSupabaseConfigured
    ) {
      setRemoteTodayPlan(null);
      return;
    }

    let cancelled = false;

    void fetchRemoteTodayPlan()
      .then((todayPlan) => {
        if (!cancelled) {
          setRemoteTodayPlan(todayPlan);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to fetch remote today plan for Practice.", error);
          setRemoteTodayPlan(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, currentStudyPlanRemoteId, currentUserId, isFocused]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (
      authMode !== "supabase" ||
      !currentUserId ||
      !isMobileSupabaseConfigured
    ) {
      setRecentExamSessions([]);
      setIsLoadingRecentExamSessions(false);
      return;
    }

    let cancelled = false;
    setIsLoadingRecentExamSessions(true);

    void fetchRecentExamSessions(1)
      .then((sessions) => {
        if (!cancelled) {
          setRecentExamSessions(sessions);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to fetch recent exam sessions.", error);
          setRecentExamSessions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRecentExamSessions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, currentUserId, isFocused]);

  const sessionSizes = useMemo(
    () => ({
      exam: buildQuestionSession(
        {
          ...examBinding,
          questionLimit: examQuestionTarget,
          sessionKey: "preview-exam",
        },
        questionUserState
      ).questionIds.length,
      saved: buildQuestionSession(
        {
          ...savedBinding,
          sessionKey: "preview-saved",
        },
        questionUserState
      ).questionIds.length,
      seenNotMastered: buildQuestionSession(
        {
          ...seenNotMasteredBinding,
          sessionKey: "preview-seen-not-mastered",
        },
        questionUserState
      ).questionIds.length,
      wrongAnswers: buildQuestionSession(
        {
          ...wrongAnswersBinding,
          sessionKey: "preview-wrong-answers",
        },
        questionUserState
      ).questionIds.length,
    }),
    [
      examBinding,
      questionCatalogVersion,
      questionUserState,
      savedBinding,
      seenNotMasteredBinding,
      wrongAnswersBinding,
    ]
  );

  const practiceCards: PracticeCard[] = [
    {
      key: "exam",
      cta: "practice.startExam",
      count: sessionSizes.exam,
      description: "practice.examSubtitle",
      params: buildExamRouteParams({
        mode: examMode,
        questionLimit: examQuestionTarget,
        studyPlanTaskId: examBinding.studyPlanTaskId,
      }),
      routeType: "exam",
      title: "practice.examTitle",
    },
    {
      key: "wrong_answers",
      cta: "practice.openWrongAnswers",
      count: sessionSizes.wrongAnswers,
      description: "practice.wrongAnswersSubtitle",
      params: buildQuestionRouteParams(wrongAnswersBinding),
      routeType: "question",
      title: "practice.wrongAnswersTitle",
    },
    {
      key: "saved",
      cta: "practice.openSaved",
      count: sessionSizes.saved,
      description: "practice.savedSubtitle",
      params: buildQuestionRouteParams(savedBinding),
      routeType: "question",
      title: "practice.savedTitle",
    },
    {
      key: "quick_practice",
      cta: "practice.startQuickPractice",
      count: sessionSizes.seenNotMastered,
      description: "practice.quickPracticeSubtitle",
      params: buildQuestionRouteParams(seenNotMasteredBinding),
      routeType: "question",
      title: "practice.quickPracticeTitle",
    },
  ];

  function openPracticeRoute(input: {
    params: Record<string, string>;
    routeType: "exam" | "question";
  }) {
    if (input.routeType === "exam") {
      router.push({
        pathname: "/exam",
        params: input.params,
      });
      return;
    }

    router.push({
      pathname: "/question",
      params: input.params,
    });
  }

  return (
    <AppScreen
      title={t("tabs.practiceTitle")}
      subtitle={t("tabs.practiceSubtitle")}
    >
      <View style={styles.cardStack}>
        {isLoadingRecentExamSessions ? (
          <AppCard>
            <Text style={styles.cardTitle}>
              {t("practice.recentExamsTitle")}
            </Text>
            <Text style={styles.cardBody}>
              {t("practice.recentExamsLoading")}
            </Text>
          </AppCard>
        ) : (
          <AppCard>
            <Text style={styles.cardTitle}>
              {t("practice.recentExamsTitle")}
            </Text>
            <Text
              style={[
                styles.cardBody,
                recentExamSessions.length > 0 ? styles.cardBodyWithMargin : null,
              ]}
            >
              {recentExamSessions.length > 0
                ? t("practice.recentExamsSubtitle")
                : t("practice.recentExamsEmptyBody")}
            </Text>
            {recentExamSessions.length > 0 ? (
              <View style={styles.historyStack}>
                {recentExamSessions.map((session) => (
                  <View key={session.id}>
                    <Text style={styles.historyTitle}>
                      {t("practice.latestExamSummary", {
                        outcome: t(
                          `practice.historyOutcomes.${getRecentExamOutcomeKey(session)}`
                        ),
                      })}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {t("practice.historyDate", {
                        date: formatPlanDate(
                          (session.finishedAt ?? session.startedAt).slice(0, 10)
                        ),
                      })}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {t("practice.historyScore", {
                        score: session.scorePoints,
                        total: session.totalPointsTarget,
                      })}
                    </Text>
                    <Text style={styles.historyMetaWithMargin}>
                      {t("practice.historyQuestions", {
                        answered: session.totalQuestionsAnswered,
                        total: session.totalQuestionsTarget,
                        wrong: session.wrongAnswersCount,
                      })}
                    </Text>
                    <AppButton
                      variant="ghost"
                      label={t("practice.openExamResult")}
                      onPress={() =>
                        router.push({
                          pathname: "/exam/result",
                          params: {
                            sessionId: session.id,
                          },
                        })
                      }
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </AppCard>
        )}

        {practiceCards.map((card) => (
          <PracticeCardView
            key={card.key}
            card={card}
            onOpen={openPracticeRoute}
            t={t}
          />
        ))}
      </View>
    </AppScreen>
  );
}

function getRecentExamOutcomeKey(
  session: RemoteExamSession
): "passed" | "failed" | "expired" | "abandoned" {
  if (session.status === "expired") {
    return "expired";
  }

  if (session.status === "abandoned") {
    return "abandoned";
  }

  return session.passed ? "passed" : "failed";
}

function PracticeCardView({
  card,
  onOpen,
  t,
}: {
  card: PracticeCard;
  onOpen: (input: { params: Record<string, string>; routeType: "exam" | "question" }) => void;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const styles = useStyles();

  return (
    <AppCard>
      <Text style={styles.cardTitle}>
        {t(card.title)}
      </Text>
      <Text style={styles.cardBodyWithSmallMargin}>
        {t(card.description, {
          count: card.count,
        })}
      </Text>
      <AppButton
        variant="secondary"
        label={t(card.cta)}
        onPress={() =>
          onOpen({
            params: card.params,
            routeType: card.routeType,
          })
        }
      />
    </AppCard>
  );
}

function useStyles() {
  return useResponsiveStyles(({ responsiveFont, spacing }) => ({
    cardStack: {
      gap: spacing.exact(12),
    },
    cardTitle: {
      fontSize: responsiveFont(18),
      fontWeight: "700",
      marginBottom: spacing.exact(4),
    },
    cardBody: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
    },
    cardBodyWithMargin: {
      marginBottom: spacing.exact(12),
    },
    cardBodyWithSmallMargin: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(22),
      marginBottom: spacing.exact(8),
    },
    historyStack: {
      gap: spacing.exact(10),
    },
    historyTitle: {
      fontSize: responsiveFont(16),
      fontWeight: "700",
      marginBottom: spacing.exact(4),
    },
    historyMeta: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
    },
    historyMetaWithMargin: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(20),
      marginBottom: spacing.exact(8),
    },
  }));
}
