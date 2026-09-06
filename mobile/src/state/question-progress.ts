import {
  isQuestionTopicId,
  isTopicBlockId,
  normalizeQuestionTopicId,
} from "@prawko/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import {
  buildQuestionSession,
  canResumeQuestionSession,
  finishQuestionSession,
  getQuestionById,
  getQuestionTopicIds,
  getNextQuestionUserStateAfterAttempt,
  getNextTopicQuestionProgressMapAfterAttempt,
  getQuestionUserState,
  isQuestionSessionExpired,
  normalizeQuestionUserStateMap,
  pauseQuestionSessionTimer,
  resumeQuestionSession,
  resumeQuestionSessionTimer,
  seedTopicQuestionProgressFromUserState,
} from "../features/questions/question-engine";
import {
  buildReadinessAssessmentResult,
  type ReadinessAssessmentResult,
} from "../features/questions/readiness-assessment";
import {
  isHomeDailySessionKey,
  isSameHomeDailySession,
  resumeHomeDailySession,
} from "../features/home/home-daily-practice";
import type {
  QuestionAttempt,
  QuestionOptionValue,
  QuestionSession,
  QuestionSessionRequest,
  QuestionUserStateMap,
  TopicQuestionProgressMap,
} from "../features/questions/types";

type PersistedQuestionProgress = Pick<
  QuestionProgressState,
  | "activeSession"
  | "attempts"
  | "homeDailySession"
  | "lastTrainingSessionPercents"
  | "questionUserState"
  | "readinessAssessment"
  | "topicQuestionContextProgress"
  | "topicQuestionProgress"
  | "topicQuestionProgressSeeded"
>;

const PERSIST_FLUSH_DELAY_MS = 800;

/** Bound after the store exists so background persist can freeze the blitz clock. */
let pauseTimedSessionForBackground: (() => void) | null = null;
let flushDeferredProgressPersist: (() => Promise<void>) | null = null;
let discardDeferredProgressPersist: (() => void) | null = null;

export function flushQuestionProgressPersist() {
  return flushDeferredProgressPersist?.() ?? Promise.resolve();
}

export function discardPendingQuestionProgressPersist() {
  discardDeferredProgressPersist?.();
}

/**
 * Answering a question rewrites the whole progress blob, and serializing it is
 * heavy enough to be felt on tap. Writes are batched and the JSON is built at
 * flush time, off the interaction frame.
 */
function createDeferredProgressStorage(): PersistStorage<PersistedQuestionProgress> {
  const pendingWrites = new Map<string, StorageValue<PersistedQuestionProgress>>();
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;
  let isFlushQueued = false;

  const flush = () => {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }

    if (pendingWrites.size === 0 || isFlushQueued) {
      return Promise.resolve();
    }

    // Snapshot now, stringify on a later turn so tab presses / navigation are
    // not blocked by JSON.stringify of a multi‑MB progress blob.
    const pendingEntries = [...pendingWrites.entries()];
    pendingWrites.clear();
    isFlushQueued = true;

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        isFlushQueued = false;

        try {
          const entries = pendingEntries.map(
            ([name, value]) => [name, JSON.stringify(value)] as [string, string]
          );
          void AsyncStorage.multiSet(entries)
            .catch((error) => {
              console.warn("Failed to persist question progress.", error);
            })
            .finally(resolve);
        } catch (error) {
          console.warn("Failed to serialize question progress.", error);
          resolve();
        }
      }, 0);
    });
  };

  flushDeferredProgressPersist = () => flush();
  discardDeferredProgressPersist = () => {
    pendingWrites.clear();

    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
  };

  AppState.addEventListener("change", (nextState) => {
    if (nextState !== "active") {
      // Freeze the blitz clock before writing, so a backgrounded session
      // snapshot does not keep spending wall-clock time.
      pauseTimedSessionForBackground?.();
      flush();
    }
  });

  return {
    getItem: async (name) => {
      const pendingValue = pendingWrites.get(name);

      if (pendingValue) {
        return pendingValue;
      }

      const rawValue = await AsyncStorage.getItem(name);

      return rawValue
        ? (JSON.parse(rawValue) as StorageValue<PersistedQuestionProgress>)
        : null;
    },
    setItem: (name, value) => {
      pendingWrites.set(name, value);

      if (!flushTimeout) {
        flushTimeout = setTimeout(flush, PERSIST_FLUSH_DELAY_MS);
      }
    },
    removeItem: async (name) => {
      pendingWrites.delete(name);
      await AsyncStorage.removeItem(name);
    },
  };
}

