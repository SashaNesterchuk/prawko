import {
  DEFAULT_CATEGORY,
  DEFAULT_COUNTRY_CODE,
  isCountryCode,
  QUESTION_TOPIC_IDS,
  STUDY_PLAN_LIMITS,
  isDrivingCategory,
  normalizeQuestionTopicId,
  type CountryCode,
  type DrivingCategory,
  type SupportedLocale,
} from "@prawko/config";
import type { Href } from "expo-router";

import {
  getQuestionBank,
  hydrateQuestionBankFromLocalQuestions,
} from "../../features/questions/question-bank";
import {
  createEmptyQuestionUserState,
} from "../../features/questions/question-engine";
import { buildReadinessAssessmentResult } from "../../features/questions/readiness-assessment";
import type {
  QuestionAttempt,
  QuestionOptionValue,
  QuestionSession,
  QuestionUserStateMap,
} from "../../features/questions/types";
import { createLocalExamSessionId } from "../../features/exam/exam-session-id";
import { seedPersistedExamSnapshot } from "../../features/exam/exam-snapshot-cache";
import { getScaledExamPassPoints } from "../../features/exam/exam-config";
import type {
  RemoteExamAnswer,
  RemoteExamQuestionRef,
  RemoteExamSessionStatus,
  RemoteExamSnapshot,
} from "../../features/exam/types";
import {
  createHomeDailySessionKey,
  HOME_DAILY_QUESTION_COUNT,
} from "../../features/home/home-daily-practice";
import { INITIAL_DIAGNOSTIC_QUESTION_COUNT } from "../../features/questions/initial-diagnostic/mix";
import { resetDiagnosticReminderPromptForTests } from "../../features/questions/initial-diagnostic/reminder-prompt";
import { finalizeLocalOnboarding } from "../../features/onboarding/finalize-local-onboarding";
import { isRoadSignCategoryId } from "../../features/road-signs/catalog";
import { getExamDateFromDays } from "../../features/study-plan/generate-local-study-plan";
import { getWarsawIsoDate } from "../../features/study-plan/supabase-study-plan-progress";
import { rehydrateCountryScopedStores } from "../../countries/CountryScopedStores";
import { useAppShellStore } from "../../state/app-shell";
import { useQuestionCatalogStore } from "../../state/question-catalog";
import { useQuestionProgressStore } from "../../state/question-progress";
import {
  configureE2ETestOverrides,
  resetE2ETestOverrides,
  type E2EOfflinePackStatus,
  type E2EQuestionScenario,
} from "./state";
import { getE2EQuestionScenarioQuestions } from "./question-scenarios";

export type E2EDestination =
  | "home"
  | "learn"
  | "practice"
  | "profile"
  | "statistics"
  | "signs"
  | "signs-category"
  | "topic"
  | "topics"
  | "trainer-modes"
  | "exam-session"
  | "exam-result"
  | "exam-answers"
  | "question-result"
  | "question-result-failed"
  | "diagnostic-result";

export type E2EHomeDailyStatus = "done" | "in_progress";

type PrepareE2EAppStateInput = {
  category?: string | null;
  daysUntilExam?: number | null;
  examCountry?: string | null;
  examSessionCategory?: string | null;
  examSessionStatus?: RemoteExamSessionStatus | null;
  homeDaily?: E2EHomeDailyStatus | null;
  locale?: SupportedLocale | null;
  enableAds?: boolean | null;
  offlinePackCategory?: string | null;
  offlinePackStatus?: E2EOfflinePackStatus | null;
  plusAccess?: boolean | null;
  questionScenario?: E2EQuestionScenario | null;
  reachability?: boolean | null;
  seedQuestionResult?: boolean | null;
  seedQuestionResultOutcome?: "good" | "poor" | null;
  seedDiagnosticResult?: boolean | null;
  unlockHomeChrome?: boolean | null;
};

