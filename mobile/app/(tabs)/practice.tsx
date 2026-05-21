import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import {
  buildExamRouteParams,
} from "../../src/features/exam/exam-routes";
import {
  getExamQuestionTarget,
  isExamSimulatorMode,
} from "../../src/features/exam/exam-config";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  buildQuestionSession,
  getQuestionDisplayStats,
} from "../../src/features/questions/question-engine";
import {
  fetchRemoteTodayPlan,
  type RemoteTodayPlan,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import { createPracticeSessionBinding } from "../../src/features/study-plan/today-task-bindings";
import { useAppShellStore } from "../../src/state/app-shell";
import { useHasFeatureAccess } from "../../src/state/entitlements";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

type PracticeCardAction = {
  cta: string;
  params: Record<string, string>;
  routeType: "exam" | "question";
};

type PracticeCard = {
  key: string;
  cta: string;
  count: number;
  description: string;
  params: Record<string, string>;
  routeType: "exam" | "question";
  secondaryAction?: PracticeCardAction;
  title: string;
};

export default function PracticeTabScreen() {
  const { t } = useTranslation();
  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const questionCatalogVersion = useQuestionCatalogVersion();
  const hasExamAccess = useHasFeatureAccess("exam_simulator");
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const isFocused = useIsFocused();
  const [remoteTodayPlan, setRemoteTodayPlan] = useState<RemoteTodayPlan | null>(
    null
  );
  const stats = useMemo(
    () => getQuestionDisplayStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );
  const examBinding = useMemo(
    () => createPracticeSessionBinding("exam", remoteTodayPlan),
    [remoteTodayPlan]
  );
  const weakSpotsBinding = useMemo(
    () => createPracticeSessionBinding("weak_spots", remoteTodayPlan),
    [remoteTodayPlan]
  );
  const wrongAnswersBinding = useMemo(
    () => createPracticeSessionBinding("wrong_answers", remoteTodayPlan),
    [remoteTodayPlan]
  );
  const savedBinding = useMemo(
    () => createPracticeSessionBinding("saved", remoteTodayPlan),
    [remoteTodayPlan]
  );
  const savedSprintBinding = useMemo(
    () => createPracticeSessionBinding("saved_sprint", remoteTodayPlan),
    [remoteTodayPlan]
  );
  const hardQuestionsBinding = useMemo(
    () => createPracticeSessionBinding("hard_questions", remoteTodayPlan),
    [remoteTodayPlan]
  );
  const seenNotMasteredBinding = useMemo(
    () => createPracticeSessionBinding("seen_not_mastered", remoteTodayPlan),
    [remoteTodayPlan]
  );
  const examMode = isExamSimulatorMode(examBinding.mode)
    ? examBinding.mode
    : "exam";
  const examQuestionTarget = getExamQuestionTarget(
    examMode,
    examMode === "exam" ? undefined : examBinding.questionLimit
  );
  const examTomorrowTarget = getExamQuestionTarget("exam_tomorrow");

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
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
  }, [authMode, currentStudyPlanRemoteId, isFocused]);

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
      examTomorrow: buildQuestionSession(
        {
          mode: "exam_tomorrow",
          questionLimit: examTomorrowTarget,
          sessionKey: "preview-exam-tomorrow",
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
      savedSprint: buildQuestionSession(
        {
          ...savedSprintBinding,
          sessionKey: "preview-saved-sprint",
        },
        questionUserState
      ).questionIds.length,
      hardQuestions: buildQuestionSession(
        {
          ...hardQuestionsBinding,
          sessionKey: "preview-hard-questions",
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
      weakSpots: buildQuestionSession(
        {
          ...weakSpotsBinding,
          sessionKey: "preview-weak-spots",
        },
        questionUserState
      ).questionIds.length,
    }),
    [
      examBinding,
      questionCatalogVersion,
      hardQuestionsBinding,
      questionUserState,
      savedBinding,
      savedSprintBinding,
      seenNotMasteredBinding,
      weakSpotsBinding,
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
      key: "weak",
      cta: "practice.reviewWeakSpots",
      count: sessionSizes.weakSpots,
      description: "practice.weakSubtitle",
      params: buildQuestionRouteParams(weakSpotsBinding),
      routeType: "question",
      title: "practice.weakTitle",
    },
    {
      key: "hard_questions",
      cta: "practice.openHardQuestions",
      count: sessionSizes.hardQuestions,
      description: "practice.hardSubtitle",
      params: buildQuestionRouteParams(hardQuestionsBinding),
      routeType: "question",
      title: "practice.hardTitle",
    },
    {
      key: "seen_not_mastered",
      cta: "practice.openSeenNotMastered",
      count: sessionSizes.seenNotMastered,
      description: "practice.seenNotMasteredSubtitle",
      params: buildQuestionRouteParams(seenNotMasteredBinding),
      routeType: "question",
      title: "practice.seenNotMasteredTitle",
    },
    {
      key: "saved",
      cta: "practice.openSaved",
      count: sessionSizes.saved,
      description: "practice.savedSubtitle",
      params: buildQuestionRouteParams(savedBinding),
      routeType: "question",
      title: "practice.savedTitle",
      secondaryAction: {
        cta: "practice.startSavedSprint",
        params: buildQuestionRouteParams(savedSprintBinding),
        routeType: "question",
      },
    },
    {
      key: "tomorrow",
      cta: "practice.examTomorrow",
      count: sessionSizes.examTomorrow,
      description: "practice.tomorrowSubtitle",
      params: buildExamRouteParams({
        mode: "exam_tomorrow",
        questionLimit: examTomorrowTarget,
      }),
      routeType: "exam",
      title: "practice.tomorrowTitle",
    },
  ];

  function openPracticeRoute(input: {
    params: Record<string, string>;
    routeType: "exam" | "question";
  }) {
    if (input.routeType === "exam") {
      if (!hasExamAccess) {
        router.push({
          pathname: "/modals/paywall",
          params: {
            feature: "exam_simulator",
          },
        });
        return;
      }

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
      <View style={{ gap: 12 }}>
        <AppCard accent>
          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
            {t("practice.snapshotTitle")}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 6 }}>
            {stats.weakSpots}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 22 }}>
            {t("practice.snapshotBody", {
              saved: stats.saved,
              reviewDue: stats.reviewDue,
            })}
          </Text>
        </AppCard>

        {practiceCards.map((card) => (
          <PracticeCardView
            key={card.key}
            card={card}
            onOpen={openPracticeRoute}
            t={t}
          />
        ))}

        <AppButton
          variant="ghost"
          label={t("practice.openPaywall")}
          onPress={() => router.push("/modals/paywall")}
        />
      </View>
    </AppScreen>
  );
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
  const secondaryAction = card.secondaryAction;

  return (
    <AppCard>
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
        {t(card.title)}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 22, marginBottom: 8 }}>
        {t(card.description, {
          count: card.count,
        })}
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 20, marginBottom: 12 }}>
        {t("practice.queueCount", {
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
      {secondaryAction ? (
        <View style={{ marginTop: 10 }}>
          <AppButton
            variant="ghost"
            label={t(secondaryAction.cta)}
            onPress={() =>
              onOpen({
                params: secondaryAction.params,
                routeType: secondaryAction.routeType,
              })
            }
          />
        </View>
      ) : null}
    </AppCard>
  );
}
