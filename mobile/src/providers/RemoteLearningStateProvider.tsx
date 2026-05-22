import type {
  DrivingCategory,
  PlanLevel,
  SupportedLocale,
} from "@prawko/config";
import {
  generatedStudyPlanDaySchema,
  type GeneratedStudyPlan,
  type GeneratedStudyPlanDay,
} from "@prawko/schemas";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";

import { isMobileSupabaseConfigured } from "../config/env";
import type { CaptureErrorInput } from "../features/errors/error-logging";
import { fetchRemoteQuestionUserStateMap } from "../features/questions/supabase-question-state";
import type { QuestionUserStateMap } from "../features/questions/types";
import { getMobileSupabaseClient } from "../lib/supabase";
import {
  useAppShellStore,
  useHasHydrated,
} from "../state/app-shell";
import {
  useQuestionProgressHydrated,
  useQuestionProgressStore,
} from "../state/question-progress";
import { useErrorLogger } from "./ErrorLoggingProvider";

type RemoteProfileRecord = {
  current_category: DrivingCategory;
  interface_locale: SupportedLocale;
  metadata: Record<string, unknown> | null;
  onboarding_completed: boolean;
};

type RemoteStudyPlanRecord = {
  current_category: DrivingCategory;
  days_planned: number;
  exam_date: string;
  generation_context: Record<string, unknown> | null;
  generator_version: string;
  id: string;
  level: PlanLevel;
  minutes_per_day: number;
  plan_locale: SupportedLocale;
  plan_snapshot: unknown;
  title: string;
};

