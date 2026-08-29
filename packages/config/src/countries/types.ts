import type { DrivingCategory, SupportedLocale } from "../index";
import type { QuestionTopicId } from "../question-topics";

export const COUNTRY_CODES = ["PL", "CZ"] as const;
export type CountryCode = (typeof COUNTRY_CODES)[number];

export const DEFAULT_COUNTRY_CODE: CountryCode = "PL";
export const SUPPORTED_COUNTRY_CODES: readonly CountryCode[] = COUNTRY_CODES;

export type ExamNavigationMode = "forward_only" | "free";

export type ExamBasketSlot = {
  count: number;
  points: number;
  scopeId: number;
};

export type CountryExamConfig = {
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

export type CountryMediaEnvKey =
  | "EXPO_PUBLIC_MEDIA_BASE_URL"
  | "EXPO_PUBLIC_CZECH_MEDIA_BASE_URL";

export type CountryConfig = {
  code: CountryCode;
  categories: readonly DrivingCategory[];
  defaultLocale: SupportedLocale;
  exam: CountryExamConfig;
  features: {
    roadSigns: boolean;
  };
  mediaEnvKey: CountryMediaEnvKey;
  questionImageResizeMode: "cover" | "contain";
  questionSetKey: string;
  supportedLocales: readonly SupportedLocale[];
  topicIds: readonly QuestionTopicId[];
};

export function isCountryCode(
  value: string | null | undefined,
): value is CountryCode {
  return (
    typeof value === "string" &&
    (COUNTRY_CODES as readonly string[]).includes(value)
  );
}
