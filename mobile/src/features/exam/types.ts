import type {
  DrivingCategory,
  QuestionScope,
  QuestionSessionMode,
  SupportedLocale,
} from "@prawko/config";

export type ExamSimulatorMode = Extract<
  QuestionSessionMode,
  "exam" | "mini_test" | "exam_tomorrow"
>;

export type RemoteExamSessionStatus =
  | "active"
  | "completed"
  | "abandoned"
  | "expired";

export type RemoteExamQuestionRef = {
  order: number;
  points: number;
  questionId: string;
  questionSourceId: string;
  scope: QuestionScope;
};

export type RemoteExamAnswer = {
  answerGiven: string;
  answeredAt: string;
  isCorrect: boolean;
  order: number;
  pointsAwarded: number;
  questionAttemptId: string | null;
  questionId: string;
  questionSourceId: string;
};

export type RemoteExamSession = {
  correctAnswersCount: number;
  currentCategory: DrivingCategory;
  currentQuestionIndex: number;
  expiresAt: string | null;
  finishedAt: string | null;
  id: string;
  metadata: Record<string, unknown>;
  mode: ExamSimulatorMode;
  passPoints: number;
  passed: boolean | null;
  remainingSeconds: number | null;
  scorePoints: number;
  sessionLocale: SupportedLocale;
  startedAt: string;
  status: RemoteExamSessionStatus;
  studyPlanId: string | null;
  totalPointsTarget: number;
  totalQuestionsAnswered: number;
  totalQuestionsTarget: number;
  wrongAnswersCount: number;
};

export type RemoteExamSnapshot = {
  answers: RemoteExamAnswer[];
  questions: RemoteExamQuestionRef[];
  session: RemoteExamSession;
  wrongQuestionSourceIds: string[];
};
