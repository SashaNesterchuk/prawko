import { QUESTION_TOPIC_IDS, isQuestionTopicId } from "@prawko/config";

import { buildQuestionChatContext } from "../../ai/question-chat-context";
import { generateLocalStudyPlan } from "../../study-plan/generate-local-study-plan";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../question-bank";
import type { LocalQuestion } from "../types";

const txt = {
  pl: "Jak zachowac sie przy znaku?",
  ua: "Як повестися біля знака?",
  en: "How to behave near the sign?",
  de: "Wie verhaelt man sich am Schild?",
};

describe("study plan and AI chat catalog topics", () => {
  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("assigns focusTopic / task topicBlock from QUESTION_TOPIC_IDS", () => {
    const plan = generateLocalStudyPlan({
      category: "B",
      daysUntilExam: 10,
      level: "first_time",
      locale: "ua",
      minutesPerDay: 30,
    });

    for (const day of plan.days) {
      if (day.focusTopic) {
        expect(isQuestionTopicId(day.focusTopic)).toBe(true);
        expect(QUESTION_TOPIC_IDS).toContain(day.focusTopic);
      }

      for (const task of day.tasks) {
        if (!task.topicBlock) {
          continue;
        }

        expect(isQuestionTopicId(task.topicBlock)).toBe(true);
        expect(QUESTION_TOPIC_IDS).toContain(task.topicBlock);
      }
    }

    const firstFocus = plan.days.find((day) => day.focusTopic)?.focusTopic;
    expect(firstFocus).toBe(QUESTION_TOPIC_IDS[0]);
  });

  it("builds AI chat context with catalog topicId, not legacy topicBlock", () => {
    const question: LocalQuestion = {
      id: "chat-q1",
      sourceRowNumber: 1,
      prompt: txt,
      explanation: txt,
      answerType: "boolean",
      correctAnswer: "true",
      points: 2,
      scope: "base",
      topicBlock: "safety",
      primaryTopicId: "warning_signs",
      topicIds: ["warning_signs"],
      difficultySeed: 20,
    };

    hydrateQuestionBankFromLocalQuestions([question]);

    const context = buildQuestionChatContext({
      questionId: "chat-q1",
      locale: "ua",
      selectedAnswer: "false",
    });

    expect(context).not.toBeNull();
    expect(context?.topicId).toBe("warning_signs");
    expect(context?.topicBlock).toBeUndefined();
  });
});