type ResolveE2EDestinationInput = {
  destination?: string | null;
  reviewStartOrder?: number | null;
  seededExamSessionId?: string | null;
  seededQuestionLimit?: string | null;
  seededQuestionMode?: string | null;
  seededQuestionSessionKey?: string | null;
  signCategoryId?: string | null;
  topicId?: string | null;
};

export async function prepareE2EAppState(
  input: PrepareE2EAppStateInput = {},
): Promise<{
  seededExamSessionId: string | null;
  seededQuestionLimit: string | null;
  seededQuestionMode: string | null;
  seededQuestionSessionKey: string | null;
}> {
  const store = useAppShellStore.getState();
  const preferredCategory = resolveCategory(input.category);
  const daysUntilExam = resolveDaysUntilExam(input.daysUntilExam);
  const preferredLocale = input.locale ?? store.preferredLocale;
  const examCountry = resolveExamCountry(input.examCountry);

  resetE2ETestOverrides();
  configureE2ETestOverrides({
    enableAds: input.enableAds,
    offlinePackCategory: input.offlinePackCategory,
    offlinePackStatus: input.offlinePackStatus,
    plusAccess: input.plusAccess,
    questionScenario: input.questionScenario,
    reachability: input.reachability,
    unlockHomeChrome: input.unlockHomeChrome ?? true,
  });

  if (input.questionScenario) {
    const questions = getE2EQuestionScenarioQuestions(input.questionScenario);
    hydrateQuestionBankFromLocalQuestions(questions);
    useQuestionCatalogStore.getState().setMock({
      questionCount: questions.length,
    });
  }

  store.setSessionResolved(true);
  store.setExamCountry(examCountry);
  await rehydrateCountryScopedStores(examCountry);
  store.setPreferredCategory(preferredCategory);
  store.completeCategoryStep();

  store.setPreferredLocale(preferredLocale);

  store.setExamSchedule({
    daysUntilExam,
    examDate: getExamDateFromDays(daysUntilExam),
  });

  finalizeLocalOnboarding();
  useAppShellStore.setState({ homeStartSpotlightDismissed: false });

  await waitForQuestionProgressHydrated();
  await waitForQuestionCatalogResolved();

  if (input.questionScenario) {
    const questionIds = getQuestionBank().map((question) => question.id);
    useQuestionProgressStore.getState().reconcileCatalog(questionIds);
    useQuestionProgressStore.getState().ensureTopicQuestionProgressSeeded();
  }

  const seededExamSessionId = input.examSessionStatus
    ? await seedE2EExamSnapshot({
        category: resolveLooseCategory(input.examSessionCategory) ?? preferredCategory,
        locale: preferredLocale,
        status: input.examSessionStatus,
      })
    : null;

  const homeDailySessionKey = input.homeDaily
    ? seedE2EHomeDailySession({
        category: preferredCategory,
        status: input.homeDaily,
      })
    : null;
  const seededQuestionSessionKey = homeDailySessionKey
    ? homeDailySessionKey
    : input.seedDiagnosticResult
      ? seedE2EFinishedDiagnosticSession({
          category: preferredCategory,
        })
    : input.seedQuestionResult
      ? seedE2EFinishedQuestionSession({
          category: preferredCategory,
          outcome: input.seedQuestionResultOutcome === "poor" ? "poor" : "good",
        })
      : null;

  return {
    seededExamSessionId,
    seededQuestionLimit: homeDailySessionKey
      ? String(HOME_DAILY_QUESTION_COUNT)
      : input.seedDiagnosticResult
        ? String(INITIAL_DIAGNOSTIC_QUESTION_COUNT)
      : seededQuestionSessionKey
        ? "5"
        : null,
    seededQuestionMode: homeDailySessionKey
      ? "mini_test"
      : input.seedDiagnosticResult
        ? "initial_diagnostic"
      : seededQuestionSessionKey
        ? "learning"
        : null,
    seededQuestionSessionKey,
  };
}

