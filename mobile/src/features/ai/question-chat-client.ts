import { questionChatResponseSchema, type QuestionChatRequest } from "@prawko/schemas";

import { isMobileSupabaseConfigured } from "../../config/env";
import { getMobileSupabaseClient } from "../../lib/supabase";
import { createMockQuestionChatResponse } from "./mock-question-chat";

export class QuestionChatLimitError extends Error {
  constructor() {
    super("question_chat_limit_reached");
  }
}

export async function requestQuestionChat(
  request: QuestionChatRequest
) {
  if (isMobileSupabaseConfigured) {
    try {
      const client = getMobileSupabaseClient();
      const { data, error } = await client.functions.invoke("question-chat", {
        body: request,
      });

      if (error) {
        const status = getHttpStatus(error);

        if (status === 429) {
          throw new QuestionChatLimitError();
        }
      }

      if (!error && data) {
        return questionChatResponseSchema.parse(data);
      }
    } catch (error) {
      if (error instanceof QuestionChatLimitError) {
        throw error;
      }

      // Fall back to the deterministic local adapter when the server path is not ready.
    }
  }

  return createMockQuestionChatResponse(request);
}

function getHttpStatus(error: unknown) {
  const context = (error as { context?: Response }).context;

  return context instanceof Response ? context.status : null;
}
