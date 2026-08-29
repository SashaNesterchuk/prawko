import type { QuestionTopicId, StudyPlanTaskType } from "@prawko/config";
import { isQuestionTopicId } from "@prawko/config";
import type {
  GeneratedStudyPlan,
  GeneratedStudyPlanDay,
} from "@prawko/schemas";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getQuestionSetKey } from "../../countries/runtime";
import type {
  ExamSimulatorMode,
  RemoteExamSessionStatus,
} from "../exam/types";
import { getMobileSupabaseClient } from "../../lib/supabase";

type RemoteTodayPlanRow = {
  day_number: number | string;
  day_status: StudyPlanDayStatus;
  description: string | null;
  estimated_minutes: number | string | null;
  plan_date: string;
  question_count_completed: number | string | null;
  question_count_target: number | string | null;
  sort_order: number | string;
  study_plan_day_id: string;
  study_plan_id: string;
  task_id: string;
  task_status: StudyPlanTaskStatus;
  task_type: StudyPlanTaskType;
  title: string;
  topic_block: string | null;
};

type RemoteReadinessSummaryRow = {
  accuracy_component: number | string;
  accuracy_percent: number | string;
  active_plan_status: StudyPlanStatus;
  active_study_plan_id: string;
  completed_plan_days: number | string;
  days_until_exam: number | string;
  due_reviews: number | string;
  exam_date: string;
  plan_completion_percent: number | string;
  plan_component: number | string;
  recent_exam_component: number | string;
  recent_exam_finished_at: string | null;
  recent_exam_mode: ExamSimulatorMode | null;
  recent_exam_score_percent: number | string | null;
  recent_exam_status: RemoteExamSessionStatus | null;
  readiness_score: number | string;
  review_hygiene_component: number | string;
  total_attempts: number | string;
  total_plan_days: number | string;
  unresolved_weak_spots: number | string;
  weak_spot_component: number | string;
};

export type StudyPlanStatus =
  | "draft"
  | "active"
  | "paused"
  | "completed"
  | "abandoned";

export type StudyPlanDayStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "replanned";

export type StudyPlanTaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "canceled";

export type RemoteTodayPlanTask = {
  description: string | null;
  estimatedMinutes: number | null;
  id: string;
  questionCountCompleted: number;
  questionCountTarget: number | null;
  sortOrder: number;
  status: StudyPlanTaskStatus;
  title: string;
  topicBlock: QuestionTopicId | null;
  taskType: StudyPlanTaskType;
};

export type RemoteTodayPlan = {
  dayNumber: number;
  dayStatus: StudyPlanDayStatus;
  planDate: string;
  studyPlanDayId: string;
  studyPlanId: string;
  tasks: RemoteTodayPlanTask[];
};

export type RemoteReadinessSummary = {
  accuracyComponent: number;
  accuracyPercent: number;
  activePlanStatus: StudyPlanStatus;
  activeStudyPlanId: string;
  completedPlanDays: number;
  daysUntilExam: number;
  dueReviews: number;
  examDate: string;
  planCompletionPercent: number;
  planComponent: number;
  recentExamComponent: number;
  recentExamFinishedAt: string | null;
  recentExamMode: ExamSimulatorMode | null;
  recentExamScorePercent: number | null;
  recentExamStatus: RemoteExamSessionStatus | null;
  readinessScore: number;
  reviewHygieneComponent: number;
  totalAttempts: number;
  totalPlanDays: number;
  unresolvedWeakSpots: number;
  weakSpotComponent: number;
};

type UpdateStudyPlanTaskStatusInput = {
  questionCountCompleted?: number | null;
  status: StudyPlanTaskStatus;
  taskId: string;
};

export async function fetchRemoteTodayPlan(
  planDate: string = getWarsawIsoDate()
) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("get_today_plan", {
    p_plan_date: planDate,
    p_question_set_key: getQuestionSetKey(),
  });

  if (error) {
    throw error;
  }

  return mapTodayPlanRows(
    ((data ?? []) as unknown) as RemoteTodayPlanRow[]
  );
}

export async function fetchRemoteHomeProgress(
  planDate: string = getWarsawIsoDate()
) {
  const [readinessResult, todayPlanResult] = await Promise.allSettled([
    fetchRemoteReadinessSummary(),
    fetchRemoteTodayPlan(planDate),
  ]);

  if (readinessResult.status === "rejected") {
    throw readinessResult.reason;
  }

  if (todayPlanResult.status === "rejected") {
    console.warn("Failed to fetch today's study plan.", todayPlanResult.reason);
  }

  return {
    readinessSummary: readinessResult.value,
    todayPlan:
      todayPlanResult.status === "fulfilled" ? todayPlanResult.value : null,
  };
}

