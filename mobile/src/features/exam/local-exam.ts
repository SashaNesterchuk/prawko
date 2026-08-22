import type { DrivingCategory, SupportedLocale } from "@prawko/config";

import { useQuestionProgressStore } from "../../state/question-progress";
import { createLocalExamSessionId } from "./exam-session-id";
import {
  getExamDurationMinutes,
  getExamQuestionTarget,
  getRemainingExamSeconds,
  getScaledExamPassPoints,
} from "./exam-config";
import {
  getExamProfile,
  isFreeExamSessionMetadata,
  readExamFlaggedOrders,
  type ExamProfile,
} from "./exam-profile";
import {
  getExamQuestionIds,
  getQuestionById,
} from "../questions/question-engine";
import {
  cacheExamSnapshot,
  loadPersistedActiveExamSnapshot,
  loadPersistedExamSnapshot,
} from "./exam-snapshot-cache";
import type {
  ExamSimulatorMode,
  RemoteExamAnswer,
  RemoteExamQuestionRef,
  RemoteExamSessionStatus,
  RemoteExamSnapshot,
} from "./types";

type StartLocalExamInput = {
  category: DrivingCategory;
  locale: SupportedLocale;
  mode: ExamSimulatorMode;
  profile?: ExamProfile;
  replaceExisting?: boolean;
  requestedTotalQuestions?: number | null;
  studyPlanId?: string | null;
  studyPlanTaskId?: string | null;
};

type SubmitLocalExamAnswerInput = {
  answerDurationMs?: number | null;
  answerGiven: string;
  locale: SupportedLocale;
  metadata?: Record<string, unknown>;
  questionOrder?: number | null;
  sessionId: string;
};

type SetLocalExamSessionStatusInput = {
  metadata?: Record<string, unknown>;
  sessionId: string;
  status: Extract<RemoteExamSessionStatus, "abandoned" | "expired">;
};

const sessions = new Map<string, RemoteExamSnapshot>();

export function resetLocalExamSessionsForTests() {
  sessions.clear();
}

export function startLocalExamSession(
  input: StartLocalExamInput
): RemoteExamSnapshot {
  if (!input.replaceExisting) {
    const activeSnapshot = findActiveLocalExamSessionInMemory(input.mode);

    if (activeSnapshot) {
      throw new Error("An active exam session already exists.");
    }
  } else {
    abandonActiveLocalExamSessions(input.mode);
  }

  const profile = input.profile ?? getExamProfile();
  const totalQuestionsTarget = getExamQuestionTarget(
    input.mode,
    input.requestedTotalQuestions,
    profile
  );
  const userStates = useQuestionProgressStore.getState().questionUserState;
  const questionIds = getExamQuestionIds(
    userStates,
    totalQuestionsTarget,
    new Date(),
    profile,
    input.mode
  );
  const questions = buildQuestionRefs(questionIds);
  const totalPointsTarget = questions.reduce((sum, question) => sum + question.points, 0);
  const passPoints = getScaledExamPassPoints(totalPointsTarget, profile);
  const durationMinutes = getExamDurationMinutes(totalQuestionsTarget, profile);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
  const sessionId = createLocalExamSessionId();

  const snapshot: RemoteExamSnapshot = {
    answers: [],
    questions,
    session: {
      correctAnswersCount: 0,
      currentCategory: input.category,
      currentQuestionIndex: questions[0]?.order ?? 1,
      expiresAt: expiresAt.toISOString(),
      finishedAt: null,
      id: sessionId,
      metadata: {
        source: "mobile_local_exam",
        study_plan_task_id: input.studyPlanTaskId ?? null,
        navigation: profile.navigation,
        flaggedOrders: [],
      },
      mode: input.mode,
      passPoints,
      passed: null,
      remainingSeconds: getRemainingExamSeconds(expiresAt.toISOString()),
      scorePoints: 0,
      sessionLocale: input.locale,
      startedAt: startedAt.toISOString(),
      status: "active",
      studyPlanId: input.studyPlanId ?? null,
      totalPointsTarget,
      totalQuestionsAnswered: 0,
      totalQuestionsTarget: questions.length,
      wrongAnswersCount: 0,
    },
    wrongQuestionSourceIds: [],
  };

  sessions.set(sessionId, snapshot);
  cacheExamSnapshot(snapshot);
  return cloneSnapshot(snapshot);
}

