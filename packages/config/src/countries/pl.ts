import { EXAM_RULES } from "../exam-rules";
import { QUESTION_TOPIC_IDS } from "../question-topics";
import type { CountryConfig } from "./types";

export const PL_COUNTRY_CONFIG: CountryConfig = {
  code: "PL",
  categories: [
    "AM",
    "A1",
    "A2",
    "A",
    "B1",
    "B",
    "C1",
    "C",
    "D1",
    "D",
    "T",
  ],
  defaultLocale: "ua",
  exam: {
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
  },
  features: { roadSigns: true },
  mediaEnvKey: "EXPO_PUBLIC_MEDIA_BASE_URL",
  questionImageResizeMode: "cover",
  questionSetKey: "pl-v2-current",
  supportedLocales: ["pl", "ua", "en", "de", "es"],
  topicIds: QUESTION_TOPIC_IDS,
};
