import { AI_LIMITS, type SupportedLocale } from "@prawko/config";
import type { QuestionChatRequest } from "@prawko/schemas";
import { useEffect, useMemo, useState } from "react";

import { useAiConversation, useAiChatHydrated, useAiChatStore } from "../../state/ai-chat";
import { useQuestionCatalogVersion } from "../../state/question-catalog";
import { createAiMessageId } from "./create-ai-id";
import { createIntroAiMessage } from "./mock-question-chat";
import { buildQuestionChatContext } from "./question-chat-context";
import {
  QuestionChatLimitError,
  requestQuestionChat,
} from "./question-chat-client";
import type { QuestionOptionValue } from "../questions/types";

export function useQuestionAiChat(input: {
  locale: SupportedLocale;
  questionId: string | null;
  selectedAnswer?: QuestionOptionValue;
  unlimitedAssistantResponses?: boolean;
}) {
  const aiChatHydrated = useAiChatHydrated();
  const conversation = useAiConversation(input.questionId);
  const questionCatalogVersion = useQuestionCatalogVersion();
  const ensureConversation = useAiChatStore((state) => state.ensureConversation);
  const appendMessage = useAiChatStore((state) => state.appendMessage);
  const consumeAssistantResponse = useAiChatStore(
    (state) => state.consumeAssistantResponse
  );
  const remainingAssistantResponses = useAiChatStore((state) =>
    state.getRemainingAssistantResponses()
  );
  const [draft, setDraft] = useState("");
  const [errorCode, setErrorCode] = useState<
    "missing_question" | "limit_reached" | "send_failed" | null
  >(null);
  const [isSending, setIsSending] = useState(false);

  const questionContext = useMemo(
    () =>
      input.questionId
        ? buildQuestionChatContext({
            questionId: input.questionId,
            locale: input.locale,
            selectedAnswer: input.selectedAnswer,
          })
        : null,
    [
      input.locale,
      input.questionId,
      input.selectedAnswer,
      questionCatalogVersion,
    ]
  );

  useEffect(() => {
    if (!aiChatHydrated || !questionContext || conversation) {
      return;
    }

    ensureConversation({
      locale: input.locale,
      questionId: questionContext.questionId,
      seedMessage: createIntroAiMessage(questionContext),
    });
  }, [
    aiChatHydrated,
    conversation,
    ensureConversation,
    input.locale,
    questionContext,
  ]);

  async function sendMessage(nextPrompt?: string) {
    const prompt = (nextPrompt ?? draft).trim();

    if (!questionContext) {
      setErrorCode("missing_question");
      return;
    }

    if (!prompt || isSending) {
      return;
    }

    if (!input.unlimitedAssistantResponses && remainingAssistantResponses <= 0) {
      setErrorCode("limit_reached");
      return;
    }

    const targetConversation =
      conversation ??
      ensureConversation({
        locale: input.locale,
        questionId: questionContext.questionId,
        seedMessage: createIntroAiMessage(questionContext),
      });
    const userMessage = {
      id: createAiMessageId(),
      role: "user" as const,
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    const history = [...targetConversation.messages, userMessage].slice(
      -AI_LIMITS.maxHistoryMessages
    );
    const request: QuestionChatRequest = {
      conversationId: targetConversation.conversationId,
      locale: input.locale,
      prompt,
      question: questionContext,
      history,
    };

    appendMessage({
      conversationId: targetConversation.conversationId,
      locale: input.locale,
      message: userMessage,
      questionId: questionContext.questionId,
    });
    setDraft("");
    setErrorCode(null);
    setIsSending(true);

    try {
      const response = await requestQuestionChat(request);

      appendMessage({
        conversationId: targetConversation.conversationId,
        locale: input.locale,
        message: response.message,
        questionId: questionContext.questionId,
      });
      if (!input.unlimitedAssistantResponses) {
        consumeAssistantResponse();
      }
    } catch (error) {
      setErrorCode(
        error instanceof QuestionChatLimitError ? "limit_reached" : "send_failed"
      );
    } finally {
      setIsSending(false);
    }
  }

  return {
    aiChatHydrated,
    conversation,
    draft,
    errorCode,
    hasUnlimitedAssistantResponses: Boolean(input.unlimitedAssistantResponses),
    isSending,
    limitReached:
      !input.unlimitedAssistantResponses && remainingAssistantResponses <= 0,
    questionContext,
    remainingAssistantResponses: input.unlimitedAssistantResponses
      ? null
      : remainingAssistantResponses,
    sendMessage,
    setDraft,
  };
}
