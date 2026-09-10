import { SLOVAK_QUESTION_TOPIC_IDS } from "../question-topics";
import type { CountryConfig, ExamBasketSlot } from "./types";

/**
 * Slovak category-B statutory test composition: 40 questions, 100 points.
 * Source: Decree 9/2009, Annex 8a; mirrored in sk-v2-current.exam_config.
 */
export const SLOVAK_EXAM_BASKETS: ExamBasketSlot[] = [
  { scopeId: 1, count: 8, points: 3 },
  { scopeId: 2, count: 2, points: 3 },
  { scopeId: 3, count: 8, points: 2 },
  { scopeId: 4, count: 4, points: 4 },
  { scopeId: 5, count: 1, points: 2 },
  { scopeId: 6, count: 3, points: 2 },
  { scopeId: 7, count: 2, points: 1 },
  { scopeId: 8, count: 2, points: 1 },
  { scopeId: 9, count: 8, points: 3 },
  { scopeId: 10, count: 2, points: 1 },
];

export const SK_COUNTRY_CONFIG: CountryConfig = {
  code: "SK",
  categories: ["B"],
  defaultLocale: "sk",
  exam: {
    id: "etesty",
    totalQuestions: 40,
    durationMinutes: 30,
    maxPoints: 100,
    passingPoints: 90,
    navigation: "free",
    perQuestionTimer: false,
    showWordScopes: false,
    baskets: SLOVAK_EXAM_BASKETS,
    baseQuestions: 0,
    specialistQuestions: 0,
    baseReadSeconds: 0,
    baseAnswerSeconds: 0,
    baseVideoResumeBonusSeconds: 0,
    specialistSeconds: 0,
    strictBasketComposition: true,
  },
  features: { roadSigns: true },
  mediaEnvKey: "EXPO_PUBLIC_SLOVAK_MEDIA_BASE_URL",
  questionImageResizeMode: "contain",
  questionSetKey: "sk-v2-current",
  // MV SR supports these examination languages. The imported corpus currently
  // contains Slovak only, so only it is exposed as an in-app content locale.
  officialExamLocales: ["sk", "en", "hu"],
  supportedLocales: ["sk"],
  topicIds: SLOVAK_QUESTION_TOPIC_IDS,
};
