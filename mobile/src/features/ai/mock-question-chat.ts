import type {
  QuestionChatContext,
  QuestionChatMessage,
  QuestionChatRequest,
  QuestionChatResponse,
} from "@prawko/schemas";

import {
  createPreGeneratedExplanationMessage,
  createPreGeneratedQuestionChatResponse,
  PREGENERATED_EXPLANATION_MODEL,
  PREGENERATED_EXPLANATION_PROVIDER,
} from "./pregenerated-question-explanation";

export function createMockQuestionChatResponse(
  request: QuestionChatRequest
): QuestionChatResponse {
  return createPreGeneratedQuestionChatResponse(request);
}

export function createIntroAiMessage(
  context: QuestionChatContext
): QuestionChatMessage {
  return createPreGeneratedExplanationMessage(context);
}

export const MOCK_PROVIDER = PREGENERATED_EXPLANATION_PROVIDER;
export const MOCK_MODEL = PREGENERATED_EXPLANATION_MODEL;
