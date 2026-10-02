import { router } from "expo-router";

import { buildExamRouteParams } from "../../exam/exam-routes";
import { isExamEntry } from "../../exam/exam-entry";

export const PAYWALL_SOURCES = [
  "training_limit",
  "wrong_answers",
  "explanation",
  "exam_limit",
  "weak_spots",
  "smart_reviews",
  "trap_questions",
  "statistics",
  "profile",
  "roadmap",
  "ai_chat",
  "offline_mode",
] as const;

export type PaywallSource = (typeof PAYWALL_SOURCES)[number];

/** Splits paywall sources that several screens share, especially `roadmap`. */
export const PREMIUM_GATE_SURFACES = [
  "home_step",
  "home_unlock",
  "learn_topic",
  "topics",
  "statistics_topic",
  "trainer_modes",
  "question_start",
  "profile_offline_row",
  "offline_gate",
] as const;

export type PremiumGateSurface = (typeof PREMIUM_GATE_SURFACES)[number];

export type PaywallRouteContext = {
  accessBlockId?: string;
  examSessionId?: string;
  premiumGateId?: string;
  questionId?: string;
  sourceScreen?: string;
  topicId?: string;
  trainingSessionId?: string;
};

export type PostPurchaseAction =
  | { type: "NONE" }
  | { type: "START_TRAINING"; mode: string; topic?: string; topics?: string; questionLimit?: number }
  | { type: "START_WRONG_ANSWERS" }
  | { type: "START_EXAM"; entry?: string; roadmapStepId?: string }
  | { type: "OPEN_EXPLANATION"; questionId: string }
  | { type: "OPEN_STATISTICS_SECTION"; section: string };

export function encodePostPurchaseAction(action: PostPurchaseAction | null | undefined) {
  if (!action || action.type === "NONE") {
    return undefined;
  }

  return JSON.stringify(action);
}

export function decodePostPurchaseAction(
  value: string | null | undefined
): PostPurchaseAction {
  if (!value) {
    return { type: "NONE" };
  }

  try {
    const parsed = JSON.parse(value) as PostPurchaseAction;

    if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
      return parsed;
    }
  } catch {
    return { type: "NONE" };
  }

  return { type: "NONE" };
}

export function buildPaywallHref(input: {
  roadmapStepId?: string;
  source: PaywallSource;
  surface?: PremiumGateSurface;
  postPurchaseAction?: PostPurchaseAction;
} & PaywallRouteContext) {
  return {
    pathname: "/paywall" as const,
    params: {
      feature: "premium_access",
      source: input.source,
      ...(input.surface ? { surface: input.surface } : {}),
      ...(input.roadmapStepId ? { roadmapStepId: input.roadmapStepId } : {}),
      ...(input.questionId ? { questionId: input.questionId } : {}),
      ...(input.topicId ? { topicId: input.topicId } : {}),
      ...(input.trainingSessionId ? { trainingSessionId: input.trainingSessionId } : {}),
      ...(input.examSessionId ? { examSessionId: input.examSessionId } : {}),
      ...(input.premiumGateId ? { premiumGateId: input.premiumGateId } : {}),
      ...(input.accessBlockId ? { accessBlockId: input.accessBlockId } : {}),
      ...(input.sourceScreen ? { sourceScreen: input.sourceScreen } : {}),
      ...(encodePostPurchaseAction(input.postPurchaseAction)
        ? { postPurchase: encodePostPurchaseAction(input.postPurchaseAction) }
        : {}),
    },
  };
}

export function openPaywall(input: {
  replace?: boolean;
  roadmapStepId?: string;
  source: PaywallSource;
  surface?: PremiumGateSurface;
  postPurchaseAction?: PostPurchaseAction;
} & PaywallRouteContext) {
  const navigate = input.replace ? router.replace : router.push;
  navigate(buildPaywallHref(input));
}

export function runPostPurchaseAction(action: PostPurchaseAction) {
  switch (action.type) {
    case "START_EXAM":
      router.replace({
        pathname: "/exam",
        params: buildExamRouteParams({
          entry: isExamEntry(action.entry) ? action.entry : "paywall",
          mode: "exam",
          roadmapStepId: action.roadmapStepId,
        }),
      });
      return true;
    case "START_WRONG_ANSWERS":
      router.replace({
        pathname: "/question",
        params: { mode: "wrong_answers" },
      });
      return true;
    case "START_TRAINING":
      router.replace({
        pathname: "/question",
        params: {
          mode: action.mode,
          ...(action.topic ? { topic: action.topic } : {}),
          ...(action.topics ? { topics: action.topics } : {}),
          ...(action.questionLimit != null
            ? { questionLimit: String(action.questionLimit) }
            : {}),
        },
      });
      return true;
    case "OPEN_EXPLANATION":
      router.back();
      return true;
    case "OPEN_STATISTICS_SECTION":
      router.replace("/statistics");
      return true;
    case "NONE":
      return false;
    default:
      return false;
  }
}
