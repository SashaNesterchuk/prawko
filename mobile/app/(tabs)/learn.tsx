import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { TOPIC_BLOCK_IDS } from "@prawko/config";

import { AppButton } from "../../src/components/shell/AppButton";
import { AppCard } from "../../src/components/shell/AppCard";
import { AppScreen } from "../../src/components/shell/AppScreen";
import { ProgressBar } from "../../src/components/shell/ProgressBar";
import { isMobileSupabaseConfigured } from "../../src/config/env";
import { buildQuestionRouteParams } from "../../src/features/questions/question-routes";
import {
  getQuestionDisplayStats,
  getTopicProgress,
} from "../../src/features/questions/question-engine";
import {
  fetchRemoteTodayPlan,
  type RemoteTodayPlan,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import { createLearningSessionBinding } from "../../src/features/study-plan/today-task-bindings";
import { useAppShellStore } from "../../src/state/app-shell";
import { useQuestionCatalogVersion } from "../../src/state/question-catalog";
import { useQuestionProgressStore } from "../../src/state/question-progress";

export default function LearnTabScreen() {
  const { t } = useTranslation();
  const authMode = useAppShellStore((state) => state.authMode);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const questionCatalogVersion = useQuestionCatalogVersion();
  const questionUserState = useQuestionProgressStore(
    (state) => state.questionUserState
  );
  const isFocused = useIsFocused();
  const [remoteTodayPlan, setRemoteTodayPlan] = useState<RemoteTodayPlan | null>(
    null
  );

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
          console.warn("Failed to fetch remote today plan for Learn.", error);
          setRemoteTodayPlan(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, currentStudyPlanRemoteId, isFocused]);

  const overallStats = useMemo(
    () => getQuestionDisplayStats(questionUserState),
    [questionCatalogVersion, questionUserState]
  );

  return (
    <AppScreen title={t("tabs.learnTitle")} subtitle={t("tabs.learnSubtitle")}>
      <View style={{ gap: 12 }}>
        <AppCard accent>
          <Text style={{ fontSize: 13, fontWeight: "700", marginBottom: 8 }}>
            {t("learn.snapshotTitle")}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: "800", marginBottom: 6 }}>
            {overallStats.seen}/{overallStats.total}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 22 }}>
            {t("learn.snapshotBody", {
              reviewDue: overallStats.reviewDue,
              weak: overallStats.weakSpots,
            })}
          </Text>
        </AppCard>

        {TOPIC_BLOCK_IDS.map((topic) => {
          const progress = getTopicProgress(topic, questionUserState);
          const binding = createLearningSessionBinding(topic, remoteTodayPlan);

          return (
            <AppCard key={topic}>
              <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 4 }}>
                {t(`topics.${topic}`)}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 22, marginBottom: 10 }}>
                {t("learn.blockDescription", {
                  progress: progress.progress,
                  seen: progress.seen,
                  total: progress.total,
                  weak: progress.weak,
                })}
              </Text>
              <ProgressBar progress={progress.progress} />

              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 12,
                  marginTop: 12,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontSize: 13, lineHeight: 20 }}>
                  {t("learn.seenStat", {
                    seen: progress.seen,
                    total: progress.total,
                  })}
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 20 }}>
                  {t("learn.masteredStat", {
                    mastered: progress.mastered,
                  })}
                </Text>
                <Text style={{ fontSize: 13, lineHeight: 20 }}>
                  {t("learn.weakStat", {
                    weak: progress.weak,
                  })}
                </Text>
              </View>

              <AppButton
                variant="secondary"
                label={
                  progress.seen > 0
                    ? t("learn.continueTopic")
                    : t("learn.startTopic")
                }
                onPress={() =>
                  router.push({
                    pathname: "/question",
                    params: buildQuestionRouteParams(binding),
                  })
                }
              />
            </AppCard>
          );
        })}
      </View>
    </AppScreen>
  );
}