type QuestionProgressState = {
  activeSession: QuestionSession | null;
  attempts: QuestionAttempt[];
  hasHydrated: boolean;
  /** Pinned Home “today: 10” session so trainer/exam cannot replace the day’s set. */
  homeDailySession: QuestionSession | null;
  /** Last finished training percent by mode:topic — used for session delta badges. */
  lastTrainingSessionPercents: Record<string, number>;
  questionUserState: QuestionUserStateMap;
  /** Latest completed mini_test score — separate from coverage / remote readiness. */
  readinessAssessment: ReadinessAssessmentResult | null;
  /**
   * Attempts completed from an explicitly opened catalog topic. This controls
   * the topic queue, so random training can still be practised in its topic.
   */
  topicQuestionContextProgress: TopicQuestionProgressMap;
  /** Training coverage attributed to every catalog topic on the question. */
  topicQuestionProgress: TopicQuestionProgressMap;
  /** False only for legacy saves until the catalog can attribute their progress. */
  topicQuestionProgressSeeded: boolean;
  applyQuestionAttemptOutcome: (
    questionId: string,
    input: {
      answeredAt: string;
      isCorrect: boolean;
    }
  ) => void;
  advanceSession: () => void;
  finishActiveSession: () => void;
  retreatSession: () => void;
  answerCurrentQuestion: (
    selectedAnswer: QuestionOptionValue
  ) => QuestionAttempt | null;
  clearActiveSession: () => void;
  ensureTopicQuestionProgressSeeded: () => void;
  recordTrainingSessionPercent: (input: {
    key: string;
    percent: number;
  }) => void;
  replaceQuestionUserState: (
    questionUserState: QuestionUserStateMap
  ) => void;
  reconcileCatalog: (validQuestionIds: string[]) => void;
  resetProgress: () => void;
  setHasHydrated: (value: boolean) => void;
  startOrResumeSession: (request: QuestionSessionRequest) => QuestionSession;
  pauseActiveSessionTimer: () => void;
  resumeActiveSessionTimer: () => void;
  toggleBookmark: (questionId: string) => boolean;
  toggleHard: (questionId: string) => boolean;
};