export async function fetchRemoteReadinessSummary() {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("get_readiness_summary", {
    p_question_set_key: getQuestionSetKey(),
  });

  if (error) {
    throw error;
  }

  const row = (((data ?? []) as unknown) as RemoteReadinessSummaryRow[])[0];

  if (!row) {
    return null;
  }

  return {
    accuracyComponent: toNumber(row.accuracy_component),
    accuracyPercent: toNumber(row.accuracy_percent),
    activePlanStatus: row.active_plan_status,
    activeStudyPlanId: row.active_study_plan_id,
    completedPlanDays: toNumber(row.completed_plan_days),
    daysUntilExam: toNumber(row.days_until_exam),
    dueReviews: toNumber(row.due_reviews),
    examDate: row.exam_date,
    planCompletionPercent: toNumber(row.plan_completion_percent),
    planComponent: toNumber(row.plan_component),
    recentExamComponent: toNumber(row.recent_exam_component),
    recentExamFinishedAt: row.recent_exam_finished_at,
    recentExamMode: row.recent_exam_mode,
    recentExamScorePercent:
      row.recent_exam_score_percent === null
        ? null
        : toNumber(row.recent_exam_score_percent),
    recentExamStatus: row.recent_exam_status,
    readinessScore: toNumber(row.readiness_score),
    reviewHygieneComponent: toNumber(row.review_hygiene_component),
    totalAttempts: toNumber(row.total_attempts),
    totalPlanDays: toNumber(row.total_plan_days),
    unresolvedWeakSpots: toNumber(row.unresolved_weak_spots),
    weakSpotComponent: toNumber(row.weak_spot_component),
  } satisfies RemoteReadinessSummary;
}

export async function updateRemoteStudyPlanTaskStatus(
  input: UpdateStudyPlanTaskStatusInput
) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { error } = await client.rpc("set_study_plan_task_status", {
    p_task_id: input.taskId,
    p_status: input.status,
    p_question_count_completed: input.questionCountCompleted ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function skipTodayPlanDayRemotely(
  planDate: string = getWarsawIsoDate()
) {
  if (!isMobileSupabaseConfigured) {
    throw new Error(
      "Mobile Supabase env is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  const client = getMobileSupabaseClient();
  const { data, error } = await client.rpc("skip_today_plan_day", {
    p_plan_date: planDate,
    p_question_set_key: getQuestionSetKey(),
  });

  if (error) {
    throw error;
  }

  if (typeof data !== "string" || data.trim().length === 0) {
    throw new Error("skip_today_plan_day returned an empty response.");
  }

  return data;
}

/** Building an Intl formatter is slow, and this runs once per stored attempt. */
let warsawIsoDateFormatter: Intl.DateTimeFormat | null = null;

export function getWarsawIsoDate(date: Date = new Date()) {
  warsawIsoDateFormatter ??= new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Warsaw",
    year: "numeric",
  });

  const parts = warsawIsoDateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Failed to format Warsaw date.");
  }

  return `${year}-${month}-${day}`;
}

export function buildLocalTodayPlan(
  studyPlan: GeneratedStudyPlan | null,
  planDate: string = getWarsawIsoDate()
) {
  if (!studyPlan) {
    return null;
  }

  const day = resolveLocalStudyPlanDay(studyPlan.days, planDate);

  if (!day) {
    return null;
  }

  return {
    dayNumber: day.dayNumber,
    dayStatus: day.minimumMode ? "in_progress" : "pending",
    planDate,
    studyPlanDayId: day.id,
    studyPlanId: studyPlan.id,
    tasks: day.tasks.map((task, index) => ({
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
}

function resolveLocalStudyPlanDay(
  days: GeneratedStudyPlanDay[],
  planDate: string
) {
  const exactDay = days.find((day) => day.planDate === planDate);

  if (exactDay) {
    return exactDay;
  }

  const sortedDays = [...days].sort((left, right) =>
    left.planDate.localeCompare(right.planDate)
  );

  return (
    sortedDays.find((day) => day.planDate > planDate) ??
    sortedDays[sortedDays.length - 1] ??
    null
  );
}

function mapTodayPlanRows(rows: RemoteTodayPlanRow[]) {
  const firstRow = rows[0];

  if (!firstRow) {
    return null;
  }

  const activeStudyPlanId = firstRow.study_plan_id;
  const activeStudyPlanDayId = firstRow.study_plan_day_id;
  const taskRows = rows.filter(
    (row) =>
      row.study_plan_id === activeStudyPlanId &&
      row.study_plan_day_id === activeStudyPlanDayId
  );

  return {
    dayNumber: toNumber(firstRow.day_number),
    dayStatus: firstRow.day_status,
    planDate: firstRow.plan_date,
    studyPlanDayId: firstRow.study_plan_day_id,
    studyPlanId: firstRow.study_plan_id,
    tasks: taskRows
      .map((row) => ({
        description: row.description,
        estimatedMinutes:
          row.estimated_minutes === null ? null : toNumber(row.estimated_minutes),
        id: row.task_id,
        questionCountCompleted:
          row.question_count_completed === null
            ? 0
            : toNumber(row.question_count_completed),
        questionCountTarget:
          row.question_count_target === null
            ? null
            : toNumber(row.question_count_target),
        sortOrder: toNumber(row.sort_order),
        status: row.task_status,
        title: row.title,
        topicBlock:
          row.topic_block && isQuestionTopicId(row.topic_block)
            ? row.topic_block
            : null,
        taskType: row.task_type,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder),
  } satisfies RemoteTodayPlan;
}

function toNumber(value: number | string) {
  const normalized =
    typeof value === "number" ? value : Number.parseFloat(value);

  return Number.isFinite(normalized) ? normalized : 0;
}