export function resolveE2EDestination(
  input: ResolveE2EDestinationInput = {},
): Href {
  switch (normalizeDestination(input.destination)) {
    case "learn":
      return "/(tabs)/learn";
    case "profile":
      return "/(tabs)/profile";
    case "practice":
      return "/practice";
    case "statistics":
      return "/statistics";
    case "signs":
      return "/(tabs)/signs";
    case "signs-category":
      return {
        pathname: "/signs/category/[categoryId]",
        params: {
          categoryId: resolveSignCategoryId(input.signCategoryId),
        },
      };
    case "topic":
      return {
        pathname: "/topic/[topicId]",
        params: {
          topicId: resolveTopicId(input.topicId),
        },
      };
    case "topics":
      return "/topics";
    case "trainer-modes":
      return "/trainer-modes";
    case "exam-session":
      return input.seededExamSessionId
        ? {
            pathname: "/exam/session",
            params: {
              sessionId: input.seededExamSessionId,
            },
          }
        : "/(tabs)";
    case "exam-result":
      return input.seededExamSessionId
        ? {
            pathname: "/exam/result",
            params: {
              sessionId: input.seededExamSessionId,
            },
          }
        : "/(tabs)";
    case "exam-answers":
      return input.seededExamSessionId
        ? {
            pathname: "/exam/answers",
            params: {
              sessionId: input.seededExamSessionId,
              startOrder: Math.max(1, input.reviewStartOrder ?? 1).toString(),
            },
          }
        : "/(tabs)";
    case "question-result":
    case "question-result-failed":
    case "diagnostic-result":
      return input.seededQuestionSessionKey
        ? {
            pathname: "/question",
            params: {
              mode: input.seededQuestionMode ?? "learning",
              questionLimit: input.seededQuestionLimit ?? "5",
              session: input.seededQuestionSessionKey,
            },
          }
        : "/(tabs)";
    case "home":
    default:
      return "/(tabs)";
  }
}

function normalizeDestination(
  value: string | null | undefined,
): E2EDestination {
  const normalized = value?.trim().toLowerCase();

  switch (normalized) {
    case "learn":
    case "practice":
    case "profile":
    case "statistics":
    case "signs":
    case "signs-category":
    case "topic":
    case "topics":
    case "trainer-modes":
    case "exam-session":
    case "exam-result":
    case "exam-answers":
    case "question-result":
    case "question-result-failed":
    case "diagnostic-result":
      return normalized;
    case "home":
    default:
      return "home";
  }
}

function resolveCategory(value: string | null | undefined): DrivingCategory {
  const candidate = value?.trim().toUpperCase();
  return isDrivingCategory(candidate) ? candidate : DEFAULT_CATEGORY;
}

function resolveExamCountry(value: string | null | undefined): CountryCode {
  const normalized = value?.trim().toUpperCase();
  return isCountryCode(normalized) ? normalized : DEFAULT_COUNTRY_CODE;
}

function resolveDaysUntilExam(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return STUDY_PLAN_LIMITS.recommendedDays;
  }

  return Math.max(1, Math.round(value));
}

function resolveSignCategoryId(value: string | null | undefined) {
  return value && isRoadSignCategoryId(value) ? value : "A";
}

function resolveTopicId(value: string | null | undefined) {
  return normalizeQuestionTopicId(value) ?? QUESTION_TOPIC_IDS[0];
}

function resolveLooseCategory(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  return isDrivingCategory(normalized) ? normalized : null;
}

function waitForQuestionProgressHydrated(timeoutMs = 5000) {
  if (useQuestionProgressStore.getState().hasHydrated) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error("Timed out waiting for question progress hydration."));
    }, timeoutMs);

    const unsubscribe = useQuestionProgressStore.subscribe((state) => {
      if (!state.hasHydrated) {
        return;
      }

      clearTimeout(timeoutId);
      unsubscribe();
      resolve();
    });
  });
}

function waitForQuestionCatalogResolved(timeoutMs = 15000) {
  if (useQuestionCatalogStore.getState().resolved) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error("Timed out waiting for question catalog."));
    }, timeoutMs);

    const unsubscribe = useQuestionCatalogStore.subscribe((state) => {
      if (!state.resolved) {
        return;
      }

      clearTimeout(timeoutId);
      unsubscribe();
      resolve();
    });
  });
}