export async function fetchLocalExamSessionSnapshot(
  sessionId: string
): Promise<RemoteExamSnapshot> {
  const snapshot = sessions.get(sessionId);

  if (snapshot) {
    return cloneSnapshot(snapshot);
  }

  const persisted = await loadPersistedExamSnapshot(sessionId);
  if (persisted) {
    sessions.set(sessionId, persisted);
    return cloneSnapshot(persisted);
  }

  throw new Error("Local exam session not found.");
}

export async function fetchLatestActiveLocalExamSession(
  mode?: ExamSimulatorMode | null
): Promise<RemoteExamSnapshot | null> {
  const inMemory = findActiveLocalExamSessionInMemory(mode);

  if (inMemory) {
    return inMemory;
  }

  const persisted = await loadPersistedActiveExamSnapshot();

  if (!persisted || (mode && persisted.session.mode !== mode)) {
    return null;
  }

  const restored = cloneSnapshot(persisted);

  // A session whose clock ran out while the app was closed must not be resumed;
  // close it out so the next launch can start a fresh exam.
  if ((restored.session.remainingSeconds ?? 0) <= 0) {
    const expired: RemoteExamSnapshot = {
      ...persisted,
      session: {
        ...persisted.session,
        finishedAt: persisted.session.finishedAt ?? new Date().toISOString(),
        passed: persisted.session.scorePoints >= persisted.session.passPoints,
        remainingSeconds: 0,
        status: "expired",
      },
    };

    sessions.set(expired.session.id, expired);
    cacheExamSnapshot(expired);
    return null;
  }

  sessions.set(persisted.session.id, persisted);
  return restored;
}

function findActiveLocalExamSessionInMemory(mode?: ExamSimulatorMode | null) {
  for (const snapshot of sessions.values()) {
    if (snapshot.session.status !== "active") {
      continue;
    }

    if (mode && snapshot.session.mode !== mode) {
      continue;
    }

    return cloneSnapshot(snapshot);
  }

  return null;
}

export function submitLocalExamAnswer(
  input: SubmitLocalExamAnswerInput
): RemoteExamSnapshot {
  const snapshot = requireActiveSnapshot(input.sessionId);
  const isFreeNav = isFreeExamSessionMetadata(snapshot.session.metadata);
  const questionOrder =
    input.questionOrder ?? snapshot.session.currentQuestionIndex;
  const questionRef = snapshot.questions.find(
    (question) => question.order === questionOrder
  );

  if (!questionRef) {
    throw new Error("Current exam question not found.");
  }

  const question = getQuestionById(questionRef.questionSourceId);

  if (!question) {
    throw new Error("Question catalog entry not found.");
  }

  if (
    !isFreeNav &&
    snapshot.answers.some((answer) => answer.order === questionRef.order)
  ) {
    return cloneSnapshot(snapshot);
  }

  const isCorrect = question.correctAnswer === input.answerGiven;
  const answer: RemoteExamAnswer = {
    answerGiven: input.answerGiven,
    answeredAt: new Date().toISOString(),
    isCorrect,
    order: questionRef.order,
    pointsAwarded: isCorrect ? questionRef.points : 0,
    questionAttemptId: null,
    questionId: questionRef.questionId,
    questionSourceId: questionRef.questionSourceId,
  };
  const nextAnswers = isFreeNav
    ? upsertAnswer(snapshot.answers, answer)
    : [...snapshot.answers, answer];

  if (isFreeNav) {
    const nextSnapshot = withRecomputedAnswers(snapshot, nextAnswers, {
      metadata: {
        ...snapshot.session.metadata,
        ...input.metadata,
      },
    });
    sessions.set(input.sessionId, nextSnapshot);
    cacheExamSnapshot(nextSnapshot);
    return cloneSnapshot(nextSnapshot);
  }

  const nextQuestionIndex = questionRef.order + 1;
  const hasMoreQuestions = snapshot.questions.some(
    (entry) => entry.order === nextQuestionIndex
  );
  const stats = summarizeAnswers(nextAnswers);
  const nextStatus: RemoteExamSessionStatus = hasMoreQuestions
    ? "active"
    : "completed";
  const finishedAt =
    nextStatus === "completed" ? new Date().toISOString() : null;
  const nextSnapshot: RemoteExamSnapshot = {
    answers: nextAnswers,
    questions: snapshot.questions,
    session: {
      ...snapshot.session,
      correctAnswersCount: stats.correctAnswersCount,
      currentQuestionIndex: hasMoreQuestions
        ? nextQuestionIndex
        : snapshot.session.currentQuestionIndex,
      finishedAt,
      metadata: {
        ...snapshot.session.metadata,
        ...input.metadata,
      },
      passed:
        nextStatus === "completed"
          ? stats.scorePoints >= snapshot.session.passPoints
          : null,
      remainingSeconds: getRemainingExamSeconds(snapshot.session.expiresAt),
      scorePoints: stats.scorePoints,
      status: nextStatus,
      totalQuestionsAnswered: nextAnswers.length,
      wrongAnswersCount: stats.wrongAnswersCount,
    },
    wrongQuestionSourceIds: stats.wrongQuestionSourceIds,
  };

  sessions.set(input.sessionId, nextSnapshot);
  cacheExamSnapshot(nextSnapshot);
  return cloneSnapshot(nextSnapshot);
}

