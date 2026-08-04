import { isTopicBlockId } from "@prawko/config";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";

import {
  buildQuestionSession,
  canResumeQuestionSession,
  getQuestionById,
  getNextQuestionUserStateAfterAttempt,
  getNextTopicQuestionProgressAfterAttempt,
  getQuestionUserState,
  getTopicQuestionProgress,
  normalizeQuestionUserStateMap,
  resumeQuestionSession,
  seedTopicQuestionProgressFromUserState,
} from "../features/questions/question-engine";
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
  | "questionUserState"
  | "topicQuestionProgress"
  | "topicQuestionProgressSeeded"
>;

const PERSIST_FLUSH_DELAY_MS = 800;

/**
 * Answering a question rewrites the whole progress blob, and serializing it is
 * heavy enough to be felt on tap. Writes are batched and the JSON is built at
 * flush time, off the interaction frame.
 */
function createDeferredProgressStorage(): PersistStorage<PersistedQuestionProgress> {
  const pendingWrites = new Map<string, StorageValue<PersistedQuestionProgress>>();
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }

    if (pendingWrites.size === 0) {
      return;
    }

    const entries = [...pendingWrites.entries()].map(
      ([name, value]) => [name, JSON.stringify(value)] as [string, string]
    );
    pendingWrites.clear();

    void AsyncStorage.multiSet(entries).catch((error) => {
      console.warn("Failed to persist question progress.", error);
    });
  };

  AppState.addEventListener("change", (nextState) => {
    if (nextState !== "active") {
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
  questionUserState: QuestionUserStateMap;
  topicQuestionProgress: TopicQuestionProgressMap;
  /** False only for pre-scoped saves until the catalog can attribute legacy attempts. */
  topicQuestionProgressSeeded: boolean;
  applyQuestionAttemptOutcome: (
    questionId: string,
    input: {
      answeredAt: string;
      isCorrect: boolean;
    }
  ) => void;
  advanceSession: () => void;
  retreatSession: () => void;
  answerCurrentQuestion: (
    selectedAnswer: QuestionOptionValue
  ) => QuestionAttempt | null;
  clearActiveSession: () => void;
  ensureTopicQuestionProgressSeeded: () => void;
  replaceQuestionUserState: (
    questionUserState: QuestionUserStateMap
  ) => void;
  reconcileCatalog: (validQuestionIds: string[]) => void;
  resetProgress: () => void;
  setHasHydrated: (value: boolean) => void;
  startOrResumeSession: (request: QuestionSessionRequest) => QuestionSession;
  toggleBookmark: (questionId: string) => boolean;
  toggleHard: (questionId: string) => boolean;
};

export const useQuestionProgressStore = create<QuestionProgressState>()(
  persist(
    (set, get) => ({
      activeSession: null,
      attempts: [],
      hasHydrated: false,
      questionUserState: {},
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
      advanceSession: () =>
        set((state) => {
          if (!state.activeSession) {
            return state;
          }

          const answeredCount = Object.keys(state.activeSession.answers).length;
          const isLastQuestion =
            state.activeSession.currentIndex >=
            state.activeSession.questionIds.length - 1;

          if (isLastQuestion || answeredCount >= state.activeSession.questionIds.length) {
            return {
              activeSession: {
                ...state.activeSession,
                finishedAt: new Date().toISOString(),
              },
            };
          }

          return {
            activeSession: {
              ...state.activeSession,
              currentIndex: state.activeSession.currentIndex + 1,
            },
          };
        }),
      retreatSession: () =>
        set((state) => {
          if (!state.activeSession || state.activeSession.currentIndex <= 0) {
            return state;
          }

          return {
            activeSession: {
              ...state.activeSession,
              currentIndex: state.activeSession.currentIndex - 1,
              finishedAt: null,
            },
          };
        }),
      answerCurrentQuestion: (selectedAnswer) => {
        const state = get();
        const activeSession = state.activeSession;

        if (!activeSession || activeSession.finishedAt) {
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
          set((currentState) => ({
            activeSession: currentState.activeSession
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
              : null,
          }));

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
        const sessionTopic = activeSession.request.topic;
        const shouldScopeToTopic =
          typeof sessionTopic === "string" && !isTopicBlockId(sessionTopic);
        const previousTopicProgress = shouldScopeToTopic
          ? getTopicQuestionProgress(
              state.topicQuestionProgress,
              sessionTopic,
              questionId
            )
          : null;
        const nextTopicProgress = previousTopicProgress
          ? getNextTopicQuestionProgressAfterAttempt(previousTopicProgress, {
              answeredAt,
              isCorrect,
            })
          : null;

        set((currentState) => {
          const nextTopicQuestionProgress =
            shouldScopeToTopic && nextTopicProgress
              ? {
                  ...currentState.topicQuestionProgress,
                  [sessionTopic]: {
                    ...currentState.topicQuestionProgress[sessionTopic],
                    [questionId]: nextTopicProgress,
                  },
                }
              : currentState.topicQuestionProgress;

          return {
            attempts: [...currentState.attempts, attempt],
            questionUserState: {
              ...currentState.questionUserState,
              [questionId]: nextState,
            },
            topicQuestionProgress: nextTopicQuestionProgress,
            activeSession: currentState.activeSession
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
              : null,
          };
        });

        return attempt;
      },
      clearActiveSession: () => set({ activeSession: null }),
      ensureTopicQuestionProgressSeeded: () => {
        const state = get();

        if (state.topicQuestionProgressSeeded) {
          return;
        }

        set({
          topicQuestionProgress: seedTopicQuestionProgressFromUserState(
            state.questionUserState
          ),
          topicQuestionProgressSeeded: true,
        });
      },
      replaceQuestionUserState: (questionUserState) =>
        set({
          questionUserState: normalizeQuestionUserStateMap(questionUserState),
        }),
      reconcileCatalog: (validQuestionIds) =>
        set((state) => ({
          activeSession: reconcileSessionWithCatalog(
            state.activeSession,
            validQuestionIds
          ),
        })),
      resetProgress: () =>
        set({
          activeSession: null,
          attempts: [],
          questionUserState: {},
          topicQuestionProgress: {},
          topicQuestionProgressSeeded: true,
        }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      startOrResumeSession: (request) => {
        const activeSession = get().activeSession;

        if (activeSession && canResumeQuestionSession(activeSession, request)) {
          const resumedSession = resumeQuestionSession(activeSession, request);

          if (resumedSession !== activeSession) {
            set({ activeSession: resumedSession });
          }

          return resumedSession;
        }

        const state = get();
        const session = buildQuestionSession(
          request,
          state.questionUserState,
          new Date(),
          state.topicQuestionProgress
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
      name: "prawko-question-progress",
      storage: createDeferredProgressStorage(),
      partialize: (state) => ({
        activeSession: state.activeSession,
        attempts: state.attempts,
        questionUserState: state.questionUserState,
        topicQuestionProgress: state.topicQuestionProgress,
        topicQuestionProgressSeeded: state.topicQuestionProgressSeeded,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<
          PersistedQuestionProgress
        > & { topicQuestionProgress?: TopicQuestionProgressMap | null };
        const questionUserState = normalizeQuestionUserStateMap(
          persisted.questionUserState ?? currentState.questionUserState
        );
        // Pre-scoped saves omit the overlay; seed after the question bank loads.
        const hasTopicProgressField =
          Object.prototype.hasOwnProperty.call(
            persisted,
            "topicQuestionProgress"
          ) ||
          Object.prototype.hasOwnProperty.call(
            persisted,
            "topicQuestionProgressSeeded"
          );

        return {
          ...currentState,
          ...persisted,
          questionUserState,
          topicQuestionProgress: hasTopicProgressField
            ? (persisted.topicQuestionProgress ?? {})
            : {},
          topicQuestionProgressSeeded: hasTopicProgressField
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
