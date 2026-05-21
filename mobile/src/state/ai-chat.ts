import AsyncStorage from "@react-native-async-storage/async-storage";
import { AI_LIMITS, type SupportedLocale } from "@prawko/config";
import type { QuestionChatMessage } from "@prawko/schemas";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createAiUuid } from "../features/ai/create-ai-id";

type AiConversation = {
  conversationId: string;
  questionId: string;
  locale: SupportedLocale;
  messages: QuestionChatMessage[];
  updatedAt: string;
};

type AiChatState = {
  assistantResponsesByDate: Record<string, number>;
  conversations: Record<string, AiConversation>;
  hasHydrated: boolean;
  latestConversationByQuestionId: Record<string, string>;
  appendMessage: (input: {
    conversationId: string;
    locale: SupportedLocale;
    message: QuestionChatMessage;
    questionId: string;
  }) => void;
  consumeAssistantResponse: () => number;
  ensureConversation: (input: {
    locale: SupportedLocale;
    questionId: string;
    seedMessage?: QuestionChatMessage;
  }) => AiConversation;
  getRemainingAssistantResponses: () => number;
  setHasHydrated: (value: boolean) => void;
};

export const useAiChatStore = create<AiChatState>()(
  persist(
    (set, get) => ({
      assistantResponsesByDate: {},
      conversations: {},
      hasHydrated: false,
      latestConversationByQuestionId: {},
      appendMessage: ({ conversationId, locale, message, questionId }) =>
        set((state) => {
          const existingConversation =
            state.conversations[conversationId] ??
            createEmptyConversation({
              conversationId,
              locale,
              questionId,
            });

          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...existingConversation,
                locale,
                questionId,
                messages: [...existingConversation.messages, message],
                updatedAt: message.createdAt,
              },
            },
            latestConversationByQuestionId: {
              ...state.latestConversationByQuestionId,
              [questionId]: conversationId,
            },
          };
        }),
      consumeAssistantResponse: () => {
        const state = get();
        const todayKey = getTodayKey();
        const nextUsed = (state.assistantResponsesByDate[todayKey] ?? 0) + 1;

        set({
          assistantResponsesByDate: {
            ...state.assistantResponsesByDate,
            [todayKey]: nextUsed,
          },
        });

        return Math.max(0, AI_LIMITS.freeQuestionChatPerDay - nextUsed);
      },
      ensureConversation: ({ locale, questionId, seedMessage }) => {
        const state = get();
        const existingConversationId = state.latestConversationByQuestionId[questionId];

        if (existingConversationId && state.conversations[existingConversationId]) {
          return state.conversations[existingConversationId];
        }

        const createdAt = seedMessage?.createdAt ?? new Date().toISOString();
        const conversationId = createAiUuid();
        const nextConversation: AiConversation = {
          conversationId,
          questionId,
          locale,
          messages: seedMessage ? [seedMessage] : [],
          updatedAt: createdAt,
        };

        set({
          conversations: {
            ...state.conversations,
            [conversationId]: nextConversation,
          },
          latestConversationByQuestionId: {
            ...state.latestConversationByQuestionId,
            [questionId]: conversationId,
          },
        });

        return nextConversation;
      },
      getRemainingAssistantResponses: () => {
        const usedToday = get().assistantResponsesByDate[getTodayKey()] ?? 0;

        return Math.max(0, AI_LIMITS.freeQuestionChatPerDay - usedToday);
      },
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "prawko-ai-chat",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        assistantResponsesByDate: state.assistantResponsesByDate,
        conversations: state.conversations,
        latestConversationByQuestionId: state.latestConversationByQuestionId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

export function useAiChatHydrated() {
  return useAiChatStore((state) => state.hasHydrated);
}

export function useAiConversation(questionId: string | null) {
  return useAiChatStore((state) => {
    if (!questionId) {
      return null;
    }

    const conversationId = state.latestConversationByQuestionId[questionId];

    return conversationId ? state.conversations[conversationId] ?? null : null;
  });
}

function createEmptyConversation(input: {
  conversationId: string;
  locale: SupportedLocale;
  questionId: string;
}): AiConversation {
  return {
    conversationId: input.conversationId,
    questionId: input.questionId,
    locale: input.locale,
    messages: [],
    updatedAt: new Date().toISOString(),
  };
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}
