import { router } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { AppButton } from "../../../components/shell/AppButton";
import { buildQuestionRouteParams } from "../question-routes";

import type { QuestionTrainingSession } from "./useQuestionTrainingSession";

export function QuestionTrainingFooter({
  activeSession,
  advanceSession,
  currentAnswer,
  isCompleted,
  isEmptyState,
  sessionMode,
  summary,
  topic,
  trainerStyles,
}: Pick<
  QuestionTrainingSession,
  | "activeSession"
  | "advanceSession"
  | "currentAnswer"
  | "isCompleted"
  | "isEmptyState"
  | "sessionMode"
  | "summary"
  | "topic"
  | "trainerStyles"
>) {
  const { t } = useTranslation();

  return (
    <View style={trainerStyles.footerStack}>
      {isCompleted ? (
        <>
          <AppButton
            label={t("question.restartSession")}
            onPress={() =>
              router.replace({
                pathname: "/question",
                params: buildQuestionRouteParams({
                  mode: activeSession?.request.mode ?? sessionMode,
                  questionLimit: activeSession?.request.questionLimit,
                  studyPlanTaskId: activeSession?.request.studyPlanTaskId,
                  topic: activeSession?.request.topic,
                }),
              })
            }
          />
          {summary.wrong > 0 ? (
            <AppButton
              variant="secondary"
              label={t("question.reviewWeakSpots")}
              onPress={() =>
                router.replace({
                  pathname: "/question",
                  params: buildQuestionRouteParams({ mode: "weak_spots" }),
                })
              }
            />
          ) : null}
        </>
      ) : null}

      {isEmptyState ? (
        <AppButton
          label={t("question.openLearningQueue")}
          onPress={() =>
            router.replace({
              pathname: "/question",
              params: buildQuestionRouteParams({ mode: "learning", topic }),
            })
          }
        />
      ) : null}

      {!isCompleted && !isEmptyState && currentAnswer ? (
        <AppButton
          label={
            summary.answered >= summary.total
              ? t("question.openSummary")
              : t("question.nextQuestion")
          }
          onPress={() => advanceSession()}
        />
      ) : null}

      <AppButton
        variant="ghost"
        label={t("common.close")}
        onPress={() => router.back()}
      />
    </View>
  );
}
