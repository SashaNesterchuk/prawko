import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  buildQuestionSession,
  getQuestionById,
  getNextQuestionUserStateAfterAttempt,
  getQuestionUserState,
  normalizeQuestionUserStateMap,
} from "../features/questions/question-engine";
import type {
  QuestionAttempt,
  QuestionOptionValue,
  QuestionSession,
  QuestionSessionRequest,
  QuestionUserStateMap,
} from "../features/questions/types";

type QuestionProgressState = {
  activeSession: QuestionSession | null;
  attempts: QuestionAttempt[];
  hasHydrated: boolean;
  questionUserState: QuestionUserStateMap;
  advanceSession: () => void;
  answerCurrentQuestion: (
    selectedAnswer: QuestionOptionValue
  ) => QuestionAttempt | null;
  clearActiveSession: () => void;
  replaceQuestionUserState: (
    questionUserState: QuestionUserStateMap
  ) => void;
  reconcileCatalog: (validQuestionIds: string[]) => void;
  resetProgress: () => void;
  setHasHydrated: (value: boolean) => void;
  startSession: (request: QuestionSessionRequest) => QuestionSession;
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

        set((currentState) => ({
          attempts: [...currentState.attempts, attempt],
          questionUserState: {
            ...currentState.questionUserState,
            [questionId]: nextState,
          },
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
      },
      clearActiveSession: () => set({ activeSession: null }),
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
        }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
      startSession: (request) => {
        const session = buildQuestionSession(request, get().questionUserState);
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
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeSession: state.activeSession,
        attempts: state.attempts,
        questionUserState: state.questionUserState,
      }),
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
