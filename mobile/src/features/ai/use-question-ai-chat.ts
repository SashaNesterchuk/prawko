import { AI_LIMITS, type SupportedLocale } from "@prawko/config";
import type { QuestionChatRequest } from "@prawko/schemas";
import { useEffect, useMemo, useState } from "react";

import { useAiConversation, useAiChatHydrated, useAiChatStore } from "../../state/ai-chat";
import { useQuestionCatalogVersion } from "../../state/question-catalog";
import { useErrorLogger } from "../../providers/ErrorLoggingProvider";
import { createAiMessageId } from "./create-ai-id";
import { createIntroAiMessage } from "./mock-question-chat";
import { PREGENERATED_EXPLANATION_MODEL } from "./pregenerated-question-explanation";
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
  const { captureError, captureFallback } = useErrorLogger();
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

      if (response.fallbackUsed) {
        captureFallback({
          area: "question_chat",
          eventName: "question_chat_fallback_used",
          message:
            response.model === PREGENERATED_EXPLANATION_MODEL
              ? "Question chat used the pre-generated explanation fallback."
              : "Question chat used the local fallback assistant response.",
          metadata: {
            conversation_id: targetConversation.conversationId,
            fallback_kind:
              response.model === PREGENERATED_EXPLANATION_MODEL
                ? "pre_generated_explanation"
                : "local_fallback",
            model: response.model,
            provider: response.provider,
            question_id: questionContext.questionId,
            remaining_free_messages: response.remainingFreeMessages ?? null,
          },
        });
      }

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
      if (!(error instanceof QuestionChatLimitError)) {
        captureError({
          area: "question_chat",
          error,
          eventName: "question_chat_send_failed",
          message: "Failed to send the question chat request.",
          metadata: {
            conversation_id: targetConversation.conversationId,
            question_id: questionContext.questionId,
          },
        });
      }
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