export function setLocalExamCurrentIndex(input: {
  questionOrder: number;
  sessionId: string;
}): RemoteExamSnapshot {
  const snapshot = requireActiveSnapshot(input.sessionId);
  const hasQuestion = snapshot.questions.some(
    (question) => question.order === input.questionOrder
  );

  if (!hasQuestion) {
    throw new Error("Exam question order is out of range.");
  }

  const nextSnapshot: RemoteExamSnapshot = {
    ...snapshot,
    session: {
      ...snapshot.session,
      currentQuestionIndex: input.questionOrder,
      remainingSeconds: getRemainingExamSeconds(snapshot.session.expiresAt),
    },
  };

  sessions.set(input.sessionId, nextSnapshot);
  cacheExamSnapshot(nextSnapshot);
  return cloneSnapshot(nextSnapshot);
}

export function setLocalExamFlaggedOrders(input: {
  flaggedOrders: number[];
  sessionId: string;
}): RemoteExamSnapshot {
  const snapshot = requireActiveSnapshot(input.sessionId);
  const allowed = new Set(snapshot.questions.map((question) => question.order));
  const flaggedOrders = [
    ...new Set(
      input.flaggedOrders.filter((order) => allowed.has(order))
    ),
  ].sort((left, right) => left - right);

  const nextSnapshot: RemoteExamSnapshot = {
    ...snapshot,
    session: {
      ...snapshot.session,
      metadata: {
        ...snapshot.session.metadata,
        flaggedOrders,
      },
      remainingSeconds: getRemainingExamSeconds(snapshot.session.expiresAt),
    },
  };

  sessions.set(input.sessionId, nextSnapshot);
  cacheExamSnapshot(nextSnapshot);
  return cloneSnapshot(nextSnapshot);
}

export function toggleLocalExamFlag(input: {
  questionOrder: number;
  sessionId: string;
}): RemoteExamSnapshot {
  const snapshot = requireActiveSnapshot(input.sessionId);
  const current = readExamFlaggedOrders(snapshot.session.metadata);
  const next = current.includes(input.questionOrder)
    ? current.filter((order) => order !== input.questionOrder)
    : [...current, input.questionOrder];

  return setLocalExamFlaggedOrders({
    flaggedOrders: next,
    sessionId: input.sessionId,
  });
}

export function finishLocalExamSession(input: {
  metadata?: Record<string, unknown>;
  sessionId: string;
}): RemoteExamSnapshot {
  const snapshot = requireActiveSnapshot(input.sessionId);
  const stats = summarizeAnswers(snapshot.answers);
  const finishedAt = new Date().toISOString();
  const nextSnapshot: RemoteExamSnapshot = {
    ...snapshot,
    session: {
      ...snapshot.session,
      finishedAt,
      metadata: {
        ...snapshot.session.metadata,
        ...input.metadata,
      },
      passed: stats.scorePoints >= snapshot.session.passPoints,
      remainingSeconds: getRemainingExamSeconds(snapshot.session.expiresAt),
      scorePoints: stats.scorePoints,
      status: "completed",
      totalQuestionsAnswered: snapshot.answers.length,
      correctAnswersCount: stats.correctAnswersCount,
      wrongAnswersCount: stats.wrongAnswersCount,
    },
    wrongQuestionSourceIds: stats.wrongQuestionSourceIds,
  };

  sessions.set(input.sessionId, nextSnapshot);
  cacheExamSnapshot(nextSnapshot);
  return cloneSnapshot(nextSnapshot);
}

