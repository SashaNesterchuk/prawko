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

  const totalQuestionsTarget = getExamQuestionTarget(
    input.mode,
    input.requestedTotalQuestions
  );
  const userStates = useQuestionProgressStore.getState().questionUserState;
  const questionIds = getExamQuestionIds(userStates, totalQuestionsTarget);
  const questions = buildQuestionRefs(questionIds);
  const totalPointsTarget = questions.reduce((sum, question) => sum + question.points, 0);
  const passPoints = getScaledExamPassPoints(totalPointsTarget);
  const durationMinutes = getExamDurationMinutes(totalQuestionsTarget);
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
  const snapshot = sessions.get(input.sessionId);

  if (!snapshot) {
    throw new Error("Local exam session not found.");
  }

  if (snapshot.session.status !== "active") {
    throw new Error("This exam session is no longer active.");
  }

  const currentQuestionRef = snapshot.questions.find(
    (question) => question.order === snapshot.session.currentQuestionIndex
  );

  if (!currentQuestionRef) {
    throw new Error("Current exam question not found.");
  }

  const question = getQuestionById(currentQuestionRef.questionSourceId);

  if (!question) {
    throw new Error("Question catalog entry not found.");
  }

  const isCorrect = question.correctAnswer === input.answerGiven;
  const pointsAwarded = isCorrect ? currentQuestionRef.points : 0;
  const answer: RemoteExamAnswer = {
    answerGiven: input.answerGiven,
    answeredAt: new Date().toISOString(),
    isCorrect,
    order: currentQuestionRef.order,
    pointsAwarded,
    questionAttemptId: null,
    questionId: currentQuestionRef.questionId,
    questionSourceId: currentQuestionRef.questionSourceId,
  };
  const nextAnswers = [...snapshot.answers, answer];
  const nextQuestionIndex = currentQuestionRef.order + 1;
  const hasMoreQuestions = snapshot.questions.some(
    (question) => question.order === nextQuestionIndex
  );
  const nextStatus: RemoteExamSessionStatus = hasMoreQuestions
    ? "active"
    : "completed";
  const nextScorePoints = snapshot.session.scorePoints + pointsAwarded;
  const nextCorrectCount =
    snapshot.session.correctAnswersCount + (isCorrect ? 1 : 0);
  const nextWrongCount =
    snapshot.session.wrongAnswersCount + (isCorrect ? 0 : 1);
  const nextWrongQuestionSourceIds = isCorrect
    ? snapshot.wrongQuestionSourceIds
    : [...snapshot.wrongQuestionSourceIds, currentQuestionRef.questionSourceId];
  const finishedAt =
    nextStatus === "completed" ? new Date().toISOString() : null;
  const passed =
    nextStatus === "completed"
      ? nextScorePoints >= snapshot.session.passPoints
      : null;

  const nextSnapshot: RemoteExamSnapshot = {
    answers: nextAnswers,
    questions: snapshot.questions,
    session: {
      ...snapshot.session,
      correctAnswersCount: nextCorrectCount,
      currentQuestionIndex: hasMoreQuestions
        ? nextQuestionIndex
        : snapshot.session.currentQuestionIndex,
      finishedAt,
      metadata: {
        ...snapshot.session.metadata,
        ...input.metadata,
      },
      passed,
      remainingSeconds: getRemainingExamSeconds(snapshot.session.expiresAt),
      scorePoints: nextScorePoints,
      status: nextStatus,
      totalQuestionsAnswered: nextAnswers.length,
      wrongAnswersCount: nextWrongCount,
    },
    wrongQuestionSourceIds: nextWrongQuestionSourceIds,
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