async function seedE2EExamSnapshot(input: {
  category: DrivingCategory;
  locale: SupportedLocale;
  status: RemoteExamSessionStatus;
}) {
  const sourceQuestions = getQuestionBank().slice(0, 3);
  const questions = sourceQuestions.map<RemoteExamQuestionRef>((question, index) => ({
    order: index + 1,
    points: question.points,
    questionId: question.id,
    questionSourceId: question.id,
    scope: question.scope,
  }));
  const sessionId = createLocalExamSessionId();
  const startedAt = new Date(Date.now() - 5 * 60 * 1000);
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
  const answers =
    input.status === "active"
      ? []
      : buildSeededAnswers(sourceQuestions, questions);
  const scorePoints = answers.reduce(
    (sum, answer) => sum + answer.pointsAwarded,
    0
  );
  const passPoints = getScaledExamPassPoints(
    questions.reduce((sum, question) => sum + question.points, 0)
  );
  const snapshot: RemoteExamSnapshot = {
    answers,
    questions,
    session: {
      correctAnswersCount: answers.filter((answer) => answer.isCorrect).length,
      currentCategory: input.category,
      currentQuestionIndex: questions[0]?.order ?? 1,
      expiresAt: expiresAt.toISOString(),
      finishedAt:
        input.status === "active" ? null : new Date().toISOString(),
      id: sessionId,
      metadata: {
        source: "mobile_e2e_exam_seed",
      },
      mode: "exam",
      passPoints,
      passed: input.status === "active" ? null : scorePoints >= passPoints,
      remainingSeconds: input.status === "active" ? 20 * 60 : 0,
      scorePoints,
      sessionLocale: input.locale,
      startedAt: startedAt.toISOString(),
      status: input.status,
      studyPlanId: null,
      totalPointsTarget: questions.reduce(
        (sum, question) => sum + question.points,
        0
      ),
      totalQuestionsAnswered: answers.length,
      totalQuestionsTarget: questions.length,
      wrongAnswersCount: answers.filter((answer) => !answer.isCorrect).length,
    },
    wrongQuestionSourceIds: answers
      .filter((answer) => !answer.isCorrect)
      .map((answer) => answer.questionSourceId),
  };

  await seedPersistedExamSnapshot(snapshot);
  return sessionId;
}

function buildSeededAnswers(
  sourceQuestions: ReturnType<typeof getQuestionBank>,
  questions: RemoteExamQuestionRef[]
) {
  return questions.map<RemoteExamAnswer>((questionRef, index) => {
    const question = sourceQuestions[index];

    if (!question) {
      throw new Error("E2E exam seed could not resolve the source question.");
    }

    const isCorrect = index % 2 === 0;
    const answerGiven = isCorrect
      ? question.correctAnswer
      : pickWrongAnswer(question.correctAnswer);

    return {
      answerGiven,
      answeredAt: new Date(Date.now() - (questions.length - index) * 30_000).toISOString(),
      isCorrect,
      order: questionRef.order,
      pointsAwarded: isCorrect ? questionRef.points : 0,
      questionAttemptId: null,
      questionId: questionRef.questionId,
      questionSourceId: questionRef.questionSourceId,
    };
  });
}

function pickWrongAnswer(correctAnswer: QuestionOptionValue): QuestionOptionValue {
  switch (correctAnswer) {
    case "true":
      return "false";
    case "false":
      return "true";
    case "A":
      return "B";
    case "B":
      return "C";
    case "C":
    default:
      return "A";
  }
}

