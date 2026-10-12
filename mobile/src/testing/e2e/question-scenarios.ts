import type { LocalQuestion, LocalizedQuestionText } from "../../features/questions/types";

import type { E2EQuestionScenario } from "./state";

const sharedTopicQuestionText: LocalizedQuestionText = {
  pl: "Pytanie E2E o postep w tematach.",
  ua: "E2E-питання про прогрес у темах.",
  en: "E2E question about topic progress.",
  de: "E2E-Frage zum Themenfortschritt.",
  cs: "E2E otázka k postupu v tématech.",
  el: "Ερώτηση E2E για την πρόοδο στα θέματα.",
};

/**
 * Minimal catalogs make E2E assertions independent from remote or mock data.
 * This question belongs to two topics so one training answer can verify that
 * coverage is attributed to both cards.
 */
export function getE2EQuestionScenarioQuestions(
  scenario: E2EQuestionScenario
): LocalQuestion[] {
  switch (scenario) {
    case "roadmap-progress":
      return [1, 2, 3].map((number) => ({
        id: `e2e-roadmap-progress-${number}`,
        sourceRowNumber: number,
        prompt: { ...sharedTopicQuestionText, ua: `Питання кроку ${number}`, en: `Lesson question ${number}` },
        explanation: sharedTopicQuestionText,
        answerType: "abc" as const,
        correctAnswer: "A" as const,
        choices: [
          { id: "A" as const, text: { ...sharedTopicQuestionText, ua: "Правильна відповідь", en: "Correct answer" } },
          { id: "B" as const, text: { ...sharedTopicQuestionText, ua: "Неправильна відповідь", en: "Wrong answer" } },
          { id: "C" as const, text: sharedTopicQuestionText },
        ],
        points: 1 as const,
        scope: "base" as const,
        topicBlock: "signs" as const,
        primaryTopicId: "signs_signals" as const,
        topicIds: ["signs_signals" as const, "road_traffic_rules" as const],
        difficultySeed: number,
      }));
    case "topic-progress":
      return [
        {
          id: "e2e-topic-progress-shared-question",
          sourceRowNumber: 1,
          prompt: sharedTopicQuestionText,
          explanation: sharedTopicQuestionText,
          answerType: "abc",
          correctAnswer: "A",
          choices: [
            { id: "A", text: sharedTopicQuestionText },
            { id: "B", text: sharedTopicQuestionText },
            { id: "C", text: sharedTopicQuestionText },
          ],
          points: 1,
          scope: "base",
          topicBlock: "signs",
          primaryTopicId: "signs_signals",
          topicIds: [
            "signs_signals",
            "driving_maneuvers",
          ],
          difficultySeed: 1,
        },
      ];
  }
}