export const useQuestionProgressStore = create<QuestionProgressState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      attempts: [],
      hasHydrated: false,
      homeDailySession: null,
      lastTrainingSessionPercents: {},
      questionUserState: {},
      readinessAssessment: null,
      topicQuestionContextProgress: {},
      topicQuestionProgress: {},
      topicQuestionProgressSeeded: true,
      applyQuestionAttemptOutcome: (questionId, input) =>
        set((state) => {
          const previousState = getQuestionUserState(
            state.questionUserState,
            questionId
          );
          const nextState = getNextQuestionUserStateAfterAttempt(previousState, {
            answeredAt: input.answeredAt,
            isCorrect: input.isCorrect,
          });

          return {
            questionUserState: {
              ...state.questionUserState,
              [questionId]: nextState,
            },
          };
        }),
      advanceSession: () => {
        const wasFinished = Boolean(get().activeSession?.finishedAt);
        set((state) => {
          if (!state.activeSession) {
            return state;
          }

          const answeredCount = Object.keys(state.activeSession.answers).length;
          const isLastQuestion =
            state.activeSession.currentIndex >=
            state.activeSession.questionIds.length - 1;

          if (isLastQuestion || answeredCount >= state.activeSession.questionIds.length) {
            return completeActiveSessionState(state, state.activeSession);
          }

          const activeSession = {
            ...state.activeSession,
            currentIndex: state.activeSession.currentIndex + 1,
          };

          return {
            activeSession,
            homeDailySession: pinDailySession(state.homeDailySession, activeSession),
          };
        });

        if (!wasFinished && get().activeSession?.finishedAt) {
          void flushQuestionProgressPersist();
        }
      },
      retreatSession: () =>
        set((state) => {
          if (!state.activeSession || state.activeSession.currentIndex <= 0) {
            return state;
          }

          const activeSession = {
            ...state.activeSession,
            currentIndex: state.activeSession.currentIndex - 1,
            finishedAt: null,
          };

          return {
            activeSession,
            homeDailySession: pinDailySession(state.homeDailySession, activeSession),
          };
        }),
      answerCurrentQuestion: (selectedAnswer) => {
        const state = get();
        const activeSession = state.activeSession;

        if (
          !activeSession ||
          activeSession.finishedAt ||
          isQuestionSessionExpired(activeSession)
        ) {
          return null;
        }

        const questionId = activeSession.questionIds[activeSession.currentIndex];

        if (!questionId) {
          return null;
        }

        const question = getQuestionById(questionId);

        if (!question) {
          return null;
        }

        const existingAnswer = activeSession.answers[questionId];
        const now = new Date();
        const answeredAt = now.toISOString();
        const isCorrect = question.correctAnswer === selectedAnswer;

        if (
          existingAnswer &&
          existingAnswer.selectedAnswer === selectedAnswer
        ) {
          return {
            id: `attempt-${existingAnswer.answeredAt}-${questionId}`,
            questionId,
            sessionId: activeSession.id,
            sessionMode: activeSession.request.mode,
            topicBlock: question.topicBlock,
            selectedAnswer: existingAnswer.selectedAnswer,
            isCorrect: existingAnswer.isCorrect,
            answeredAt: existingAnswer.answeredAt,
          };
        }

        const attempt: QuestionAttempt = {
          id: `attempt-${now.getTime().toString(36)}-${questionId}`,
          questionId,
          sessionId: activeSession.id,
          sessionMode: activeSession.request.mode,
          topicBlock: question.topicBlock,
          selectedAnswer,
          isCorrect,
          answeredAt,
        };

        if (existingAnswer) {
          set((currentState) => {
            const activeSession = currentState.activeSession
              ? {
                  ...currentState.activeSession,
                  answers: {
                    ...currentState.activeSession.answers,
                    [questionId]: {
                      questionId,
                      selectedAnswer,
                      isCorrect,
                      answeredAt,
                    },
                  },
                }
              : null;

            return {
              activeSession,
              homeDailySession: pinDailySession(
                currentState.homeDailySession,
                activeSession
              ),
            };
          });

          return attempt;
        }

        const previousState = getQuestionUserState(
          state.questionUserState,
          questionId
        );
        const nextState = getNextQuestionUserStateAfterAttempt(previousState, {
          answeredAt,
          isCorrect,
        });
        const isTrainingSession = activeSession.request.mode !== "exam";
        const sessionTopic = activeSession.request.topic;
        const topicContextId =
          isTrainingSession &&
          typeof sessionTopic === "string" &&
          !isTopicBlockId(sessionTopic)
            ? sessionTopic
            : null;
        // Every non-exam training answer covers all catalog topics assigned to
        // the question. Topic context remains separate, so another topic can
        // still offer the question in its own practice queue.
        const coveredTopicIds = !isTrainingSession
          ? []
          : getQuestionTopicIds(question);

        set((currentState) => {
          const nextTopicQuestionProgress = isTrainingSession
            ? getNextTopicQuestionProgressMapAfterAttempt(
                currentState.topicQuestionProgress,
                coveredTopicIds,
                questionId,
                { answeredAt, isCorrect }
              )
            : currentState.topicQuestionProgress;
          const nextTopicQuestionContextProgress = topicContextId
            ? getNextTopicQuestionProgressMapAfterAttempt(
                currentState.topicQuestionContextProgress,
                [topicContextId],
                questionId,
                { answeredAt, isCorrect }
              )
            : currentState.topicQuestionContextProgress;
          const nextActiveSession = currentState.activeSession
            ? {
                ...currentState.activeSession,
                answers: {
                  ...currentState.activeSession.answers,
                  [questionId]: {
                    questionId,
                    selectedAnswer,
                    isCorrect,
                    answeredAt,
                  },
                },
              }
            : null;

          return {
            attempts: [...currentState.attempts, attempt],
            questionUserState: {
              ...currentState.questionUserState,
              [questionId]: nextState,
            },
            topicQuestionProgress: nextTopicQuestionProgress,
            topicQuestionContextProgress: nextTopicQuestionContextProgress,
            activeSession: nextActiveSession,
            homeDailySession: pinDailySession(
              currentState.homeDailySession,
              nextActiveSession
            ),
          };
        });

        return attempt;
      },
      clearActiveSession: () => set({ activeSession: null }),
      finishActiveSession: () => {
        const wasFinished = Boolean(get().activeSession?.finishedAt);
        set((state) => {
          if (!state.activeSession || state.activeSession.finishedAt) {
            return state;
          }

          return completeActiveSessionState(state, state.activeSession);
        });

        if (!wasFinished && get().activeSession?.finishedAt) {
          void flushQuestionProgressPersist();
        }
      },
      ensureTopicQuestionProgressSeeded: () => {
        const state = get();

        if (state.topicQuestionProgressSeeded) {
          return;
        }

        const seededTopicProgress = seedTopicQuestionProgressFromUserState(
          state.questionUserState
        );

        set({
          topicQuestionContextProgress: seededTopicProgress,
          topicQuestionProgress: seededTopicProgress,
          topicQuestionProgressSeeded: true,
        });
      },
      replaceQuestionUserState: (questionUserState) =>
        set({
          questionUserState: normalizeQuestionUserStateMap(questionUserState),
        }),
      reconcileCatalog: (validQuestionIds) =>
        set((state) => {
          const activeSession = reconcileSessionWithCatalog(
            state.activeSession,
            validQuestionIds
          );
          const homeDailySession = reconcileSessionWithCatalog(
            state.homeDailySession,
            validQuestionIds
          );

          return {
            activeSession,
            homeDailySession,
          };
        }),
      recordTrainingSessionPercent: ({ key, percent }) =>
        set((state) => ({
          lastTrainingSessionPercents: {
            ...state.lastTrainingSessionPercents,
            [key]: percent,
          },
        })),
      resetProgress: () =>
        set({
          activeSession: null,
          attempts: [],
          homeDailySession: null,
          lastTrainingSessionPercents: {},
          questionUserState: {},
          readinessAssessment: null,
          topicQuestionContextProgress: {},
          topicQuestionProgress: {},
          topicQuestionProgressSeeded: true,
        }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      pauseActiveSessionTimer: () =>
        set((state) => {
          if (!state.activeSession) {
            return state;
          }

          const nextSession = pauseQuestionSessionTimer(state.activeSession);
          return nextSession === state.activeSession
            ? state
            : {
                activeSession: nextSession,
                homeDailySession: pinDailySession(
                  state.homeDailySession,
                  nextSession
                ),
              };
        }),
      resumeActiveSessionTimer: () =>
        set((state) => {
          if (!state.activeSession) {
            return state;
          }

          const nextSession = resumeQuestionSessionTimer(state.activeSession);
          return nextSession === state.activeSession
            ? state
            : {
                activeSession: nextSession,
                homeDailySession: pinDailySession(
                  state.homeDailySession,
                  nextSession
                ),
              };
        }),
      startOrResumeSession: (request) => {
        const state = get();

        if (isHomeDailySessionKey(request.sessionKey)) {
          const pinned = state.homeDailySession;

          if (
            pinned &&
            isSameHomeDailySession(
              pinned.request.sessionKey,
              request.sessionKey
            ) &&
            pinned.request.currentCategory === request.currentCategory &&
            !pinned.emptyReason &&
            pinned.questionIds.length > 0
          ) {
            const resumed = resumeHomeDailySession(pinned);
            set({
              activeSession: resumed,
              homeDailySession: resumed,
            });
            return resumed;
          }

          const session = buildQuestionSession(
            request,
            state.questionUserState,
            new Date(),
            state.topicQuestionContextProgress
          );
          set({
            activeSession: session,
            homeDailySession: session,
          });
          return session;
        }

        const activeSession = state.activeSession;

        if (activeSession && canResumeQuestionSession(activeSession, request)) {
          if (isQuestionSessionExpired(activeSession)) {
            const finishedSession = finishQuestionSession(activeSession);
            const readinessAssessment =
              buildReadinessAssessmentResult(finishedSession) ??
              get().readinessAssessment;

            set({
              activeSession: finishedSession,
              readinessAssessment,
            });
            return finishedSession;
          }

          const resumedSession = resumeQuestionSession(activeSession, request);

          if (resumedSession !== activeSession) {
            set({ activeSession: resumedSession });
          }

          return resumedSession;
        }

        const session = buildQuestionSession(
          request,
          state.questionUserState,
          new Date(),
          state.topicQuestionContextProgress
        );
        set({ activeSession: session });
        return session;
      },
      toggleBookmark: (questionId) => {
        const state = get();
        const currentState = getQuestionUserState(state.questionUserState, questionId);
        const nextValue = !currentState.isBookmarked;

        set({
          questionUserState: {
            ...state.questionUserState,
            [questionId]: {
              ...currentState,
              isBookmarked: nextValue,
            },
          },
        });

        return nextValue;
      },
      toggleHard: (questionId) => {
        const state = get();
        const currentState = getQuestionUserState(state.questionUserState, questionId);
        const nextValue = !currentState.isHard;

        set({
          questionUserState: {
            ...state.questionUserState,
            [questionId]: {
              ...currentState,
              isHard: nextValue,
              reviewDueAt: nextValue
                ? new Date().toISOString()
                : currentState.reviewDueAt,
            },
          },
        });

        return nextValue;
      },
    }),
    {
      name: "prawko-question-progress:PL",
      skipHydration: true,
      storage: createDeferredProgressStorage(),
      partialize: (state) => ({
        activeSession: state.activeSession,
        attempts: state.attempts,
        homeDailySession: state.homeDailySession,
        lastTrainingSessionPercents: state.lastTrainingSessionPercents,
        questionUserState: state.questionUserState,
        readinessAssessment: state.readinessAssessment,
        topicQuestionContextProgress: state.topicQuestionContextProgress,
        topicQuestionProgress: state.topicQuestionProgress,
        topicQuestionProgressSeeded: state.topicQuestionProgressSeeded,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<
          PersistedQuestionProgress
        > & {
          topicQuestionContextProgress?: TopicQuestionProgressMap | null;
          topicQuestionProgress?: TopicQuestionProgressMap | null;
        };
        const questionUserState = normalizeQuestionUserStateMap(
          persisted.questionUserState ?? currentState.questionUserState
        );
        const lastTrainingSessionPercents =
          persisted.lastTrainingSessionPercents &&
          typeof persisted.lastTrainingSessionPercents === "object"
            ? persisted.lastTrainingSessionPercents
            : currentState.lastTrainingSessionPercents;
        // Legacy saves omit topic progress; seed after the question bank loads.
        const hasTopicProgressField =
          Object.prototype.hasOwnProperty.call(
            persisted,
            "topicQuestionProgress"
          ) ||
          Object.prototype.hasOwnProperty.call(
            persisted,
            "topicQuestionProgressSeeded"
          );
        const topicProgressNeedsReseed =
          hasRetiredTopicProgress(persisted.topicQuestionProgress) ||
          hasRetiredTopicProgress(persisted.topicQuestionContextProgress);

        return {
          ...currentState,
          ...persisted,
          activeSession: normalizePersistedSessionTopic(
            persisted.activeSession ?? currentState.activeSession
          ),
          homeDailySession: normalizePersistedSessionTopic(
            persisted.homeDailySession ?? currentState.homeDailySession
          ),
          lastTrainingSessionPercents,
          questionUserState,
          topicQuestionProgress:
            hasTopicProgressField && !topicProgressNeedsReseed
            ? (persisted.topicQuestionProgress ?? {})
            : {},
          // Until this split, topicQuestionProgress held the same
          // topic-specific queue context. Preserve it for resumed learning.
          topicQuestionContextProgress:
            topicProgressNeedsReseed
              ? {}
              : (persisted.topicQuestionContextProgress ??
                (hasTopicProgressField
                  ? persisted.topicQuestionProgress ?? {}
                  : {})),
          topicQuestionProgressSeeded:
            hasTopicProgressField && !topicProgressNeedsReseed
            ? (persisted.topicQuestionProgressSeeded ?? true)
            : false,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.replaceQuestionUserState(
            normalizeQuestionUserStateMap(state.questionUserState)
          );
        }

        state?.setHasHydrated(true);
      },
    }
  )
);

