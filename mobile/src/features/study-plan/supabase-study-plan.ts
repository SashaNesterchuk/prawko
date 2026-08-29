import type { GeneratedStudyPlan } from "@prawko/schemas";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getQuestionSetKey } from "../../countries/runtime";
import { getMobileSupabaseClient } from "../../lib/supabase";

type SaveGeneratedStudyPlanInput = {
  generationContext?: Record<string, unknown>;
  plan: GeneratedStudyPlan;
};

export async function saveGeneratedStudyPlanRemotely(
  input: SaveGeneratedStudyPlanInput
) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("save_generated_study_plan", {
    p_title: input.plan.title,
    p_current_category: input.plan.category,
    p_plan_locale: input.plan.locale,
    p_level: input.plan.level,
    p_exam_date: input.plan.examDate,
    p_days_planned: input.plan.daysPlanned,
    p_minutes_per_day: input.plan.minutesPerDay,
    p_generator_version: input.plan.generatorVersion,
    p_plan_snapshot: input.plan.days,
    p_school_code: input.plan.schoolCode ?? null,
    p_generation_context: toRpcJsonObject({
      client_plan_id: input.plan.id,
      source: "mobile_onboarding_preview",
      ...input.generationContext,
    }),
    p_question_set_key: getQuestionSetKey(),
  });

  if (error) {
    throw error;
  }

  if (typeof data !== "string" || data.trim().length === 0) {
    throw new Error("save_generated_study_plan returned an empty response.");
  }

  return data;
}

function toRpcJsonObject(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