export function RemoteLearningStateProvider({ children }: PropsWithChildren) {
  const appShellHydrated = useHasHydrated();
  const authMode = useAppShellStore((state) => state.authMode);
  const { captureError } = useErrorLogger();
  const hydrateRemoteProfile = useAppShellStore(
    (state) => state.hydrateRemoteProfile
  );
  const hydrateRemoteStudyPlan = useAppShellStore(
    (state) => state.hydrateRemoteStudyPlan
  );
  const questionProgressHydrated = useQuestionProgressHydrated();
  const replaceQuestionUserState = useQuestionProgressStore(
    (state) => state.replaceQuestionUserState
  );
  const sessionResolved = useAppShellStore((state) => state.sessionResolved);
  const supabaseUserId = useAppShellStore((state) => state.supabaseUser?.id ?? null);

  useEffect(() => {
    if (
      !isMobileSupabaseConfigured ||
      !appShellHydrated ||
      !questionProgressHydrated ||
      !sessionResolved ||
      authMode !== "supabase" ||
      !supabaseUserId
    ) {
      return;
    }

    const client = getMobileSupabaseClient();
    let cancelled = false;

    void (async () => {
      try {
        const { data: profileData, error: profileError } = await client
          .from("profiles")
          .select(
            "onboarding_completed, current_category, interface_locale, metadata"
          )
          .maybeSingle();

        if (cancelled || profileError || !profileData) {
          if (profileError) {
            console.warn("Failed to fetch remote profile state.", profileError);
            captureError({
              area: "learning_state",
              error: profileError,
              eventName: "remote_profile_fetch_failed",
              message: "Failed to fetch the remote profile state.",
              metadata: {
                user_id: supabaseUserId,
              },
            });
          } else if (!profileData) {
            captureError({
              area: "learning_state",
              eventName: "remote_profile_fetch_failed",
              message: "Authenticated user is missing a remote profile row.",
              metadata: {
                reason: "missing_profile_row",
                user_id: supabaseUserId,
              },
              severity: "warning",
            });
          }
          return;
        }

        const profile = ((profileData as unknown) as RemoteProfileRecord);

        hydrateRemoteProfile({
          onboardingCompleted: profile.onboarding_completed,
          preferredCategory: profile.current_category,
          preferredLocale: profile.interface_locale,
        });

        if (profile.onboarding_completed) {
          void hydrateStudyPlan(
            client,
            profile,
            hydrateRemoteStudyPlan,
            () => cancelled,
            captureError,
            supabaseUserId
          );
        }

        void hydrateQuestionState(
          replaceQuestionUserState,
          () => cancelled,
          captureError,
          supabaseUserId
        );
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to hydrate remote learning state.", error);
          captureError({
            area: "learning_state",
            error,
            eventName: "remote_profile_fetch_failed",
            message: "Failed to hydrate the remote learning state.",
            metadata: {
              user_id: supabaseUserId,
            },
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    appShellHydrated,
    authMode,
    captureError,
    hydrateRemoteProfile,
    hydrateRemoteStudyPlan,
    questionProgressHydrated,
    replaceQuestionUserState,
    sessionResolved,
    supabaseUserId,
  ]);

  return children;
}

async function hydrateStudyPlan(
  client: ReturnType<typeof getMobileSupabaseClient>,
  profile: RemoteProfileRecord,
  hydrateRemoteStudyPlan: (payload: {
    plan: GeneratedStudyPlan | null;
    remoteId: string | null;
  }) => void,
  isCancelled: () => boolean,
  captureError: (input: CaptureErrorInput) => void,
  userId: string
) {
  try {
    const latestStudyPlanId = getLatestStudyPlanId(profile.metadata);
    const studyPlanQuery = client
      .from("study_plans")
      .select(
        [
          "id",
          "title",
          "current_category",
          "plan_locale",
          "level",
          "exam_date",
          "days_planned",
          "minutes_per_day",
          "generator_version",
          "generation_context",
          "plan_snapshot",
        ].join(", ")
      )
      .order("created_at", { ascending: false })
      .limit(1);

    const { data: studyPlanData, error: studyPlanError } = latestStudyPlanId
      ? await studyPlanQuery.eq("id", latestStudyPlanId).maybeSingle()
      : await studyPlanQuery
          .in("status", ["draft", "active", "paused"])
          .maybeSingle();

    if (isCancelled() || studyPlanError) {
      if (studyPlanError) {
        console.warn("Failed to fetch remote study plan.", studyPlanError);
        captureError({
          area: "learning_state",
          error: studyPlanError,
          eventName: "remote_study_plan_fetch_failed",
          message: "Failed to fetch the remote study plan.",
          metadata: {
            latest_study_plan_id: latestStudyPlanId,
            user_id: userId,
          },
        });
      }
      return;
    }

    if (!studyPlanData) {
      hydrateRemoteStudyPlan({
        plan: null,
        remoteId: null,
      });
      return;
    }

    const studyPlanRecord = (studyPlanData as unknown) as RemoteStudyPlanRecord;

    hydrateRemoteStudyPlan({
      plan: mapRemoteStudyPlanRecordToGeneratedStudyPlan(studyPlanRecord),
      remoteId: studyPlanRecord.id,
    });
  } catch (error) {
    if (!isCancelled()) {
      console.warn("Failed to hydrate remote study plan.", error);
      captureError({
        area: "learning_state",
        error,
        eventName: "remote_study_plan_fetch_failed",
        message: "Study plan hydration threw before completion.",
        metadata: {
          user_id: userId,
        },
      });
    }
  }
}

async function hydrateQuestionState(
  replaceQuestionUserState: (questionUserState: QuestionUserStateMap) => void,
  isCancelled: () => boolean,
  captureError: (input: CaptureErrorInput) => void,
  userId: string
) {
  try {
    const questionUserState = await fetchRemoteQuestionUserStateMap();

    if (isCancelled()) {
      return;
    }

    replaceQuestionUserState(questionUserState);
  } catch (error) {
    if (!isCancelled()) {
      console.warn("Failed to fetch remote question state.", error);
      captureError({
        area: "learning_state",
        error,
        eventName: "remote_question_state_fetch_failed",
        message: "Failed to fetch the remote question state map.",
        metadata: {
          user_id: userId,
        },
      });
    }
  }
}

function mapRemoteStudyPlanRecordToGeneratedStudyPlan(
  record: RemoteStudyPlanRecord
): GeneratedStudyPlan {
  const days = generatedStudyPlanDaySchema.array().parse(
    record.plan_snapshot ?? []
  ) as GeneratedStudyPlanDay[];

  return {
    id: record.id,
    title: record.title,
    locale: record.plan_locale,
    category: record.current_category,
    level: record.level,
    examDate: record.exam_date,
    daysPlanned: record.days_planned,
    minutesPerDay: record.minutes_per_day,
    schoolCode: getOptionalString(record.generation_context?.school_code),
    generatorVersion: record.generator_version,
    summary: buildStudyPlanSummary(days),
    days,
  };
}

function buildStudyPlanSummary(days: GeneratedStudyPlanDay[]) {
  return {
    minimumModeDays: days.filter((day) => day.minimumMode).length,
    fullExamDays: countTasks(days, "full_exam"),
    miniTestDays: countTasks(days, "mini_test"),
    weakSpotDays: countTasks(days, "review_weak_spots"),
  };
}

function countTasks(days: GeneratedStudyPlanDay[], taskType: string) {
  return days.reduce(
    (total, day) =>
      total +
      day.tasks.filter((task) => task.taskType === taskType).length,
    0
  );
}

function getLatestStudyPlanId(metadata: Record<string, unknown> | null) {
  const latestStudyPlanId = metadata?.latest_study_plan_id;

  return typeof latestStudyPlanId === "string" && latestStudyPlanId.trim()
    ? latestStudyPlanId
    : null;
}

function getOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}
