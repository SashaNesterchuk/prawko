import { CZECH_EXAM_BASKETS, CZECH_EXAM_PROFILE, WORD_EXAM_PROFILE } from "../../exam/exam-profile";
import { getExamQuestionIds } from "../question-engine";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../question-bank";
import type { LocalQuestion } from "../types";

const txt = {
  pl: "q",
  ua: "q",
  en: "q",
  de: "q",
};

function makeQuestion(
  id: string,
  options: {
    examBasketId?: number;
    points?: number;
    scope?: LocalQuestion["scope"];
  } = {}
): LocalQuestion {
  return {
    id,
    sourceRowNumber: 1,
    prompt: txt,
    explanation: txt,
    answerType: "abc",
    correctAnswer: "A",
    choices: [
      { id: "A", text: txt },
      { id: "B", text: txt },
      { id: "C", text: txt },
    ],
    points: options.points ?? 1,
    scope: options.scope ?? "base",
    topicBlock: "signs",
    primaryTopicId: "signs_signals",
    topicIds: ["signs_signals"],
    difficultySeed: 1,
    examBasketId: options.examBasketId,
  };
}

describe("czech exam composition", () => {
  afterEach(() => {
    resetQuestionBankToMock();
  });

  it("picks the official 25-question 50-point basket mix", () => {
    const questions: LocalQuestion[] = [];
    for (const basket of CZECH_EXAM_BASKETS) {
      for (let index = 0; index < basket.count + 3; index += 1) {
        questions.push(
          makeQuestion(`cz-${basket.scopeId}-${index}`, {
            examBasketId: basket.scopeId,
            points: basket.points,
          })
        );
      }
    }

    hydrateQuestionBankFromLocalQuestions(questions);
    const ids = getExamQuestionIds(
      {},
      25,
      new Date(),
      CZECH_EXAM_PROFILE,
      "exam"
    );
    const selected = ids.map((id) => questions.find((question) => question.id === id)!);

    expect(ids).toHaveLength(25);
    expect(selected.reduce((sum, question) => sum + question.points, 0)).toBe(50);

    for (const basket of CZECH_EXAM_BASKETS) {
      expect(
        selected.filter(
          (question) =>
            question.examBasketId === basket.scopeId &&
            question.points === basket.points
        )
      ).toHaveLength(basket.count);
    }
  });

  it("uses a random subset for Czech mini tests instead of the official mix", () => {
    const questions = CZECH_EXAM_BASKETS.flatMap((basket) =>
      Array.from({ length: 5 }, (_, index) =>
        makeQuestion(`mini-${basket.scopeId}-${index}`, {
          examBasketId: basket.scopeId,
          points: basket.points,
        })
      )
    );
    hydrateQuestionBankFromLocalQuestions(questions);

    const ids = getExamQuestionIds(
      {},
      10,
      new Date(),
      CZECH_EXAM_PROFILE,
      "mini_test"
    );

    expect(ids).toHaveLength(10);
  });

  it("keeps the WORD base/specialist split", () => {
    const questions = [
      ...Array.from({ length: 24 }, (_, index) =>
        makeQuestion(`base-${index}`, { scope: "base", points: 2 })
      ),
      ...Array.from({ length: 16 }, (_, index) =>
        makeQuestion(`spec-${index}`, { scope: "specialist", points: 3 })
      ),
    ];
    hydrateQuestionBankFromLocalQuestions(questions);

    const ids = getExamQuestionIds({}, 32, new Date(), WORD_EXAM_PROFILE, "exam");
    const selected = ids.map((id) => questions.find((question) => question.id === id)!);

    expect(ids).toHaveLength(32);
    expect(selected.filter((question) => question.scope === "base")).toHaveLength(20);
    expect(selected.filter((question) => question.scope === "specialist")).toHaveLength(12);
  });
});
