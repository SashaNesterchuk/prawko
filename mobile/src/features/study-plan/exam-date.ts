import type { GeneratedStudyPlan } from "@prawko/schemas";

import { isMobileSupabaseConfigured } from "../../config/env";
import {
  generateAdjustedStudyPlan,
  getDaysUntilExamFromDate,
} from "./generate-local-study-plan";
import { saveGeneratedStudyPlanRemotely } from "./supabase-study-plan";

export function toIsoDate(date: Date) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseNullableIsoDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  return new Date(year, month - 1, day);
}

type ApplyExamDateChangeInput = {
  authMode: "mock" | "supabase";
  currentStudyPlan: GeneratedStudyPlan | null;
  currentStudyPlanRemoteId: string | null;
  examDate: string;
  hydrateRemoteStudyPlan: (payload: {
    plan: GeneratedStudyPlan;
    remoteId: string | null;
  }) => void;
  preferredCategory: GeneratedStudyPlan["category"];
  preferredLocale: GeneratedStudyPlan["locale"];
  patchExamDate: (payload: {
    daysUntilExam: number;
    examDate: string | null;
  }) => void;
  schoolCode: string;
};

/**
 * Profile / statistics date pick: rebuild active plan when present,
 * otherwise only store the date in study-plan setup.
 */
export async function applyExamDateChange(
  input: ApplyExamDateChangeInput
): Promise<void> {
  const {
    authMode,
    currentStudyPlan,
    currentStudyPlanRemoteId,
    examDate,
    hydrateRemoteStudyPlan,
    preferredCategory,
    preferredLocale,
    patchExamDate,
    schoolCode,
  } = input;

  const daysUntilExam = Math.max(1, getDaysUntilExamFromDate(examDate));

  if (!currentStudyPlan?.level) {
    patchExamDate({ daysUntilExam, examDate });
    return;
  }

  const nextPlan = generateAdjustedStudyPlan({
    category: currentStudyPlan.category ?? preferredCategory,
    examDate,
    level: currentStudyPlan.level,
    locale: currentStudyPlan.locale ?? preferredLocale,
    minutesPerDay: currentStudyPlan.minutesPerDay,
    schoolCode: schoolCode || currentStudyPlan.schoolCode,
  });

  let nextRemoteId: string | null = null;

  if (authMode === "supabase" && isMobileSupabaseConfigured) {
    nextRemoteId = await saveGeneratedStudyPlanRemotely({
      plan: nextPlan,
      generationContext: {
        days_until_exam: daysUntilExam,
        from_exam_date: currentStudyPlan.examDate,
        from_minutes_per_day: currentStudyPlan.minutesPerDay,
        generated_at: new Date().toISOString(),
        previous_plan_id: currentStudyPlanRemoteId,
        reason: "exam_date_change",
        source: "mobile_exam_date_calendar",
        to_exam_date: examDate,
        to_minutes_per_day: currentStudyPlan.minutesPerDay,
      },
    });
  }

  hydrateRemoteStudyPlan({
    plan: nextPlan,
    remoteId: nextRemoteId,
  });
}
