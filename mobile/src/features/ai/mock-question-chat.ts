import type {
  QuestionChatContext,
  QuestionChatMessage,
  QuestionChatRequest,
  QuestionChatResponse,
} from "@prawko/schemas";

import { createAiMessageId } from "./create-ai-id";
import { getAnswerTextFromContext } from "./question-chat-context";

const MOCK_PROVIDER = "mock";
const MOCK_MODEL = "local-explainer-v1";

export function createMockQuestionChatResponse(
  request: QuestionChatRequest
): QuestionChatResponse {
  const createdAt = new Date().toISOString();

  return {
    conversationId: request.conversationId,
    provider: MOCK_PROVIDER,
    model: MOCK_MODEL,
    fallbackUsed: true,
    remainingFreeMessages: undefined,
    message: {
      id: createAiMessageId(),
      role: "assistant",
      content: buildMockAssistantContent(request.question, request.prompt),
      createdAt,
      provider: MOCK_PROVIDER,
      model: MOCK_MODEL,
    },
  };
}

export function createIntroAiMessage(
  context: QuestionChatContext
): QuestionChatMessage {
  return {
    id: createAiMessageId(),
    role: "assistant",
    content: getIntroMessage(context),
    createdAt: new Date().toISOString(),
    provider: MOCK_PROVIDER,
    model: MOCK_MODEL,
  };
}

function buildMockAssistantContent(
  context: QuestionChatContext,
  userPrompt: string
) {
  const correctAnswer = getAnswerTextFromContext(context, context.correctAnswer);
  const selectedAnswer = getAnswerTextFromContext(context, context.selectedAnswer);
  const selectedIsCorrect =
    Boolean(context.selectedAnswer) && context.selectedAnswer === context.correctAnswer;
  const prompt = userPrompt.toLowerCase();

  if (context.locale === "pl") {
    const statusLine = context.selectedAnswer
      ? selectedIsCorrect
        ? `Wybrales poprawna odpowiedz: ${selectedAnswer}.`
        : `Wybrales ${selectedAnswer}, ale poprawna odpowiedz to ${correctAnswer}.`
      : `Poprawna odpowiedz to ${correctAnswer}.`;

    if (prompt.includes("zapam") || prompt.includes("egz")) {
      return `${statusLine} Zapamietaj trzy rzeczy: temat pytania to ${context.topicBlock}, poprawna odpowiedz wynika z zasady egzaminacyjnej, a nie z intuicji, i ten sam motyw warto powtorzyc w trybie weak spots. ${context.explanation}`;
    }

    if (prompt.includes("blad") || prompt.includes("wrong")) {
      return `${statusLine} Najczestszy blad polega na wybieraniu odpowiedzi, ktora brzmi bezpiecznie, ale nie odpowiada na dokladna zasade z pytania. ${context.explanation}`;
    }

    return `${statusLine} Klucz jest taki: ${context.explanation} Jesli chcesz, moge tez rozbic to na krotka regule do zapamietania przed egzaminem.`;
  }

  if (context.locale === "en") {
    const statusLine = context.selectedAnswer
      ? selectedIsCorrect
        ? `You chose the correct answer: ${selectedAnswer}.`
        : `You chose ${selectedAnswer}, but the correct answer is ${correctAnswer}.`
      : `The correct answer is ${correctAnswer}.`;

    if (prompt.includes("remember") || prompt.includes("exam")) {
      return `${statusLine} Remember three things: this question belongs to ${context.topicBlock}, the correct answer follows an exam rule rather than intuition, and it is worth replaying in weak spots mode. ${context.explanation}`;
    }

    if (prompt.includes("mistake") || prompt.includes("wrong")) {
      return `${statusLine} A common mistake is choosing the option that sounds generally safe instead of the one that matches the exact rule being tested. ${context.explanation}`;
    }

    return `${statusLine} The key idea is this: ${context.explanation} If you want, I can turn it into a short exam-day memory rule.`;
  }

  const statusLine = context.selectedAnswer
    ? selectedIsCorrect
      ? `Ти вибрав правильну відповідь: ${selectedAnswer}.`
      : `Ти вибрав ${selectedAnswer}, але правильна відповідь: ${correctAnswer}.`
    : `Правильна відповідь: ${correctAnswer}.`;

  if (prompt.includes("запам") || prompt.includes("іспит") || prompt.includes("exam")) {
    return `${statusLine} Запам'ятай три речі: питання з теми ${context.topicBlock}, правильний варіант тут спирається на правило, а не на загальну інтуїцію, і цей сюжет варто ще раз прогнати в weak spots. ${context.explanation}`;
  }

  if (prompt.includes("помил") || prompt.includes("wrong")) {
    return `${statusLine} Типова помилка тут - вибрати відповідь, яка звучить безпечно, але не відповідає точному правилу з питання. ${context.explanation}`;
  }

  return `${statusLine} Ключова логіка така: ${context.explanation} Якщо хочеш, я ще можу стиснути це в коротке правило перед іспитом.`;
}

function getIntroMessage(context: QuestionChatContext) {
  if (context.locale === "pl") {
    return `Mozesz zapytac, dlaczego poprawna jest odpowiedz ${context.correctAnswer.toUpperCase()}, jaki blad najczesciej robi student albo co warto zapamietac na egzamin.`;
  }

  if (context.locale === "en") {
    return `Ask why answer ${context.correctAnswer.toUpperCase()} is correct, what mistake is most common here, or what rule is worth remembering for the exam.`;
  }

  return `Можеш спитати, чому правильна відповідь ${context.correctAnswer.toUpperCase()}, яку помилку тут роблять найчастіше, або що саме варто запам'ятати перед іспитом.`;
}
