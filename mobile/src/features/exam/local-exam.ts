import {
  isCountryCode,
  type CountryCode,
  type DrivingCategory,
  type SupportedLocale,
} from "@prawko/config";

import { getExamCountry, useAppShellStore } from "../../state/app-shell";

import {
  flushQuestionProgressPersist,
  useQuestionProgressStore,
} from "../../state/question-progress";
import {
  createExamEntityId,
  createLocalExamSessionId,
  isLocalExamSessionId,
} from "./exam-session-id";
import {
  getExamDurationMinutes,
  getExamQuestionTarget,
  getRemainingExamSeconds,
  getExamPassPoints,
} from "./exam-config";
import {
  getExamProfile,
  isFreeExamSessionMetadata,
  readExamFlaggedOrders,
  type ExamProfile,
} from "./exam-profile";
import {
  LOCAL_EXAM_PROGRESS_VERSION,
  prepareLocalExamProgress,
  recordLocalExamProgress,
} from "./exam-learning-progress";
import {
  getExamQuestionIds,
  getQuestionById,
} from "../questions/question-engine";
import {
  cacheExamSnapshot,
  loadPersistedActiveExamSnapshot,
  loadPersistedExamHistory,
  loadPersistedExamSnapshot,
  loadPersistedUnindexedExamSnapshots,
  mergePersistedExamHistory,
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

const sessionsByCountry = new Map<CountryCode, Map<string, RemoteExamSnapshot>>();

function getLocalSessions(country: CountryCode = getExamCountry()) {
  let sessions = sessionsByCountry.get(country);
  if (!sessions) {
    sessions = new Map<string, RemoteExamSnapshot>();
    sessionsByCountry.set(country, sessions);
  }
  return sessions;
}

function getSnapshotCountry(snapshot: RemoteExamSnapshot) {
  const country = snapshot.session.metadata.exam_country;
  if (typeof country !== "string" || !isCountryCode(country)) {
    throw new Error("Local exam country is missing.");
  }
  return country;
}

function saveLocalSnapshot(snapshot: RemoteExamSnapshot) {
  const country = getSnapshotCountry(snapshot);
  getLocalSessions(country).set(snapshot.session.id, snapshot);
  cacheExamSnapshot(snapshot, country);
  recordLocalExamProgress(snapshot, country);
}

function mergeSessionMetadata(
  snapshot: RemoteExamSnapshot,
  metadata?: Record<string, unknown>
) {
  return {
    ...snapshot.session.metadata,
    ...metadata,
    // Call-site telemetry must not alter the session's storage/ledger context.
    exam_country: snapshot.session.metadata.exam_country,
    navigation: snapshot.session.metadata.navigation,
    learning_progress_version: snapshot.session.metadata.learning_progress_version,
    learning_progress_baseline_orders: snapshot.session.metadata.learning_progress_baseline_orders,
  };
}

function canResumeSnapshot(snapshot: RemoteExamSnapshot) {
  const owner = snapshot.session.metadata.owner_user_id;
  return (
    isLocalExamSessionId(snapshot.session.id) &&
    (typeof owner !== "string" || owner === useAppShellStore.getState().supabaseUser?.id)
  );
}

export function clearLocalExamSessions() {
  sessionsByCountry.clear();
}

export function resetLocalExamSessionsForTests() {
  clearLocalExamSessions();
}

/** Recover each country's sessions, including exams that expired off-screen. */
export async function recoverLocalExamProgress(country: CountryCode) {
  const history = await loadPersistedExamHistory(country);
  const unindexed = await loadPersistedUnindexedExamSnapshots(
    country,
    history.map((session) => session.id)
  );
  const unindexedById = new Map(
    unindexed.map((snapshot) => [snapshot.session.id, snapshot])
  );
  if (unindexed.length > 0) {
    await mergePersistedExamHistory(unindexed.map((snapshot) => snapshot.session), country);
  }
  const active = await loadPersistedActiveExamSnapshot(country);
  const byId = new Map(history.map((session) => [session.id, session]));
  for (const snapshot of unindexed) {
    byId.set(snapshot.session.id, snapshot.session);
  }
  if (active) {
    byId.set(active.session.id, active.session);
  }
  const sessions = [...byId.values()]
    .filter((session) =>
      isLocalExamSessionId(session.id) &&
      (session.status === "active" ||
        session.metadata.learning_progress_version === LOCAL_EXAM_PROGRESS_VERSION)
    )
    .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  for (const session of sessions) {
    const progress = useQuestionProgressStore.getState();
    if (
      getExamCountry() !== country ||
      !progress.hasHydrated ||
      progress.hydratedCountry !== country
    ) {
      return;
    }
    if (
      session.status !== "active" &&
      progress.examProgressLedger[`${country}:${session.id}`]?.finalized
    ) {
      continue;
    }
    // Prefer a live session over a disk snapshot captured before its last tap.
    const snapshot = getLocalSessions(country).get(session.id) ??
      unindexedById.get(session.id) ??
      (active?.session.id === session.id
        ? active
        : await loadPersistedExamSnapshot(session.id, country));
    if (!snapshot || getExamCountry() !== country || !canResumeSnapshot(snapshot)) {
      continue;
    }
    const tracked = prepareLocalExamProgress(snapshot, country);
    if (
      tracked.session.status === "active" &&
      getRemainingExamSeconds(tracked.session.expiresAt) <= 0
    ) {
      saveLocalSnapshot({
        ...tracked,
        session: {
          ...tracked.session,
          finishedAt: tracked.session.finishedAt ?? new Date().toISOString(),
          passed: tracked.session.scorePoints >= tracked.session.passPoints,
          remainingSeconds: 0,
          status: "expired",
        },
      });
    } else if (tracked !== snapshot) {
      saveLocalSnapshot(tracked);
    } else {
      getLocalSessions(country).set(tracked.session.id, tracked);
      recordLocalExamProgress(tracked, country);
    }
  }
  await flushQuestionProgressPersist();
}

export function startLocalExamSession(
  input: StartLocalExamInput
): RemoteExamSnapshot {
  if (!input.replaceExisting) {
    const activeSnapshot = findActiveLocalExamSessionInMemory(input.mode);

    if (activeSnapshot) {
      throw new Error("An active exam session already exists.");
    }
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
  if (
    input.mode !== "mini_test" &&
    (questions.length !== profile.totalQuestions || totalPointsTarget !== profile.maxPoints)
  ) {
    throw new Error("Could not build an exact official exam composition.");
  }
  const passPoints = getExamPassPoints(input.mode, totalPointsTarget, profile);
  const durationMinutes = getExamDurationMinutes(totalQuestionsTarget, profile);
  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
  const sessionId = createLocalExamSessionId();

  // Compose and validate the new ticket before abandoning the old attempt.
  // A missing statutory bucket must not discard the learner's active exam.
  if (input.replaceExisting) {
    abandonActiveLocalExamSessions(input.mode);
  }

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
        exam_country: getExamCountry(),
        learning_progress_version: LOCAL_EXAM_PROGRESS_VERSION,
        owner_user_id: useAppShellStore.getState().authMode === "supabase"
          ? useAppShellStore.getState().supabaseUser?.id ?? null
          : null,
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

  saveLocalSnapshot(snapshot);
  return cloneSnapshot(snapshot);
}

export async function fetchLocalExamSessionSnapshot(
  sessionId: string
): Promise<RemoteExamSnapshot> {
  const country = getExamCountry();
  const snapshot = getLocalSessions(country).get(sessionId);

  if (snapshot) {
    if (!canResumeSnapshot(snapshot)) {
      throw new Error("Local exam belongs to another account.");
    }
    const tracked = prepareLocalExamProgress(snapshot, country);
    saveLocalSnapshot(tracked);
    return cloneSnapshot(tracked);
  }

  const persisted = await loadPersistedExamSnapshot(sessionId, country);
  if (persisted) {
    if (!canResumeSnapshot(persisted)) {
      throw new Error("Local exam belongs to another account.");
    }
    const tracked = prepareLocalExamProgress(persisted, country);
    saveLocalSnapshot(tracked);
    return cloneSnapshot(tracked);
  }

  throw new Error("Local exam session not found.");
}

export async function fetchLatestActiveLocalExamSession(
  mode?: ExamSimulatorMode | null
): Promise<RemoteExamSnapshot | null> {
  const country = getExamCountry();
  const inMemory = findActiveLocalExamSessionInMemory(mode);
  const persisted = inMemory ?? await loadPersistedActiveExamSnapshot(country);

  if (
    country !== getExamCountry() || !persisted || !canResumeSnapshot(persisted) ||
    (mode && persisted.session.mode !== mode)
  ) {
    return null;
  }

  const tracked = prepareLocalExamProgress(persisted, country);
  const restored = cloneSnapshot(tracked);

  // A session whose clock ran out while the app was closed must not be resumed;
  // close it out so the next launch can start a fresh exam.
  if ((restored.session.remainingSeconds ?? 0) <= 0) {
    const expired: RemoteExamSnapshot = {
      ...tracked,
      session: {
        ...tracked.session,
        finishedAt: tracked.session.finishedAt ?? new Date().toISOString(),
        passed: tracked.session.scorePoints >= tracked.session.passPoints,
        remainingSeconds: 0,
        status: "expired",
      },
    };

    saveLocalSnapshot(expired);
    return null;
  }

  saveLocalSnapshot(tracked);
  return restored;
}

function findActiveLocalExamSessionInMemory(mode?: ExamSimulatorMode | null) {
  for (const snapshot of getLocalSessions().values()) {
    if (snapshot.session.status !== "active" || !canResumeSnapshot(snapshot)) {
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
    answerDurationMs: input.answerDurationMs ?? null,
    answerGiven: input.answerGiven,
    answeredAt: new Date().toISOString(),
    isCorrect,
    order: questionRef.order,
    pointsAwarded: isCorrect ? questionRef.points : 0,
    questionAttemptId: createExamEntityId(),
    questionId: questionRef.questionId,
    questionSourceId: questionRef.questionSourceId,
  };
  const nextAnswers = isFreeNav
    ? upsertAnswer(snapshot.answers, answer)
    : [...snapshot.answers, answer];

  if (isFreeNav) {
    const nextSnapshot = withRecomputedAnswers(snapshot, nextAnswers, {
      metadata: mergeSessionMetadata(snapshot, input.metadata),
    });
    saveLocalSnapshot(nextSnapshot);
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
      metadata: mergeSessionMetadata(snapshot, input.metadata),
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

  saveLocalSnapshot(nextSnapshot);
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

  saveLocalSnapshot(nextSnapshot);
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

  saveLocalSnapshot(nextSnapshot);
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
      metadata: mergeSessionMetadata(snapshot, input.metadata),
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

  saveLocalSnapshot(nextSnapshot);
  return cloneSnapshot(nextSnapshot);
}

export function setLocalExamSessionStatus(
  input: SetLocalExamSessionStatusInput
): RemoteExamSnapshot {
  const existing = getLocalSessions().get(input.sessionId);

  if (!existing) {
    throw new Error("Local exam session not found.");
  }
  const snapshot = prepareLocalExamProgress(existing, getExamCountry());

  if (!canResumeSnapshot(snapshot)) {
    throw new Error("Local exam belongs to another account.");
  }

  if (snapshot.session.status !== "active") {
    recordLocalExamProgress(snapshot, getSnapshotCountry(snapshot));
    return cloneSnapshot(snapshot);
  }

  const finishedAt = new Date().toISOString();
  const passed = input.status === "abandoned"
    ? null
    : snapshot.session.scorePoints >= snapshot.session.passPoints;
  const nextSnapshot: RemoteExamSnapshot = {
    ...snapshot,
    session: {
      ...snapshot.session,
      finishedAt,
      metadata: mergeSessionMetadata(snapshot, input.metadata),
      passed,
      remainingSeconds: 0,
      status: input.status,
    },
  };

  saveLocalSnapshot(nextSnapshot);
  return cloneSnapshot(nextSnapshot);
}

function requireActiveSnapshot(sessionId: string) {
  const existing = getLocalSessions().get(sessionId);

  if (!existing) {
    throw new Error("Local exam session not found.");
  }

  if (!canResumeSnapshot(existing)) {
    throw new Error("Local exam belongs to another account.");
  }

  if (existing.session.status !== "active") {
    throw new Error("This exam session is no longer active.");
  }

  return prepareLocalExamProgress(existing, getExamCountry());
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
  for (const snapshot of getLocalSessions().values()) {
    if (snapshot.session.status !== "active" || snapshot.session.mode !== mode ||
        !canResumeSnapshot(snapshot)) {
      continue;
    }
    const tracked = prepareLocalExamProgress(snapshot, getExamCountry());

    const abandoned: RemoteExamSnapshot = {
      ...tracked,
      session: {
        ...tracked.session,
        finishedAt: new Date().toISOString(),
        passed: null,
        remainingSeconds: 0,
        status: "abandoned",
      },
    };

    saveLocalSnapshot(abandoned);
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
