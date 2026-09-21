import type {
  CountryCode,
  QuestionSessionMode,
  QuestionTopicId,
} from "@prawko/config";

import {
  getQuestionSessionSummary,
  isQuestionSessionExpired,
} from "../questions/question-engine";
import type {
  QuestionSession,
  QuestionSessionRequest,
} from "../questions/types";

import {
  getHomeDailyPracticeStatus,
  getHomeDailyRemainingCount,
} from "./home-daily-practice";

export const HOME_CONTEXTUAL_COMPLETION_TTL_MS = 30 * 60 * 1000;
export const HOME_CONTEXTUAL_SECONDS_PER_QUESTION = 30;
export const HOME_CONTEXTUAL_MISTAKES_LIMIT = 10;
export const HOME_CONTEXTUAL_REVIEW_LIMIT = 10;
export const HOME_CONTEXTUAL_WEAK_TOPIC_LIMIT = 6;
export const HOME_CONTEXTUAL_WEAK_TOPIC_MAX_PROGRESS = 84;

export type HomeCompletionKind =
  | "training"
  | "exam"
  | "review"
  | "mistakes"
  | "weak_spot";

export type HomeNextActionKind =
  | "resume"
  | "mistakes"
  | "review"
  | "weak_topic";

export type HomeContextualKind = "completion" | HomeNextActionKind;

export type HomeCompletionEvent = {
  id: string;
  kind: HomeCompletionKind;
  mode: QuestionSessionMode;
  completedAt: number;
  shownOnHome: boolean;
  examCountry: string;
  answeredCount: number;
  totalCount: number;
  readinessDelta: number | null;
  topicId: string | null;
};

export type HomeResumeSession = {
  answered: number;
  remaining: number;
  request: QuestionSessionRequest;
  source: "active" | "home_daily";
  total: number;
};

export type HomeWeakTopic = {
  progress: number;
  remaining: number;
  topicId: QuestionTopicId;
};

export type HomeWeakTopicCandidate = HomeWeakTopic & {
  seen: number;
};

export type HomeContextualResolution =
  | { type: "none" }
  | {
      type: "completion";
      event: HomeCompletionEvent;
    }
  | {
      count?: number;
      kind: HomeNextActionKind;
      resume?: HomeResumeSession;
      type: "next_action";
      weakTopic?: HomeWeakTopic;
    };

const EXCLUDED_COMPLETION_MODES: ReadonlySet<QuestionSessionMode> = new Set([
  "initial_diagnostic",
]);

export function getCompletionKindForMode(
  mode: QuestionSessionMode,
  topicId?: string | null
): HomeCompletionKind | null {
  if (EXCLUDED_COMPLETION_MODES.has(mode)) {
    return null;
  }

  if (mode === "exam") {
    return "exam";
  }

  if (mode === "wrong_answers") {
    return "mistakes";
  }

  if (mode === "review_due") {
    return "review";
  }

  if (mode === "weak_spots" || mode === "hard_questions") {
    return "weak_spot";
  }

  if (mode === "learning" && topicId) {
    return "weak_spot";
  }

  return "training";
}

export function estimateSessionMinutes(questionCount: number) {
  const count = Math.max(0, Math.floor(questionCount));
  if (count <= 0) {
    return 0;
  }

  return Math.max(
    1,
    Math.round((count * HOME_CONTEXTUAL_SECONDS_PER_QUESTION) / 60)
  );
}

export function isMeaningfulCompletion(event: Pick<
  HomeCompletionEvent,
  "answeredCount" | "totalCount"
>) {
  return event.answeredCount > 0 && event.totalCount > 0;
}

export function isFreshHomeCompletion(input: {
  event: HomeCompletionEvent | null | undefined;
  examCountry: CountryCode | string | null;
  now?: number;
}) {
  const event = input.event;
  if (!event || event.shownOnHome || !isMeaningfulCompletion(event)) {
    return false;
  }

  if (input.examCountry && event.examCountry !== input.examCountry) {
    return false;
  }

  const now = input.now ?? Date.now();
  return now - event.completedAt <= HOME_CONTEXTUAL_COMPLETION_TTL_MS;
}

export function getResumableHomeSession(input: {
  activeSession: QuestionSession | null | undefined;
  category: string;
  homeDailySession: QuestionSession | null | undefined;
  now?: Date;
  today: string;
}): HomeResumeSession | null {
  const now = input.now ?? new Date();
  const active = toResumeSession(input.activeSession, "active", now);
  if (active) {
    return active;
  }

  const dailyStatus = getHomeDailyPracticeStatus({
    session: input.homeDailySession,
    today: input.today,
    category: input.category,
  });

  if (dailyStatus !== "in_progress") {
    return null;
  }

  return toResumeSession(input.homeDailySession, "home_daily", now);
}

function toResumeSession(
  session: QuestionSession | null | undefined,
  source: HomeResumeSession["source"],
  now: Date
): HomeResumeSession | null {
  if (
    !session ||
    session.finishedAt ||
    session.emptyReason ||
    session.request.mode === "exam" ||
    isQuestionSessionExpired(session, now)
  ) {
    return null;
  }

  const summary = getQuestionSessionSummary(session);
  const remaining =
    source === "home_daily"
      ? getHomeDailyRemainingCount(session)
      : session.questionIds.filter((questionId) => session.answers[questionId] == null)
          .length;

  if (summary.answered <= 0 || remaining <= 0) {
    return null;
  }

  return {
    answered: summary.answered,
    remaining,
    request: session.request,
    source,
    total: summary.total,
  };
}