/** Finished first-session diagnostic so `/question` opens the starting-point result. */
function seedE2EFinishedDiagnosticSession(input: { category: DrivingCategory }) {
  resetDiagnosticReminderPromptForTests();
  const routeSessionKey = `e2e-diagnostic-result-${Date.now().toString(36)}`;
  const sessionKey = `${input.category}:${routeSessionKey}`;
  const sourceQuestions = getQuestionBank().slice(
    0,
    INITIAL_DIAGNOSTIC_QUESTION_COUNT
  );

  if (sourceQuestions.length < INITIAL_DIAGNOSTIC_QUESTION_COUNT) {
    throw new Error("E2E diagnostic result seed needs at least 10 questions.");
  }

  const questionIds = sourceQuestions.map((question) => question.id);
  const answers = Object.fromEntries(
    sourceQuestions.map((question, index) => {
      const isCorrect = index === 0 || index === 7;
      const selectedAnswer = isCorrect
        ? question.correctAnswer
        : pickWrongAnswer(question.correctAnswer);

      return [
        question.id,
        {
          questionId: question.id,
          selectedAnswer,
          isCorrect,
          answeredAt: new Date(
            Date.now() - (sourceQuestions.length - index) * 20_000
          ).toISOString(),
        },
      ];
    })
  );

  const session: QuestionSession = {
    id: `session-${sessionKey}`,
    request: {
      currentCategory: input.category,
      mode: "initial_diagnostic",
      questionLimit: INITIAL_DIAGNOSTIC_QUESTION_COUNT,
      sessionKey,
    },
    questionIds,
    currentIndex: questionIds.length - 1,
    answers,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    finishedAt: new Date().toISOString(),
    emptyReason: null,
  };

  const now = new Date().toISOString();
  const questionUserState: QuestionUserStateMap = Object.fromEntries(
    sourceQuestions.map((question, index) => {
      const isCorrect = index === 0 || index === 7;
      return [
        question.id,
        {
          ...createEmptyQuestionUserState(question.id),
          timesSeen: 1,
          timesCorrect: isCorrect ? 1 : 0,
          timesWrong: isCorrect ? 0 : 1,
          lastSeenAt: now,
          lastCorrectAt: isCorrect ? now : null,
          lastWrongAt: isCorrect ? null : now,
        },
      ];
    })
  );

  useAppShellStore.setState({ homeStartSpotlightDismissed: true });
  useQuestionProgressStore.setState({
    activeSession: session,
    questionUserState,
    readinessAssessment: buildReadinessAssessmentResult(session),
  });

  return routeSessionKey;
}

/** Finished 5-question learning session so `/question` opens the result screen. */
function seedE2EFinishedQuestionSession(input: {
  category: DrivingCategory;
  outcome?: "good" | "poor";
}) {
  const isPoor = input.outcome === "poor";
  const routeSessionKey = `e2e-question-result-${Date.now().toString(36)}`;
  // `useQuestionRouteParams` prefixes the `session` query with the category.
  const sessionKey = `${input.category}:${routeSessionKey}`;
  const sourceQuestions = getQuestionBank().slice(0, 5);

  if (sourceQuestions.length === 0) {
    throw new Error("E2E training result seed needs a local question bank.");
  }

  const questionIds = sourceQuestions.map((question) => question.id);
  const answers = Object.fromEntries(
    sourceQuestions.map((question, index) => {
      const isCorrect = isPoor ? false : index !== 2;
      const selectedAnswer = isCorrect
        ? question.correctAnswer
        : pickWrongAnswer(question.correctAnswer);

      return [
        question.id,
        {
          questionId: question.id,
          selectedAnswer,
          isCorrect,
          answeredAt: new Date(
            Date.now() - (sourceQuestions.length - index) * 20_000
          ).toISOString(),
        },
      ];
    })
  );

  const session: QuestionSession = {
    id: `session-${sessionKey}`,
    request: {
      currentCategory: input.category,
      mode: "learning",
      questionLimit: questionIds.length,
      sessionKey,
    },
    questionIds,
    currentIndex: questionIds.length - 1,
    answers,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    finishedAt: new Date().toISOString(),
    emptyReason: null,
  };

  const now = new Date().toISOString();
  const questionUserState: QuestionUserStateMap | undefined = isPoor
    ? Object.fromEntries(
        sourceQuestions.map((question) => [
          question.id,
          {
            ...createEmptyQuestionUserState(question.id),
            timesSeen: 1,
            timesWrong: 1,
            lastSeenAt: now,
            lastWrongAt: now,
          },
        ])
      )
    : undefined;

  useQuestionProgressStore.setState({
    activeSession: session,
    lastTrainingSessionPercents: {
      "learning:all": 100,
    },
    ...(questionUserState ? { questionUserState } : {}),
  });

  return routeSessionKey;
}