pauseTimedSessionForBackground = () => {
  useQuestionProgressStore.getState().pauseActiveSessionTimer();
};

export function useActiveQuestionSession() {
  return useQuestionProgressStore((state) => state.activeSession);
}

export function useQuestionProgressHydrated() {
  return useQuestionProgressStore((state) => state.hasHydrated);
}

function reconcileSessionWithCatalog(
  session: QuestionSession | null,
  validQuestionIds: string[]
) {
  if (!session) {
    return null;
  }

  const validQuestionIdSet = new Set(validQuestionIds);
  const filteredQuestionIds = session.questionIds.filter((questionId) =>
    validQuestionIdSet.has(questionId)
  );

  if (filteredQuestionIds.length === 0) {
    return null;
  }

  const filteredAnswers = Object.fromEntries(
    Object.entries(session.answers).filter(([questionId]) =>
      validQuestionIdSet.has(questionId)
    )
  ) as QuestionSession["answers"];
  const currentQuestionId = session.questionIds[session.currentIndex];
  const hasCurrentQuestion =
    typeof currentQuestionId === "string" &&
    validQuestionIdSet.has(currentQuestionId);
  const currentIndex = hasCurrentQuestion
    ? filteredQuestionIds.indexOf(currentQuestionId)
    : getFallbackSessionIndex(filteredQuestionIds, filteredAnswers);
  const normalizedCurrentIndex =
    currentIndex >= 0
      ? currentIndex
      : Math.max(
          0,
          Math.min(session.currentIndex, filteredQuestionIds.length - 1)
        );
  const answeredCount = Object.keys(filteredAnswers).length;
  const finishedAt =
    answeredCount >= filteredQuestionIds.length
      ? session.finishedAt ?? new Date().toISOString()
      : null;

  return {
    ...session,
    answers: filteredAnswers,
    currentIndex: normalizedCurrentIndex,
    emptyReason: null,
    finishedAt,
    questionIds: filteredQuestionIds,
  };
}

