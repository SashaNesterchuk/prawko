import { getPreparationProgress, formatPreparationPercent } from "../preparation-progress";
import { getQuestionBank, hydrateQuestionBankFromLocalQuestions, resetQuestionBankToMock } from "../../questions/question-bank";
import { getNextQuestionUserStateAfterAttempt, getQuestionUserState, getOverallMistakesStats, buildQuestionSession } from "../../questions/question-engine";
import type { QuestionUserStateMap, LocalQuestion } from "../../questions/types";
let bank: LocalQuestion[];
let states: QuestionUserStateMap;
beforeEach(() => {
  bank = [1, 2, 3, 4].map((n) => ({ ...getQuestionBank()[0], id: `progress-${n}` }));
  hydrateQuestionBankFromLocalQuestions(bank);
  states = {};
});
afterEach(resetQuestionBankToMock);
let tick = 0;
function answer(id: string, isCorrect: boolean) {
  states[id] = getNextQuestionUserStateAfterAttempt(getQuestionUserState(states, id), { isCorrect, answeredAt: new Date(1700000000000 + ++tick * 1000).toISOString() });
}
it("counts unique latest answers, repetitions and corrections", () => {
  expect(getPreparationProgress(states)).toMatchObject({ percent: 0, correct: 0, wrong: 0 });
  answer(bank[0].id, true);
  expect(getPreparationProgress(states)).toMatchObject({ percent: 25, correctPercent: 25, wrongPercent: 0 });
  answer(bank[1].id, false); answer(bank[1].id, false);
  expect(getPreparationProgress(states)).toMatchObject({ percent: 50, correct: 1, wrong: 1, wrongPercent: 25 });
  answer(bank[1].id, true);
  expect(getPreparationProgress(states)).toMatchObject({ percent: 50, correct: 2, wrong: 0 });
  answer(bank[0].id, false);
  expect(getPreparationProgress(states)).toMatchObject({ percent: 50, correct: 1, wrong: 1 });
});
it("matches the mistakes overview and actual wrong-answer pool", () => {
  answer(bank[0].id, false); answer(bank[1].id, true); answer(bank[2].id, false); answer(bank[2].id, true);
  expect(getPreparationProgress(states).wrong).toBe(getOverallMistakesStats(states).wrong);
  expect(buildQuestionSession({ mode: "wrong_answers", currentCategory: "B", questionLimit: 100 }, states).questionIds).toEqual([bank[0].id]);
});
it("uses only the active bank and deduplicates IDs", () => {
  answer(bank[0].id, true); answer("retired", false);
  hydrateQuestionBankFromLocalQuestions([bank[0], bank[0], bank[1]]);
  expect(getPreparationProgress(states)).toMatchObject({ total: 2, percent: 50, correct: 1, wrong: 0 });
  hydrateQuestionBankFromLocalQuestions([bank[2], bank[3]]);
  expect(getPreparationProgress(states).percent).toBe(0);
  hydrateQuestionBankFromLocalQuestions(bank);
  expect(getPreparationProgress(states).percent).toBe(25);
});
it("formats coverage below one percent", () => {
  expect(formatPreparationPercent(0)).toBe("0%");
  expect(formatPreparationPercent(0.04)).toBe("1%");
  expect(formatPreparationPercent(1.6)).toBe("2%");
  expect(formatPreparationPercent(100)).toBe("100%");
});
it("keeps tiny segment fractions exact and handles an empty active bank", () => {
  hydrateQuestionBankFromLocalQuestions(Array.from({ length: 250 }, (_, n) => ({ ...bank[0], id: `tiny-${n}` })));
  answer("tiny-0", true);
  expect(getPreparationProgress(states)).toMatchObject({ percent: 0.4, correctPercent: 0.4, wrongPercent: 0 });
  expect(formatPreparationPercent(getPreparationProgress(states).percent)).toBe("1%");
  hydrateQuestionBankFromLocalQuestions([]);
  expect(getPreparationProgress(states)).toEqual({ total: 0, correct: 0, wrong: 0, percent: 0, correctPercent: 0, wrongPercent: 0 });
});
