import type {
  QuestionChatContext,
  QuestionChatMessage,
  QuestionChatRequest,
  QuestionChatResponse,
} from "@prawko/schemas";

import { createAiMessageId } from "./create-ai-id";
import { getAnswerTextFromContext } from "./question-chat-context";

export const PREGENERATED_EXPLANATION_PROVIDER = "mock";
export const PREGENERATED_EXPLANATION_MODEL = "pre-generated-explanation-v1";

export function createPreGeneratedExplanationMessage(
  context: QuestionChatContext
): QuestionChatMessage {
  return {
    id: createAiMessageId(),
    role: "assistant",
    content: buildPreGeneratedExplanationContent({
      context,
      includeFollowUpHint: true,
    }),
    createdAt: new Date().toISOString(),
    provider: PREGENERATED_EXPLANATION_PROVIDER,
    model: PREGENERATED_EXPLANATION_MODEL,
  };
}

export function createPreGeneratedQuestionChatResponse(
  request: QuestionChatRequest
): QuestionChatResponse {
  const createdAt = new Date().toISOString();

  return {
    conversationId: request.conversationId,
    provider: PREGENERATED_EXPLANATION_PROVIDER,
    model: PREGENERATED_EXPLANATION_MODEL,
    fallbackUsed: true,
    remainingFreeMessages: undefined,
    message: {
      id: createAiMessageId(),
      role: "assistant",
      content: buildPreGeneratedExplanationContent({
        context: request.question,
        prompt: request.prompt,
      }),
      createdAt,
      provider: PREGENERATED_EXPLANATION_PROVIDER,
      model: PREGENERATED_EXPLANATION_MODEL,
    },
  };
}

export function buildPreGeneratedExplanationContent(input: {
  context: QuestionChatContext;
  includeFollowUpHint?: boolean;
  prompt?: string;
}) {
  const intent = getPromptIntent(input.prompt, input.context.locale);
  const statusLine = buildStatusLine(input.context);
  const explanation = input.context.explanation.trim();
  const memoryRule = getMemoryRule(input.context.locale);
  const mistakeLine = getMistakeLine(input.context.locale);
  const followUpHint = input.includeFollowUpHint
    ? getFollowUpHint(input.context.locale)
    : "";

  if (input.context.locale === "pl") {
    if (intent === "memory") {
      return `${statusLine} Regula do zapamietania: ${memoryRule} Dlaczego tak: ${explanation}${followUpHint}`;
    }

    if (intent === "mistake") {
      return `${statusLine} Najczestsza pomylka: ${mistakeLine} Dlaczego tak: ${explanation} Regula do zapamietania: ${memoryRule}${followUpHint}`;
    }

    return `${statusLine} Dlaczego tak: ${explanation} Regula do zapamietania: ${memoryRule}${followUpHint}`;
  }

  if (input.context.locale === "en") {
    if (intent === "memory") {
      return `${statusLine} Memory rule: ${memoryRule} Why this is correct: ${explanation}${followUpHint}`;
    }

    if (intent === "mistake") {
      return `${statusLine} Common mistake: ${mistakeLine} Why this is correct: ${explanation} Memory rule: ${memoryRule}${followUpHint}`;
    }

    return `${statusLine} Why this is correct: ${explanation} Memory rule: ${memoryRule}${followUpHint}`;
  }

  if (intent === "memory") {
    return `${statusLine} Правило для запам'ятовування: ${memoryRule} Чому так: ${explanation}${followUpHint}`;
  }

  if (intent === "mistake") {
    return `${statusLine} Типова помилка: ${mistakeLine} Чому так: ${explanation} Правило для запам'ятовування: ${memoryRule}${followUpHint}`;
  }

  return `${statusLine} Чому так: ${explanation} Правило для запам'ятовування: ${memoryRule}${followUpHint}`;
}

