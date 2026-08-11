import type { SupportedLocale } from "@prawko/config";
import type { QuestionChatContext } from "@prawko/schemas";

import {
  getQuestionPrimaryTopicId,
  getLocalizedText,
  getQuestionById,
  getQuestionChoices,
} from "../questions/question-engine";
import type { QuestionOptionValue } from "../questions/types";

export function buildQuestionChatContext(input: {
  questionId: string;
  locale: SupportedLocale;
  selectedAnswer?: QuestionOptionValue;
}): QuestionChatContext | null {
  const question = getQuestionById(input.questionId);

  if (!question) {
    return null;
  }

  return {
    questionId: question.id,
    locale: input.locale,
    prompt: getLocalizedText(question.prompt, input.locale),
    explanation: getLocalizedText(question.explanation, input.locale),
    correctAnswer: question.correctAnswer,
    selectedAnswer: input.selectedAnswer,
    answerType: question.answerType,
    topicId: getQuestionPrimaryTopicId(question),
    scope: question.scope,
    points: question.points,
    options: getQuestionChoices(question, input.locale).map((option) => ({
      id: option.id,
      text: option.label,
    })),
    mediaType: question.media?.type ?? "none",
  };
}

export function getAnswerTextFromContext(
  context: QuestionChatContext,
  answerId: string | undefined
) {
  if (!answerId) {
    return null;
  }

  const matchedOption = context.options.find((option) => option.id === answerId);

  return matchedOption?.text ?? answerId.toUpperCase();
}
