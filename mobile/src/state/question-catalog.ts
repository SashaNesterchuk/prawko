import { create } from "zustand";

import { getQuestionBank } from "../features/questions/question-bank";

export type QuestionCatalogStatus =
  | "mock"
  | "loading"
  | "remote"
  | "offline"
  | "error";

type QuestionCatalogState = {
  lastError: string | null;
  questionCount: number;
  resolved: boolean;
  setError: (input: { error: string; questionCount: number }) => void;
  setLoading: () => void;
  setMock: (input: { questionCount: number }) => void;
  setOffline: (input: { questionCount: number }) => void;
  setRemote: (input: { questionCount: number }) => void;
  status: QuestionCatalogStatus;
  version: number;
};

export const useQuestionCatalogStore = create<QuestionCatalogState>((set) => ({
  lastError: null,
  questionCount: getQuestionBank().length,
  resolved: false,
  setError: ({ error, questionCount }) =>
    set((state) => ({
      lastError: error,
      questionCount,
      resolved: true,
      status: "error",
      version: state.version + 1,
    })),
  setLoading: () =>
    set({
      lastError: null,
      resolved: false,
      status: "loading",
    }),
  setMock: ({ questionCount }) =>
    set((state) => ({
      lastError: null,
      questionCount,
      resolved: true,
      status: "mock",
      version: state.version + 1,
    })),
  setOffline: ({ questionCount }) =>
    set((state) => ({
      lastError: null,
      questionCount,
      resolved: true,
      status: "offline",
      version: state.version + 1,
    })),
  setRemote: ({ questionCount }) =>
    set((state) => ({
      lastError: null,
      questionCount,
      resolved: true,
      status: "remote",
      version: state.version + 1,
    })),
  status: "loading",
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

export function useQuestionCatalogResolved() {
  return useQuestionCatalogStore((state) => state.resolved);
}
