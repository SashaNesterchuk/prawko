import { router } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";

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
  formatPlanDate,
} from "../../src/features/study-plan/generate-local-study-plan";
import {
  fetchRemoteHomeProgress,
  getWarsawIsoDate,
  skipTodayPlanDayRemotely,
  type RemoteReadinessSummary,
  type RemoteTodayPlan,
  type RemoteTodayPlanTask,
  updateRemoteStudyPlanTaskStatus,
} from "../../src/features/study-plan/supabase-study-plan-progress";
import { createTaskSessionBinding } from "../../src/features/study-plan/today-task-bindings";
import { useTheme } from "../../src/providers/ThemeProvider";
import {
  useCurrentStudyPlan,
  useCurrentUser,
  useAppShellStore,
} from "../../src/state/app-shell";
import { useHasFeatureAccess } from "../../src/state/entitlements";

export default function HomeTabScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = getStyles(theme);
  const authMode = useAppShellStore((state) => state.authMode);
  const hasExamAccess = useHasFeatureAccess("exam_simulator");
  const user = useCurrentUser();
  const currentStudyPlan = useCurrentStudyPlan();
  const preferredLocale = useAppShellStore((state) => state.preferredLocale);
  const currentStudyPlanRemoteId = useAppShellStore(
    (state) => state.currentStudyPlanRemoteId
  );
  const studyPlanSetup = useAppShellStore((state) => state.studyPlanSetup);
  const isFocused = useIsFocused();
  const [remoteReadinessSummary, setRemoteReadinessSummary] =
    useState<RemoteReadinessSummary | null>(null);
  const [remoteTodayPlan, setRemoteTodayPlan] = useState<RemoteTodayPlan | null>(
    null
  );
  const [isRemoteLoading, setIsRemoteLoading] = useState(false);
  const [isSkippingDay, setIsSkippingDay] = useState(false);
  const [taskSyncError, setTaskSyncError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const todayIsoDate = getWarsawIsoDate();

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      setRemoteReadinessSummary(null);
      setRemoteTodayPlan(null);
      setIsRemoteLoading(false);
      setTaskSyncError(null);
      return;
    }

    let cancelled = false;

    setIsRemoteLoading(true);
    setTaskSyncError(null);

    void fetchRemoteHomeProgress(todayIsoDate)
      .then(({ readinessSummary, todayPlan }) => {
        if (cancelled) {
          return;
        }

        setRemoteReadinessSummary(readinessSummary);
        setRemoteTodayPlan(todayPlan);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.warn("Failed to fetch remote study plan progress.", error);
        setRemoteReadinessSummary(null);
        setRemoteTodayPlan(null);
        setTaskSyncError(t("home.remoteProgressFallback"));
      })
      .finally(() => {
        if (!cancelled) {
          setIsRemoteLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMode, currentStudyPlanRemoteId, isFocused, t, todayIsoDate]);

  const localTodayPlan = useMemo(() => {
    if (!currentStudyPlan) {
      return null;
    }

    const today = currentStudyPlan.days.find((day) => day.planDate === todayIsoDate);

    if (!today) {
      return null;
    }

    return {
      dayNumber: today.dayNumber,
      dayStatus: today.minimumMode ? "in_progress" : "pending",
      planDate: today.planDate,
      studyPlanDayId: today.id,
      studyPlanId: currentStudyPlan.id,
      tasks: today.tasks.map((task, index) => ({
        description: task.description,
        estimatedMinutes: task.estimatedMinutes,
        id: task.id,
        questionCountCompleted: 0,
        questionCountTarget: task.questionCountTarget ?? null,
        sortOrder: index + 1,
        status: "pending",
        title: task.title,
        topicBlock: task.topicBlock ?? null,
        taskType: task.taskType,
      })),
    } satisfies RemoteTodayPlan;
  }, [currentStudyPlan, todayIsoDate]);

  const today = remoteTodayPlan ?? localTodayPlan;
  const readinessScore =
    remoteReadinessSummary?.readinessScore ??
    (currentStudyPlan
      ? Math.min(
          92,
          40 +
            currentStudyPlan.summary.miniTestDays * 4 +
            currentStudyPlan.summary.fullExamDays * 6
        )
      : 0);
  const summaryExamDate =
    remoteReadinessSummary?.examDate ?? currentStudyPlan?.examDate ?? null;
  const completedTasks =
    today?.tasks.filter((task) => task.status === "completed").length ?? 0;
  const totalTasks = today?.tasks.length ?? 0;
  const canToggleRemoteTasks =
    authMode === "supabase" &&
    isMobileSupabaseConfigured &&
    Boolean(remoteTodayPlan);
  const hasPlan = Boolean(
    currentStudyPlan ||
      currentStudyPlanRemoteId ||
      remoteReadinessSummary?.activeStudyPlanId ||
      remoteTodayPlan
  );
  const missedPlanDays = useMemo(() => {
    if (!today || !remoteReadinessSummary) {
      return 0;
    }

    return Math.max(
      0,
      (today.dayNumber - 1) - remoteReadinessSummary.completedPlanDays
    );
  }, [remoteReadinessSummary, today]);
  const nextTodayTask = useMemo(
    () =>
      today?.tasks.find((task) => {
        if (task.status !== "pending" && task.status !== "in_progress") {
          return false;
        }

        return Boolean(
          createTaskSessionBinding(task, {
            includeStudyPlanTaskId: canToggleRemoteTasks,
          })
        );
      }) ?? null,
    [canToggleRemoteTasks, today]
  );
  const canSkipToday =
    canToggleRemoteTasks &&
    Boolean(today) &&
    completedTasks === 0 &&
    totalTasks > 0 &&
    today!.tasks.some(
      (task) => task.status === "pending" || task.status === "in_progress"
    );
  const canAdjustPlan = Boolean(
    summaryExamDate &&
    currentStudyPlan &&
      studyPlanSetup.level &&
      studyPlanSetup.minutesPerDay !== null
  );

  async function refreshRemoteProgress() {
    if (authMode !== "supabase" || !isMobileSupabaseConfigured) {
      return;
    }

    const { readinessSummary, todayPlan } = await fetchRemoteHomeProgress(
      getWarsawIsoDate()
    );

    setRemoteReadinessSummary(readinessSummary);
    setRemoteTodayPlan(todayPlan);
  }

  function handleTaskOpen(task: RemoteTodayPlanTask) {
    const binding = createTaskSessionBinding(task, {
      includeStudyPlanTaskId: canToggleRemoteTasks,
    });

    if (!binding) {
      return;
    }

    if (isExamSimulatorMode(binding.mode)) {
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
        params: buildExamRouteParams({
          mode: binding.mode,
          questionLimit:
            binding.mode === "exam"
              ? undefined
              : getExamQuestionTarget(binding.mode, binding.questionLimit),
          studyPlanTaskId: binding.studyPlanTaskId,
        }),
      });
      return;
    }

    router.push({
      pathname: "/question",
      params: buildQuestionRouteParams(binding),
    });
  }

  async function handleTaskToggle(task: RemoteTodayPlanTask) {
    if (!canToggleRemoteTasks || updatingTaskId) {
      return;
    }

    const nextStatus = task.status === "completed" ? "pending" : "completed";

    setTaskSyncError(null);
    setUpdatingTaskId(task.id);

    try {
      await updateRemoteStudyPlanTaskStatus({
        taskId: task.id,
        status: nextStatus,
        questionCountCompleted:
          nextStatus === "completed" ? task.questionCountTarget ?? null : 0,
      });

      const { readinessSummary, todayPlan } = await fetchRemoteHomeProgress(
        getWarsawIsoDate()
      );

      setRemoteReadinessSummary(readinessSummary);
      setRemoteTodayPlan(todayPlan);
    } catch (error) {
      console.warn("Failed to update study plan task status.", error);
      setTaskSyncError(t("home.taskSyncFailed"));
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleSkipToday() {
    if (!canSkipToday || isSkippingDay) {
      return;
    }

    setIsSkippingDay(true);
    setTaskSyncError(null);

    try {
      await skipTodayPlanDayRemotely(todayIsoDate);
      await refreshRemoteProgress();

      Toast.show({
        type: "success",
        text1: t("toasts.daySkippedTitle"),
        text2: t("toasts.daySkippedSubtitle"),
      });
    } catch (error) {
      console.warn("Failed to skip today's study plan day.", error);
      setTaskSyncError(t("home.skipDayFailed"));
      Toast.show({
        type: "error",
        text1: t("toasts.daySkipFailedTitle"),
        text2: t("toasts.daySkipFailedSubtitle"),
      });
    } finally {
      setIsSkippingDay(false);
    }
  }

  return (
    <AppScreen
      title={t("tabs.homeTitle")}
      subtitle={t("tabs.homeSubtitle", {
        name: user?.fullName ?? t("common.student"),
      })}
    >
      <View style={{ gap: 12 }}>
        <AppCard accent>
          <Text style={styles.sectionLabel}>{t("home.summaryTitle")}</Text>
          <Text style={styles.summaryScore}>
            {summaryExamDate ? `${readinessScore}%` : "0%"}
          </Text>
          <Text style={styles.bodyText}>
            {summaryExamDate
              ? t("home.summaryBody", {
                  date: formatPlanDate(summaryExamDate),
                  locale: preferredLocale.toUpperCase(),
                })
              : t("home.summaryEmpty")}
          </Text>
          {missedPlanDays > 0 ? (
            <Text style={[styles.metaText, { marginTop: 8 }]}>
              {t("home.summaryMissedDays", {
                days: missedPlanDays,
              })}
            </Text>
          ) : null}
          {remoteReadinessSummary ? (
            <View style={styles.summaryMeta}>
              <Text style={styles.metaText}>
                {t("home.summaryAttempts", {
                  accuracy: remoteReadinessSummary.accuracyPercent,
                  count: remoteReadinessSummary.totalAttempts,
                })}
              </Text>
              <Text style={styles.metaText}>
                {t("home.summaryReviews", {
                  due: remoteReadinessSummary.dueReviews,
                  weak: remoteReadinessSummary.unresolvedWeakSpots,
                })}
              </Text>
              <Text style={styles.metaText}>
                {t("home.summaryPlanProgress", {
                  completed: remoteReadinessSummary.completedPlanDays,
                  days: Math.max(0, remoteReadinessSummary.daysUntilExam),
                  total: remoteReadinessSummary.totalPlanDays,
                })}
              </Text>
            </View>
          ) : null}
        </AppCard>

        <AppCard>
          <Text style={styles.sectionLabel}>{t("home.todayTasksTitle")}</Text>
          {today ? (
            <View style={styles.taskList}>
              <Text style={styles.bodyText}>
                {t("home.todayDate", {
                  date: formatPlanDate(today.planDate),
                })}
              </Text>
              <Text style={styles.metaText}>
                {t("home.todayProgress", {
                  completed: completedTasks,
                  total: totalTasks,
                })}
              </Text>
              {taskSyncError ? (
                <Text style={styles.errorText}>{taskSyncError}</Text>
              ) : null}
              {today.tasks.map((task, index) => {
                const isCompleted = task.status === "completed";
                const isTaskUpdating = updatingTaskId === task.id;
                const binding = createTaskSessionBinding(task, {
                  includeStudyPlanTaskId: canToggleRemoteTasks,
                });
                const canOpenTask = Boolean(binding);
                const taskHint = isTaskUpdating
                  ? t("home.taskSyncing")
                  : canOpenTask
                    ? t("home.taskTapToOpen")
                    : isCompleted
                      ? t("home.taskTapToReopen")
                      : t("home.taskTapToComplete");
                const taskToggleLabel = isCompleted
                  ? t("home.taskReopenAction")
                  : t("home.taskCompleteAction");
                const content = (
                  <View style={styles.taskRow}>
                    <View
                      style={[
                        styles.taskCheck,
                        isCompleted ? styles.taskCheckCompleted : null,
                      ]}
                    >
                      {isCompleted ? <View style={styles.taskCheckInner} /> : null}
                    </View>
                    <View style={styles.taskCopy}>
                      <Text
                        style={[
                          styles.taskTitle,
                          isCompleted ? styles.taskTitleCompleted : null,
                        ]}
                      >
                        {formatTodayTaskLine(task, index)}
                      </Text>
                      {task.description ? (
                        <Text style={styles.taskDescription}>{task.description}</Text>
                      ) : null}
                    </View>
                  </View>
                );

                return (
                  <View key={task.id} style={styles.taskCard}>
                    {canOpenTask ? (
                      <Pressable
                        accessibilityRole="button"
                        disabled={isTaskUpdating}
                        onPress={() => handleTaskOpen(task)}
                        style={({ pressed }) => [
                          styles.taskPressable,
                          pressed ? styles.taskPressablePressed : null,
                          isTaskUpdating ? styles.taskPressableDisabled : null,
                        ]}
                      >
                        {content}
                      </Pressable>
                    ) : (
                      <View style={styles.taskStaticBody}>{content}</View>
                    )}

                    <View style={styles.taskFooter}>
                      <Text style={styles.taskHint}>{taskHint}</Text>
                      {canToggleRemoteTasks ? (
                        <Pressable
                          accessibilityRole="button"
                          disabled={isTaskUpdating || Boolean(updatingTaskId)}
                          onPress={() => void handleTaskToggle(task)}
                          style={({ pressed }) => [
                            styles.taskStatusButton,
                            pressed ? styles.taskStatusButtonPressed : null,
                            isTaskUpdating || Boolean(updatingTaskId)
                              ? styles.taskStatusButtonDisabled
                              : null,
                          ]}
                        >
                          <Text style={styles.taskStatusButtonLabel}>
                            {taskToggleLabel}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.taskList}>
              {taskSyncError ? (
                <Text style={styles.errorText}>{taskSyncError}</Text>
              ) : null}
              <Text style={styles.bodyText}>
                {isRemoteLoading
                  ? t("home.todayTasksLoading")
                  : t("home.todayTasksEmpty")}
              </Text>
            </View>
          )}
        </AppCard>

        <View style={{ gap: 10 }}>
          <AppButton
            label={
              nextTodayTask
                ? t("home.openTodayTask")
                : hasPlan
                  ? t("home.continueLearning")
                  : t("home.openPlanPreview")
            }
            onPress={() =>
              nextTodayTask
                ? handleTaskOpen(nextTodayTask)
                : router.push(
                    hasPlan ? "/(tabs)/learn" : "/(onboarding)/preview"
                  )
            }
          />
          {canAdjustPlan ? (
            <AppButton
              variant="secondary"
              disabled={isSkippingDay}
              label={t("home.adjustPlan")}
              onPress={() =>
                router.push({
                  pathname: "/modals/plan-adjust",
                  params: {
                    missedDays: String(missedPlanDays),
                  },
                })
              }
            />
          ) : null}
          {canSkipToday ? (
            <AppButton
              variant="ghost"
              disabled={isSkippingDay}
              label={
                isSkippingDay
                  ? t("home.skipDayLoading")
                  : t("home.skipDay")
              }
              onPress={() => void handleSkipToday()}
            />
          ) : null}
          <AppButton
            variant="secondary"
            label={t("home.openPractice")}
            onPress={() => router.push("/(tabs)/practice")}
          />
          <AppButton
            variant="ghost"
            label={t("home.openAiModal")}
            onPress={() => router.push("/modals/ai-chat")}
          />
        </View>
      </View>
    </AppScreen>
  );
}

function formatTodayTaskLine(task: RemoteTodayPlanTask, index: number) {
  const targetPart =
    typeof task.questionCountTarget === "number" && task.questionCountTarget > 0
      ? ` / ${task.questionCountTarget}`
      : "";
  const progressPart =
    task.questionCountCompleted > 0 || targetPart
      ? ` (${task.questionCountCompleted}${targetPart})`
      : "";
  const minutesPart =
    typeof task.estimatedMinutes === "number" && task.estimatedMinutes > 0
      ? ` - ${task.estimatedMinutes}m`
      : "";

  return `${index + 1}. ${task.title}${progressPart}${minutesPart}`;
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    bodyText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      lineHeight: 22,
    },
    errorText: {
      color: "#A44E37",
      fontSize: 13,
      lineHeight: 20,
    },
    metaText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    sectionLabel: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 8,
    },
    summaryMeta: {
      gap: 6,
      marginTop: 10,
    },
    summaryScore: {
      color: theme.colors.textPrimary,
      fontSize: 26,
      fontWeight: "800",
      marginBottom: 6,
    },
    taskCheck: {
      alignItems: "center",
      borderColor: theme.colors.borderStrong,
      borderRadius: 10,
      borderWidth: 1,
      height: 20,
      justifyContent: "center",
      marginTop: 2,
      width: 20,
    },
    taskCheckCompleted: {
      backgroundColor: theme.colors.accentMuted,
      borderColor: theme.colors.accentMuted,
    },
    taskCard: {
      borderColor: theme.colors.borderSoft,
      borderRadius: theme.radius.large,
      borderWidth: 1,
      overflow: "hidden",
    },
    taskCheckInner: {
      backgroundColor: theme.colors.onAccent,
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    taskCopy: {
      flex: 1,
      gap: 4,
    },
    taskDescription: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 20,
    },
    taskFooter: {
      alignItems: "center",
      borderTopColor: theme.colors.borderSoft,
      borderTopWidth: 1,
      flexDirection: "row",
      gap: 10,
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    taskHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      flex: 1,
      lineHeight: 18,
    },
    taskList: {
      gap: 8,
    },
    taskPressable: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    taskPressableDisabled: {
      opacity: 0.72,
    },
    taskPressablePressed: {
      opacity: 0.86,
    },
    taskRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 12,
    },
    taskStaticBody: {
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    taskStatusButton: {
      alignItems: "center",
      backgroundColor: theme.colors.cardMuted,
      borderColor: theme.colors.borderStrong,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 34,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    taskStatusButtonDisabled: {
      opacity: 0.6,
    },
    taskStatusButtonLabel: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: "700",
    },
    taskStatusButtonPressed: {
      opacity: 0.85,
    },
    taskTitle: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      lineHeight: 22,
    },
    taskTitleCompleted: {
      textDecorationLine: "line-through",
    },
  });