export function pickWeakestOpenTopic(
  topics: readonly HomeWeakTopicCandidate[]
): HomeWeakTopic | null {
  const open = topics.filter(
    (topic) =>
      topic.seen > 0 &&
      topic.remaining > 0 &&
      topic.progress <= HOME_CONTEXTUAL_WEAK_TOPIC_MAX_PROGRESS
  );

  if (open.length === 0) {
    return null;
  }

  const [weakest] = [...open].sort(
    (left, right) =>
      left.progress - right.progress || right.remaining - left.remaining
  );

  return {
    progress: weakest.progress,
    remaining: weakest.remaining,
    topicId: weakest.topicId,
  };
}

export function resolveHomeContextualBlock(input: {
  examCountry: CountryCode | string | null;
  hasHigherPriorityFlow?: boolean;
  isNewUser: boolean;
  now?: number;
  pendingCompletion: HomeCompletionEvent | null;
  resumeSession: HomeResumeSession | null;
  reviewDue: number;
  keepCompletionVisible?: boolean;
  weakTopic: HomeWeakTopic | null;
  wrongAnswers: number;
}): HomeContextualResolution {
  if (input.isNewUser) {
    return { type: "none" };
  }

  const completionIsLive =
    input.keepCompletionVisible &&
    input.pendingCompletion != null &&
    isMeaningfulCompletion(input.pendingCompletion);

  const completionIsPending = isFreshHomeCompletion({
    event: input.pendingCompletion,
    examCountry: input.examCountry,
    now: input.now,
  });

  if (
    input.pendingCompletion &&
    !input.hasHigherPriorityFlow &&
    (completionIsPending || completionIsLive)
  ) {
    return {
      type: "completion",
      event: input.pendingCompletion,
    };
  }

  if (input.resumeSession) {
    return {
      type: "next_action",
      kind: "resume",
      resume: input.resumeSession,
    };
  }

  if (input.wrongAnswers > 0) {
    return {
      type: "next_action",
      kind: "mistakes",
      count: input.wrongAnswers,
    };
  }

  if (input.reviewDue > 0) {
    return {
      type: "next_action",
      kind: "review",
      count: input.reviewDue,
    };
  }

  if (input.weakTopic) {
    return {
      type: "next_action",
      kind: "weak_topic",
      weakTopic: input.weakTopic,
    };
  }

  return { type: "none" };
}

export const HOME_CONTEXTUAL_DEBUG_PREVIEWS = [
  "auto",
  "resume",
  "mistakes",
  "review",
  "weak_topic",
  "completion_mistakes",
  "completion_training",
  "completion_review",
  "hidden",
] as const;

export type HomeContextualDebugPreview =
  (typeof HOME_CONTEXTUAL_DEBUG_PREVIEWS)[number];

const DEBUG_PREVIEW_LABELS: Record<HomeContextualDebugPreview, string> = {
  auto: "auto",
  resume: "resume",
  mistakes: "mistakes",
  review: "review",
  weak_topic: "weak",
  completion_mistakes: "done ✓",
  completion_training: "session ✓",
  completion_review: "reviewed ✓",
  hidden: "hidden",
};

export function getHomeContextualDebugPreviewLabel(
  preview: HomeContextualDebugPreview
) {
  return `DEV card: ${DEBUG_PREVIEW_LABELS[preview]}`;
}

export function cycleHomeContextualDebugPreview(
  current: HomeContextualDebugPreview
): HomeContextualDebugPreview {
  const currentIndex = HOME_CONTEXTUAL_DEBUG_PREVIEWS.indexOf(current);
  const nextIndex =
    (Math.max(0, currentIndex) + 1) % HOME_CONTEXTUAL_DEBUG_PREVIEWS.length;

  return HOME_CONTEXTUAL_DEBUG_PREVIEWS[nextIndex];
}

export function buildDebugHomeContextualResolution(input: {
  examCountry: CountryCode | string | null;
  preview: HomeContextualDebugPreview;
  topicId: QuestionTopicId;
}): HomeContextualResolution {
  const examCountry = input.examCountry ?? "PL";
  const completedAt = Date.now();

  switch (input.preview) {
    case "auto":
      return { type: "none" };
    case "hidden":
      return { type: "none" };
    case "resume":
      return {
        type: "next_action",
        kind: "resume",
        resume: {
          answered: 12,
          remaining: 8,
          request: {
            currentCategory: "B",
            mode: "learning",
            questionLimit: 20,
            sessionKey: "debug-home-contextual-resume",
          },
          source: "active",
          total: 20,
        },
      };
    case "mistakes":
      return { type: "next_action", kind: "mistakes", count: 5 };
    case "review":
      return { type: "next_action", kind: "review", count: 8 };
    case "weak_topic":
      return {
        type: "next_action",
        kind: "weak_topic",
        weakTopic: {
          progress: 18,
          remaining: 6,
          topicId: input.topicId,
        },
      };
    case "completion_mistakes":
      return {
        type: "completion",
        event: {
          answeredCount: 5,
          completedAt,
          examCountry,
          id: "debug-home-contextual-completion-mistakes",
          kind: "mistakes",
          mode: "wrong_answers",
          readinessDelta: 2,
          shownOnHome: false,
          topicId: null,
          totalCount: 5,
        },
      };
    case "completion_training":
      return {
        type: "completion",
        event: {
          answeredCount: 12,
          completedAt,
          examCountry,
          id: "debug-home-contextual-completion-training",
          kind: "training",
          mode: "learning",
          readinessDelta: null,
          shownOnHome: false,
          topicId: null,
          totalCount: 12,
        },
      };
    case "completion_review":
      return {
        type: "completion",
        event: {
          answeredCount: 6,
          completedAt,
          examCountry,
          id: "debug-home-contextual-completion-review",
          kind: "review",
          mode: "review_due",
          readinessDelta: null,
          shownOnHome: false,
          topicId: input.topicId,
          totalCount: 6,
        },
      };
  }
}
