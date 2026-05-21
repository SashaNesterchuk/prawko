import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import {
  EmptyStateView,
  LoadingStateView,
} from "../../src/components/shell/StateViews";
import {
  buildExamRouteParams,
} from "../../src/features/exam/exam-routes";
import { fetchExamSessionSnapshot } from "../../src/features/exam/supabase-exam";
import {
  getLocalizedText,
  getQuestionById,
  getQuestionChoices,
} from "../../src/features/questions/question-engine";
import {
  buildQuestionRouteParams,
  isUuidString,
} from "../../src/features/questions/question-routes";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import type { RemoteExamSnapshot } from "../../src/features/exam/types";

export default function ExamResultScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    sessionId?: string | string[];
  }>();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const [snapshot, setSnapshot] = useState<RemoteExamSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const rawSessionId = getSingleParam(params.sessionId);
  const sessionId = isUuidString(rawSessionId) ? rawSessionId : null;

  useEffect(() => {
    if (!sessionId) {
      setErrorMessage("Invalid exam session id.");
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void fetchExamSessionSnapshot(sessionId)
      .then((nextSnapshot) => {
        if (!cancelled) {
          setSnapshot(nextSnapshot);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Failed to fetch exam result snapshot.", error);
          setErrorMessage(getErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!snapshot || snapshot.session.status !== "active") {
      return;
    }

    router.replace({
      pathname: "/exam/session",
      params: {
        sessionId: snapshot.session.id,
      },
    });
  }, [snapshot]);

  const resultStatus = useMemo(() => {
    if (!snapshot) {
      return "failed";
    }

    if (snapshot.session.status === "expired") {
      return "expired";
    }

    if (snapshot.session.status === "abandoned") {
      return "abandoned";
    }

    return snapshot.session.passed ? "passed" : "failed";
  }, [snapshot]);

  const wrongEntries = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return snapshot.answers
      .filter((answer) => !answer.isCorrect)
      .map((answer) => {
        const question = getQuestionById(answer.questionSourceId);
        const answerLabels = question
          ? Object.fromEntries(
              getQuestionChoices(question, preferredLocale).map((choice) => [
                choice.id,
                choice.label,
              ])
            )
          : {};

        return {
          answer,
          answerLabels,
          question,
        };
      });
  }, [preferredLocale, questionCatalogVersion, snapshot]);

  if (isLoading) {
    return (
      <AppScreen
        title={t("exam.resultTitle")}
        subtitle={t("exam.resultLoading")}
        scroll={false}
      >
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("exam.resultLoading")}
        />
      </AppScreen>
    );
  }

  if (!snapshot) {
    return (
      <AppScreen
        title={t("exam.resultTitle")}
        subtitle={t("exam.resultMissingTitle")}
        footer={
          <View style={{ gap: 10 }}>
            <AppButton
              label={t("exam.backToPracticeCta")}
              onPress={() => router.replace("/(tabs)/practice")}
            />
          </View>
        }
      >
        <EmptyStateView
          title={t("exam.resultMissingTitle")}
          description={errorMessage ?? t("exam.resultMissingBody")}
        />
      </AppScreen>
    );
  }

  const restartParams = buildExamRouteParams({
    mode: snapshot.session.mode,
    questionLimit: snapshot.session.totalQuestionsTarget,
    studyPlanTaskId: getStudyPlanTaskId(snapshot.session.metadata),
  });

  return (
    <AppScreen
      title={t("exam.resultTitle")}
      subtitle={t(`exam.outcomes.${resultStatus}.subtitle`, {
        score: snapshot.session.scorePoints,
        total: snapshot.session.totalPointsTarget,
      })}
      footer={
        <View style={{ gap: 10 }}>
          <AppButton
            label={t("exam.retryCta")}
            onPress={() =>
              router.replace({
                pathname: "/exam",
                params: restartParams,
              })
            }
          />
          {wrongEntries.length > 0 ? (
            <AppButton
              variant="secondary"
              label={t("exam.reviewWrongAnswersCta")}
              onPress={() =>
                router.replace({
                  pathname: "/question",
                  params: buildQuestionRouteParams({
                    mode: "wrong_answers",
                  }),
                })
              }
            />
          ) : null}
          <AppButton
            variant="ghost"
            label={t("exam.backToPracticeCta")}
            onPress={() => router.replace("/(tabs)/practice")}
          />
        </View>
      }
    >
      <View style={{ gap: 12 }}>
        <AppCard accent={resultStatus === "passed"}>
          <Text style={badgeText}>{t(`exam.outcomes.${resultStatus}.title`)}</Text>
          <Text style={scoreText}>
            {snapshot.session.scorePoints}/{snapshot.session.totalPointsTarget}
          </Text>
          <Text style={bodyText}>
            {t("exam.resultBody", {
              answered: snapshot.session.totalQuestionsAnswered,
              correct: snapshot.session.correctAnswersCount,
              total: snapshot.session.totalQuestionsTarget,
              wrong: snapshot.session.wrongAnswersCount,
            })}
          </Text>
        </AppCard>

        <AppCard>
          <Text style={sectionTitle}>{t("exam.resultBreakdownTitle")}</Text>
          <View style={summaryGrid}>
            <MetricItem
              label={t("exam.metricCorrect")}
              value={snapshot.session.correctAnswersCount.toString()}
            />
            <MetricItem
              label={t("exam.metricWrong")}
              value={snapshot.session.wrongAnswersCount.toString()}
            />
            <MetricItem
              label={t("exam.metricAnswered")}
              value={snapshot.session.totalQuestionsAnswered.toString()}
            />
            <MetricItem
              label={t("exam.metricPassTarget")}
              value={snapshot.session.passPoints.toString()}
            />
          </View>
        </AppCard>

        {wrongEntries.length > 0 ? (
          <>
            <AppCard>
              <Text style={sectionTitle}>{t("exam.wrongAnswersTitle")}</Text>
              <Text style={bodyText}>{t("exam.wrongAnswersBody")}</Text>
            </AppCard>

            {wrongEntries.map(({ answer, answerLabels, question }) => (
              <AppCard key={`${answer.questionSourceId}-${answer.order}`}>
                <Text style={questionTitle}>
                  {question
                    ? getLocalizedText(question.prompt, preferredLocale)
                    : t("exam.questionUnavailable")}
                </Text>
                <Text style={answerLine}>
                  {t("exam.yourAnswerLine", {
                    answer:
                      answerLabels[answer.answerGiven] ??
                      answer.answerGiven.toUpperCase(),
                  })}
                </Text>
                <Text style={answerLine}>
                  {t("exam.correctAnswerLine", {
                    answer: question
                      ? answerLabels[question.correctAnswer] ??
                        question.correctAnswer.toUpperCase()
                      : "?",
                  })}
                </Text>
                {question ? (
                  <Text style={bodyText}>
                    {getLocalizedText(question.explanation, preferredLocale)}
                  </Text>
                ) : null}
              </AppCard>
            ))}
          </>
        ) : (
          <AppCard>
            <Text style={sectionTitle}>{t("exam.noWrongAnswersTitle")}</Text>
            <Text style={bodyText}>{t("exam.noWrongAnswersBody")}</Text>
          </AppCard>
        )}
      </View>
    </AppScreen>
  );
}

function MetricItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={metricItem}>
      <Text style={metricValue}>{value}</Text>
      <Text style={metricLabel}>{label}</Text>
    </View>
  );
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getStudyPlanTaskId(metadata: Record<string, unknown>) {
  const value = metadata.study_plan_task_id;

  return typeof value === "string" && value.trim() ? value : undefined;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim()
    ? message
    : "Unable to load exam result.";
}

const badgeText = {
  color: "#4E5A52",
  fontSize: 12,
  fontWeight: "800" as const,
  letterSpacing: 0.6,
  lineHeight: 18,
  marginBottom: 8,
  textTransform: "uppercase" as const,
};

const scoreText = {
  color: "#1E5B4F",
  fontSize: 34,
  fontWeight: "800" as const,
  lineHeight: 40,
  marginBottom: 8,
};

const sectionTitle = {
  color: "#182018",
  fontSize: 18,
  fontWeight: "700" as const,
  lineHeight: 25,
  marginBottom: 8,
};

const bodyText = {
  color: "#4E5A52",
  fontSize: 14,
  lineHeight: 22,
};

const summaryGrid = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 12,
};

const metricItem = {
  minWidth: "46%" as const,
  gap: 2,
};

const metricValue = {
  color: "#182018",
  fontSize: 24,
  fontWeight: "800" as const,
  lineHeight: 30,
};

const metricLabel = {
  color: "#4E5A52",
  fontSize: 13,
  lineHeight: 20,
};

const questionTitle = {
  color: "#182018",
  fontSize: 16,
  fontWeight: "700" as const,
  lineHeight: 24,
  marginBottom: 10,
};

const answerLine = {
  color: "#4E5A52",
  fontSize: 13,
  fontWeight: "700" as const,
  lineHeight: 20,
  marginBottom: 6,
};
