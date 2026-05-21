import { create } from "zustand";

import { getQuestionBank } from "../features/questions/question-bank";

export type QuestionCatalogStatus = "mock" | "loading" | "remote" | "error";

type QuestionCatalogState = {
  lastError: string | null;
  questionCount: number;
  setError: (input: { error: string; questionCount: number }) => void;
  setLoading: () => void;
  setMock: (input: { questionCount: number }) => void;
  setRemote: (input: { questionCount: number }) => void;
  status: QuestionCatalogStatus;
  version: number;
};

export const useQuestionCatalogStore = create<QuestionCatalogState>((set) => ({
  lastError: null,
  questionCount: getQuestionBank().length,
  setError: ({ error, questionCount }) =>
    set((state) => ({
      lastError: error,
      questionCount,
      status: "error",
      version: state.version + 1,
    })),
  setLoading: () =>
    set({
      lastError: null,
      status: "loading",
    }),
  setMock: ({ questionCount }) =>
    set((state) => ({
      lastError: null,
      questionCount,
      status: "mock",
      version: state.version + 1,
    })),
  setRemote: ({ questionCount }) =>
    set((state) => ({
      lastError: null,
      questionCount,
      status: "remote",
      version: state.version + 1,
    })),
  status: "mock",
  version: 0,
}));

export function useQuestionCatalogVersion() {
  return useQuestionCatalogStore((state) => state.version);
}

export function useQuestionCatalogStatus() {
  return useQuestionCatalogStore((state) => state.status);
}

export function useQuestionCatalogCount() {
  return useQuestionCatalogStore((state) => state.questionCount);
}

export function useQuestionCatalogLastError() {
  return useQuestionCatalogStore((state) => state.lastError);
}