function hasRetiredTopicProgress(
  topicProgress: TopicQuestionProgressMap | null | undefined
) {
  return Object.keys(topicProgress ?? {}).some((topicId) => {
    const normalizedTopicId = normalizeQuestionTopicId(topicId);

    return Boolean(
      normalizedTopicId &&
        !isQuestionTopicId(topicId) &&
        !isTopicBlockId(topicId)
    );
  });
}

function normalizePersistedSessionTopic(
  session: QuestionSession | null
): QuestionSession | null {
  const sessionTopic = session?.request.topic;
  const normalizedTopicId =
    typeof sessionTopic === "string"
      ? normalizeQuestionTopicId(sessionTopic)
      : null;

  if (!session || !normalizedTopicId || normalizedTopicId === sessionTopic) {
    return session;
  }

  return {
    ...session,
    request: {
      ...session.request,
      topic: normalizedTopicId,
    },
  };
}

function getFallbackSessionIndex(
  questionIds: string[],
  answers: QuestionSession["answers"]
) {
  const firstUnansweredIndex = questionIds.findIndex(
    (questionId) => !answers[questionId]
  );

  if (firstUnansweredIndex >= 0) {
    return firstUnansweredIndex;
  }

  return Math.max(0, questionIds.length - 1);
}

function completeActiveSessionState(
  state: Pick<QuestionProgressState, "homeDailySession" | "readinessAssessment">,
  session: QuestionSession
) {
  const finishedSession = finishQuestionSession(session);
  const readinessAssessment =
    state.readinessAssessment ??
    buildReadinessAssessmentResult(finishedSession);

  return {
    activeSession: finishedSession,
    homeDailySession: pinDailySession(state.homeDailySession, finishedSession),
    readinessAssessment,
  };
}

function pinDailySession(
  currentPinned: QuestionSession | null,
  session: QuestionSession | null
) {
  if (session != null && isHomeDailySessionKey(session.request.sessionKey)) {
    return session;
  }

  return currentPinned;
}
