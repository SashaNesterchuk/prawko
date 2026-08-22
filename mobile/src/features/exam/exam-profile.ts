import { EXAM_RULES } from "@prawko/config";
import { variantRuntime } from "@app-variant";

export type ExamNavigationMode = "forward_only" | "free";

export type ExamBasketSlot = {
  count: number;
  points: number;
  scopeId: number;
};

export type ExamProfile = {
  baseAnswerSeconds: number;
  baseQuestions: number;
  baseReadSeconds: number;
  baseVideoResumeBonusSeconds: number;
  baskets: ExamBasketSlot[];
  durationMinutes: number;
  id: "word" | "etesty";
  maxPoints: number;
  navigation: ExamNavigationMode;
  passingPoints: number;
  perQuestionTimer: boolean;
  showWordScopes: boolean;
  specialistQuestions: number;
  specialistSeconds: number;
  totalQuestions: number;
};

export const WORD_EXAM_PROFILE: ExamProfile = {
  id: "word",
  totalQuestions: EXAM_RULES.totalQuestions,
  durationMinutes: EXAM_RULES.durationMinutes,
  maxPoints: EXAM_RULES.maxPoints,
  passingPoints: EXAM_RULES.passingPoints,
  navigation: "forward_only",
  perQuestionTimer: true,
  showWordScopes: true,
  baskets: [],
  baseQuestions: EXAM_RULES.baseQuestions,
  specialistQuestions: EXAM_RULES.specialistQuestions,
  baseReadSeconds: EXAM_RULES.baseReadSeconds,
  baseAnswerSeconds: EXAM_RULES.baseAnswerSeconds,
  baseVideoResumeBonusSeconds: EXAM_RULES.baseVideoResumeBonusSeconds,
  specialistSeconds: EXAM_RULES.specialistSeconds,
};

/** Official Czech B eTesty mix. Keep in sync with `cz-v2-current.exam_config.exam`. */
export const CZECH_EXAM_BASKETS: ExamBasketSlot[] = [
  { scopeId: 9, count: 10, points: 2 },
  { scopeId: 10, count: 4, points: 2 },
  { scopeId: 11, count: 3, points: 1 },
  { scopeId: 12, count: 3, points: 4 },
  { scopeId: 13, count: 2, points: 1 },
  { scopeId: 14, count: 2, points: 2 },
  { scopeId: 15, count: 1, points: 1 },
];

export const CZECH_EXAM_PROFILE: ExamProfile = {
  id: "etesty",
  totalQuestions: 25,
  durationMinutes: 30,
  maxPoints: 50,
  passingPoints: 43,
  navigation: "free",
  perQuestionTimer: false,
  showWordScopes: false,
  baskets: CZECH_EXAM_BASKETS,
  baseQuestions: 0,
  specialistQuestions: 0,
  baseReadSeconds: 0,
  baseAnswerSeconds: 0,
  baseVideoResumeBonusSeconds: 0,
  specialistSeconds: 0,
};

export function getExamProfileForVariant(
  variantId: string | null | undefined
): ExamProfile {
  return variantId === "czech" ? CZECH_EXAM_PROFILE : WORD_EXAM_PROFILE;
}

export function getExamProfile(): ExamProfile {
  return getExamProfileForVariant(variantRuntime.id);
}

export function isFreeExamNavigation(
  profile: ExamProfile = getExamProfile()
) {
  return profile.navigation === "free";
}

export function readExamFlaggedOrders(
  metadata: Record<string, unknown> | null | undefined
): number[] {
  const value = metadata?.flaggedOrders;
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value.filter(
        (entry): entry is number =>
          typeof entry === "number" && Number.isInteger(entry) && entry > 0
      )
    ),
  ].sort((left, right) => left - right);
}

export function isFreeExamSessionMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  return metadata?.navigation === "free";
}