function buildStatusLine(context: QuestionChatContext) {
  const correctAnswer = getAnswerTextFromContext(context, context.correctAnswer);
  const selectedAnswer = getAnswerTextFromContext(context, context.selectedAnswer);
  const selectedIsCorrect =
    Boolean(context.selectedAnswer) && context.selectedAnswer === context.correctAnswer;

  if (context.locale === "pl") {
    if (context.selectedAnswer) {
      return selectedIsCorrect
        ? `Wybrales poprawna odpowiedz: ${selectedAnswer}.`
        : `Wybrales ${selectedAnswer}, ale poprawna odpowiedz to ${correctAnswer}.`;
    }

    return `Poprawna odpowiedz to ${correctAnswer}.`;
  }

  if (context.locale === "en") {
    if (context.selectedAnswer) {
      return selectedIsCorrect
        ? `You chose the correct answer: ${selectedAnswer}.`
        : `You chose ${selectedAnswer}, but the correct answer is ${correctAnswer}.`;
    }

    return `The correct answer is ${correctAnswer}.`;
  }

  if (context.selectedAnswer) {
    return selectedIsCorrect
      ? `Ти вибрав правильну відповідь: ${selectedAnswer}.`
      : `Ти вибрав ${selectedAnswer}, але правильна відповідь: ${correctAnswer}.`;
  }

  return `Правильна відповідь: ${correctAnswer}.`;
}

function getPromptIntent(
  prompt: string | undefined,
  locale: QuestionChatContext["locale"]
) {
  const normalizedPrompt = prompt?.trim().toLowerCase() ?? "";

  if (!normalizedPrompt) {
    return "why";
  }

  if (locale === "pl") {
    if (
      normalizedPrompt.includes("zapam") ||
      normalizedPrompt.includes("regul") ||
      normalizedPrompt.includes("egz")
    ) {
      return "memory";
    }

    if (
      normalizedPrompt.includes("blad") ||
      normalizedPrompt.includes("pomyl") ||
      normalizedPrompt.includes("wrong")
    ) {
      return "mistake";
    }
  }

  if (locale === "en") {
    if (
      normalizedPrompt.includes("remember") ||
      normalizedPrompt.includes("rule") ||
      normalizedPrompt.includes("exam")
    ) {
      return "memory";
    }

    if (
      normalizedPrompt.includes("mistake") ||
      normalizedPrompt.includes("wrong")
    ) {
      return "mistake";
    }
  }

  if (
    normalizedPrompt.includes("запам") ||
    normalizedPrompt.includes("правил") ||
    normalizedPrompt.includes("іспит") ||
    normalizedPrompt.includes("exam")
  ) {
    return "memory";
  }

  if (
    normalizedPrompt.includes("помил") ||
    normalizedPrompt.includes("не так") ||
    normalizedPrompt.includes("wrong")
  ) {
    return "mistake";
  }

  return "why";
}

function getMemoryRule(locale: QuestionChatContext["locale"]) {
  if (locale === "pl") {
    return "Patrz na dokladna zasade z pytania i wybieraj odpowiedz, ktora pasuje do niej 1:1, a nie tylko brzmi bezpiecznie.";
  }

  if (locale === "en") {
    return "Look for the exact rule being tested and choose the option that matches it 1:1, not the one that merely sounds safe.";
  }

  return "Шукай точне правило з питання і обирай варіант, що збігається з ним 1:1, а не просто звучить безпечніше.";
}

function getMistakeLine(locale: QuestionChatContext["locale"]) {
  if (locale === "pl") {
    return "Zgadywanie po intuicji albo wybieranie odpowiedzi, ktora brzmi ogolnie najbezpieczniej.";
  }

  if (locale === "en") {
    return "Guessing from intuition or choosing the option that sounds generally safest.";
  }

  return "Вгадування по інтуїції або вибір варіанта, який просто звучить найбезпечніше.";
}

function getFollowUpHint(locale: QuestionChatContext["locale"]) {
  if (locale === "pl") {
    return " Mozesz dopytac o typowy blad albo o krotka regule na egzamin.";
  }

  if (locale === "en") {
    return " You can ask for the common mistake or for a short exam-day rule.";
  }

  return " Можеш ще спитати про типову помилку або коротке правило перед іспитом.";
}