function seedE2EHomeDailySession(input: {
  category: DrivingCategory;
  status: E2EHomeDailyStatus;
}) {
  const today = getWarsawIsoDate();
  const routeSessionKey = createHomeDailySessionKey(today, input.category);
  const sessionKey = `${input.category}:${routeSessionKey}`;
  const sourceQuestions = getQuestionBank().slice(0, HOME_DAILY_QUESTION_COUNT);

  if (sourceQuestions.length === 0) {
    throw new Error("E2E home daily seed needs a local question bank.");
  }

  const isDone = input.status === "done";
  const answeredQuestions = isDone ? sourceQuestions : sourceQuestions.slice(0, 1);
  const nowMs = Date.now();
  const answers = Object.fromEntries(
    answeredQuestions.map((question, index) => {
      const isCorrect = index !== 2;
      const selectedAnswer = isCorrect
        ? question.correctAnswer
        : pickWrongAnswer(question.correctAnswer);

      return [
        question.id,
        {
          questionId: question.id,
          selectedAnswer,
          isCorrect,
          answeredAt: new Date(
            nowMs - (answeredQuestions.length - index) * 20_000
          ).toISOString(),
        },
      ];
    })
  );
  const questionIds = sourceQuestions.map((question) => question.id);
  const session: QuestionSession = {
    id: `session-${sessionKey}`,
    request: {
      currentCategory: input.category,
      mode: "mini_test",
      questionLimit: HOME_DAILY_QUESTION_COUNT,
      sessionKey,
    },
    questionIds,
    currentIndex: isDone ? Math.max(0, questionIds.length - 1) : 0,
    answers,
    createdAt: new Date(nowMs - 5 * 60 * 1000).toISOString(),
    finishedAt: isDone ? new Date(nowMs).toISOString() : null,
    emptyReason: null,
  };
  const questionUserState: QuestionUserStateMap = Object.fromEntries(
    answeredQuestions.map((question) => {
      const answer = answers[question.id];
      const isCorrect = Boolean(answer?.isCorrect);
      const answeredAt = answer?.answeredAt ?? new Date(nowMs).toISOString();

      return [
        question.id,
        {
          ...createEmptyQuestionUserState(question.id),
          timesSeen: 1,
          timesCorrect: isCorrect ? 1 : 0,
          timesWrong: isCorrect ? 0 : 1,
          lastSeenAt: answeredAt,
          lastCorrectAt: isCorrect ? answeredAt : null,
          lastWrongAt: isCorrect ? null : answeredAt,
        },
      ];
    })
  );
  const attempts: QuestionAttempt[] = answeredQuestions.map((question) => {
    const answer = answers[question.id]!;

    return {
      id: `attempt-${answer.answeredAt}-${question.id}`,
      questionId: question.id,
      sessionId: session.id,
      sessionMode: "mini_test",
      topicBlock: question.topicBlock,
      selectedAnswer: answer.selectedAnswer,
      isCorrect: answer.isCorrect,
      answeredAt: answer.answeredAt,
    };
  });
  // Daily 10 is post-diagnostic. Mini-test sessions no longer write readiness.
  const readinessAssessment = {
    completedAt: new Date(nowMs).toISOString(),
    correct: 6,
    scorePercent: 60,
    sessionId: "e2e-prior-diagnostic",
    total: INITIAL_DIAGNOSTIC_QUESTION_COUNT,
  };

  useAppShellStore.setState({ homeStartSpotlightDismissed: true });
  useQuestionProgressStore.setState({
    activeSession: isDone ? session : null,
    attempts,
    homeDailySession: session,
    questionUserState,
    readinessAssessment,
  });

  return routeSessionKey;
}
