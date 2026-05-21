import type {
  QuestionAnswerType,
  QuestionMediaType,
  QuestionScope,
  QuestionSessionMode,
  SupportedLocale,
  TopicBlockId,
} from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";

export type QuestionOptionValue = "A" | "B" | "C" | "true" | "false";
export type QuestionMediaAnswerSlot = "A" | "B" | "C";

export type LocalizedQuestionText = Record<SupportedLocale, string>;

export type QuestionChoice = {
  id: QuestionOptionValue;
  text: LocalizedQuestionText;
};

export type QuestionMedia = {
  type: Exclude<QuestionMediaType, "none">;
  asset: QuestionDeliveryAsset;
  pjm?: {
    questionAsset?: QuestionDeliveryAsset | null;
    answerAssets?: Partial<
      Record<QuestionMediaAnswerSlot, QuestionDeliveryAsset>
    > | null;
  } | null;
};

export type LocalQuestion = {
  id: string;
  sourceRowNumber: number;
  prompt: LocalizedQuestionText;
  explanation: LocalizedQuestionText;
  answerType: QuestionAnswerType;
  correctAnswer: QuestionOptionValue;
  choices?: QuestionChoice[];
  media?: QuestionMedia | null;
  points: number;
  scope: QuestionScope;
  topicBlock: TopicBlockId;
  difficultySeed: number;
};

export type QuestionAttempt = {
  id: string;
  questionId: string;
  sessionId: string;
  sessionMode: QuestionSessionMode;
  topicBlock: TopicBlockId;
  selectedAnswer: QuestionOptionValue;
  isCorrect: boolean;
  answeredAt: string;
};

export type QuestionUserState = {
  questionId: string;
  timesSeen: number;
  timesCorrect: number;
  timesWrong: number;
  consecutiveCorrect: number;
  lastSeenAt: string | null;
  lastCorrectAt: string | null;
  lastWrongAt: string | null;
  reviewDueAt: string | null;
  masteryScore: number;
  isHard: boolean;
  isBookmarked: boolean;
  isMastered: boolean;
};

export type QuestionUserStateMap = Record<string, QuestionUserState>;

export type QuestionSessionAnswer = {
  questionId: string;
  selectedAnswer: QuestionOptionValue;
  isCorrect: boolean;
  answeredAt: string;
};

export type QuestionSessionEmptyReason =
  | "saved_empty"
  | "weak_spots_empty"
  | "hard_questions_empty"
  | "seen_not_mastered_empty"
  | "wrong_answers_empty"
  | "topic_empty"
  | "general_empty";

export type QuestionSessionRequest = {
  mode: QuestionSessionMode;
  questionLimit?: number | null;
  sessionKey: string;
  studyPlanTaskId?: string | null;
  topic?: TopicBlockId;
};

export type QuestionSession = {
  id: string;
  request: QuestionSessionRequest;
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, QuestionSessionAnswer>;
  createdAt: string;
  finishedAt: string | null;
  emptyReason: QuestionSessionEmptyReason | null;
};

export type QuestionSessionSummary = {
  total: number;
  answered: number;
  correct: number;
  wrong: number;
};

export type QuestionDerivedState = {
  isReviewDue: boolean;
  status:
    | "unseen"
    | "seen"
    | "correct_once"
    | "wrong_recently"
    | "hard"
    | "mastered";
};
