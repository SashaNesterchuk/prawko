import { CZECH_QUESTION_TOPIC_IDS } from "../question-topics";
import type { CountryConfig, ExamBasketSlot } from "./types";

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

export const CZ_COUNTRY_CONFIG: CountryConfig = {
  code: "CZ",
  categories: ["B"],
  defaultLocale: "cs",
  exam: {
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
  },
  features: { roadSigns: true },
  mediaEnvKey: "EXPO_PUBLIC_CZECH_MEDIA_BASE_URL",
  questionImageResizeMode: "contain",
  questionSetKey: "cz-v2-current",
  supportedLocales: ["cs", "en"],
  topicIds: CZECH_QUESTION_TOPIC_IDS,
};