export function setLocalExamSessionStatus(
  input: SetLocalExamSessionStatusInput
): RemoteExamSnapshot {
  const snapshot = sessions.get(input.sessionId);

  if (!snapshot) {
    throw new Error("Local exam session not found.");
  }

  if (snapshot.session.status !== "active") {
    return cloneSnapshot(snapshot);
  }

  const finishedAt = new Date().toISOString();
  const passed = snapshot.session.scorePoints >= snapshot.session.passPoints;
  const nextSnapshot: RemoteExamSnapshot = {
    ...snapshot,
    session: {
      ...snapshot.session,
      finishedAt,
      metadata: {
        ...snapshot.session.metadata,
        ...input.metadata,
      },
      passed,
      remainingSeconds: 0,
      status: input.status,
    },
  };

  sessions.set(input.sessionId, nextSnapshot);
  cacheExamSnapshot(nextSnapshot);
  return cloneSnapshot(nextSnapshot);
}

function requireActiveSnapshot(sessionId: string) {
  const snapshot = sessions.get(sessionId);

  if (!snapshot) {
    throw new Error("Local exam session not found.");
  }

  if (snapshot.session.status !== "active") {
    throw new Error("This exam session is no longer active.");
  }

  return snapshot;
}

function upsertAnswer(
  answers: RemoteExamAnswer[],
  nextAnswer: RemoteExamAnswer
) {
  const index = answers.findIndex((answer) => answer.order === nextAnswer.order);
  if (index < 0) {
    return [...answers, nextAnswer].sort((left, right) => left.order - right.order);
  }

  const next = [...answers];
  next[index] = nextAnswer;
  return next;
}

function summarizeAnswers(answers: RemoteExamAnswer[]) {
  return {
    scorePoints: answers.reduce((sum, answer) => sum + answer.pointsAwarded, 0),
    correctAnswersCount: answers.filter((answer) => answer.isCorrect).length,
    wrongAnswersCount: answers.filter((answer) => !answer.isCorrect).length,
    wrongQuestionSourceIds: answers
      .filter((answer) => !answer.isCorrect)
      .map((answer) => answer.questionSourceId),
  };
}

function withRecomputedAnswers(
  snapshot: RemoteExamSnapshot,
  answers: RemoteExamAnswer[],
  extras: { metadata?: Record<string, unknown> }
): RemoteExamSnapshot {
  const stats = summarizeAnswers(answers);

  return {
    answers,
    questions: snapshot.questions,
    session: {
      ...snapshot.session,
      correctAnswersCount: stats.correctAnswersCount,
      metadata: extras.metadata ?? snapshot.session.metadata,
      remainingSeconds: getRemainingExamSeconds(snapshot.session.expiresAt),
      scorePoints: stats.scorePoints,
      totalQuestionsAnswered: answers.length,
      wrongAnswersCount: stats.wrongAnswersCount,
    },
    wrongQuestionSourceIds: stats.wrongQuestionSourceIds,
  };
}

function buildQuestionRefs(questionIds: string[]): RemoteExamQuestionRef[] {
  return questionIds
    .map((questionId, index) => {
      const question = getQuestionById(questionId);

      if (!question) {
        return null;
      }

      return {
        order: index + 1,
        points: question.points,
        questionId,
        questionSourceId: questionId,
        scope: question.scope,
      };
    })
    .filter((question): question is RemoteExamQuestionRef => question !== null);
}

function abandonActiveLocalExamSessions(mode: ExamSimulatorMode) {
  for (const [sessionId, snapshot] of sessions.entries()) {
    if (snapshot.session.status !== "active" || snapshot.session.mode !== mode) {
      continue;
    }

    const abandoned: RemoteExamSnapshot = {
      ...snapshot,
      session: {
        ...snapshot.session,
        finishedAt: new Date().toISOString(),
        passed: snapshot.session.scorePoints >= snapshot.session.passPoints,
        remainingSeconds: 0,
        status: "abandoned",
      },
    };

    sessions.set(sessionId, abandoned);
    cacheExamSnapshot(abandoned);
  }
}

function cloneSnapshot(snapshot: RemoteExamSnapshot): RemoteExamSnapshot {
  return {
    ...snapshot,
    answers: [...snapshot.answers],
    questions: [...snapshot.questions],
    session: {
      ...snapshot.session,
      metadata: { ...snapshot.session.metadata },
      remainingSeconds: getRemainingExamSeconds(snapshot.session.expiresAt),
    },
    wrongQuestionSourceIds: [...snapshot.wrongQuestionSourceIds],
  };
}
