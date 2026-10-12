import { hydrateQuestionBankFromLocalQuestions, resetQuestionBankToMock, getQuestionBank } from "../../questions/question-bank";
import { useQuestionProgressStore } from "../../../state/question-progress";
import { useSignPracticeProgressStore } from "../../../state/sign-practice-progress";
import { useAppShellStore } from "../../../state/app-shell";
import { removeAmbiguousRoadmapCoverage, roadmapLessonCoverage, roadmapLessonKey, roadmapLessonPercent, useRoadmapProgressStore } from "../roadmap-progress";
import type { LocalQuestion, QuestionSessionRequest } from "../../questions/types";
const key = roadmapLessonKey("PL", "B", "PL:0:0");
let questions: LocalQuestion[];
function request(run: number, overrides: Partial<QuestionSessionRequest> = {}): QuestionSessionRequest {
  return { mode: "learning", currentCategory: "B", sessionKey: `B:roadmap-test-${run}`, topic: "signs_signals", questionLimit: 2, roadmapStepId: "PL:0:0", ...overrides };
}
function answer(value: "A" | "B") {
  useQuestionProgressStore.getState().answerCurrentQuestion(value);
  useQuestionProgressStore.getState().advanceSession();
}
beforeEach(() => {
  useAppShellStore.setState({ examCountry: "PL", preferredCategory: "B" });
  useQuestionProgressStore.getState().resetProgress();
  useRoadmapProgressStore.setState({ lessons: {}, completedStepIds: [], hasStartedLearning: false, hasHydrated: true });
  const base = getQuestionBank()[0];
  questions = ["road-q1", "road-q2"].map((id) => ({ ...base, id, answerType: "abc", correctAnswer: "A", primaryTopicId: "signs_signals", topicIds: ["signs_signals"] }));
  hydrateQuestionBankFromLocalQuestions(questions);
});
afterEach(() => resetQuestionBankToMock());
it("counts unique correct answers, keeps the original pool, retries only the mistake", () => {
  const first = useQuestionProgressStore.getState().startOrResumeSession(request(1));
  expect(useRoadmapProgressStore.getState().hasStartedLearning).toBe(false);
  answer("A"); answer("B");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(50);
  expect(useRoadmapProgressStore.getState().hasStartedLearning).toBe(true);
  hydrateQuestionBankFromLocalQuestions([...questions, { ...questions[0], id: "new-unrelated-question" }]);
  const second = useQuestionProgressStore.getState().startOrResumeSession(request(2));
  expect(second.questionIds).toEqual([first.questionIds[1]]);
  expect(useRoadmapProgressStore.getState().lessons[key].questionIds).toEqual(first.questionIds);
  answer("A");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(100);
  useQuestionProgressStore.getState().startOrResumeSession(request(3));
  answer("B"); answer("A");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(50);
  expect(roadmapLessonCoverage(useRoadmapProgressStore.getState().lessons[key])).toEqual({ correctPercent: 50, wrongPercent: 50 });
  const retry = useQuestionProgressStore.getState().startOrResumeSession(request(4));
  expect(retry.questionIds).toHaveLength(1);
  answer("A");
  expect(roadmapLessonCoverage(useRoadmapProgressStore.getState().lessons[key])).toEqual({ correctPercent: 100, wrongPercent: 0 });
});
it("a wholly incorrect finished session stays at zero", () => {
  useQuestionProgressStore.getState().startOrResumeSession(request(1)); answer("B"); answer("B");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(0);
  expect(useRoadmapProgressStore.getState().hasStartedLearning).toBe(true);
});
it("does not transfer progress to another category or country", () => {
  const first = useQuestionProgressStore.getState().startOrResumeSession(request(1));
  useRoadmapProgressStore.getState().recordAnswer("PL", "C", first.questionIds[0], true);
  useRoadmapProgressStore.getState().recordAnswer("SK", "B", first.questionIds[0], true);
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(0);
});
it("preserves the access limit on a retry", () => {
  useQuestionProgressStore.getState().startOrResumeSession(request(1)); answer("B"); answer("B");
  expect(useQuestionProgressStore.getState().startOrResumeSession(request(2, { questionLimit: 1 })).questionIds).toHaveLength(1);
  expect(useRoadmapProgressStore.getState().lessons[key].questionIds).toHaveLength(2);
});
it("invalidates mastery when question content changes", () => {
  useQuestionProgressStore.getState().startOrResumeSession(request(1)); answer("A"); answer("A");
  hydrateQuestionBankFromLocalQuestions(questions.map((q) => ({ ...q, correctAnswer: "B" })));
  useQuestionProgressStore.getState().startOrResumeSession(request(2));
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(0);
});
it("never rounds incomplete coverage up to a checkmark", () => {
  expect(roadmapLessonPercent({ questionIds: Array.from({ length: 200 }, (_, i) => String(i)), correctIds: Array.from({ length: 199 }, (_, i) => String(i)), revision: "r" })).toBe(99);
});
it("CZ uses correct-only progress, retries mistakes and ignores old session-completion marks", () => {
  useAppShellStore.setState({ examCountry: "CZ" });
  const czKey = roadmapLessonKey("CZ", "B", "CZ:0:0");
  useRoadmapProgressStore.getState().completeStep("CZ:0:0");
  useQuestionProgressStore.getState().startOrResumeSession(request(1, { roadmapStepId: "CZ:0:0" }));
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[czKey])).toBe(0);
  expect(useRoadmapProgressStore.getState().hasStartedLearning).toBe(false);
  answer("A"); answer("B");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[czKey])).toBe(50);
  expect(useRoadmapProgressStore.getState().hasStartedLearning).toBe(true);
  const retry = useQuestionProgressStore.getState().startOrResumeSession(request(2, { roadmapStepId: "CZ:0:0" }));
  expect(retry.questionIds).toHaveLength(1);
  answer("A");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[czKey])).toBe(100);
  expect(useRoadmapProgressStore.getState().lessons[key]).toBeUndefined();
});

it("does not turn a quota-shortened first entry into a completed lesson", () => {
  const first = useQuestionProgressStore.getState().startOrResumeSession(request(1, { questionLimit: 1 }));
  expect(first.questionIds).toHaveLength(1);
  expect(useRoadmapProgressStore.getState().lessons[key].questionIds).toHaveLength(2);
  answer("A");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(50);
  const retry = useQuestionProgressStore.getState().startOrResumeSession(request(2, { questionLimit: 1 }));
  expect(retry.questionIds).not.toContain(first.questionIds[0]);
  answer("A");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(100);
});

it("credits only the active step even when a tiny bank forces overlapping pools", () => {
  useQuestionProgressStore.getState().startOrResumeSession(request(1));
  useQuestionProgressStore.getState().startOrResumeSession(request(2, { roadmapStepId: "PL:0:2" }));
  answer("A");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[key])).toBe(0);
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[roadmapLessonKey("PL", "B", "PL:0:2")])).toBe(50);
});
it("reserves distinct question pools for steps when the bank has enough questions", () => {
  hydrateQuestionBankFromLocalQuestions(Array.from({ length: 40 }, (_, i) => ({ ...questions[0], id: `distinct-${i}` })));
  useQuestionProgressStore.getState().startOrResumeSession(request(1));
  useQuestionProgressStore.getState().startOrResumeSession(request(2, { roadmapStepId: "PL:0:2" }));
  const lessons = useRoadmapProgressStore.getState().lessons;
  const third = lessons[roadmapLessonKey("PL", "B", "PL:0:2")];
  expect(third.questionIds.length).toBeGreaterThan(0);
  expect(third.questionIds.some(id => lessons[key].questionIds.includes(id))).toBe(false);
});
it("clears only ambiguous historical coverage within the same country and category", () => {
  const lesson = { questionIds: ["shared", "unique"], correctIds: ["shared", "unique"], revision: "r" };
  const third = roadmapLessonKey("PL", "B", "PL:0:2");
  const sk = roadmapLessonKey("SK", "B", "SK:0:0");
  const migrated = removeAmbiguousRoadmapCoverage({ [key]: lesson, [third]: { ...lesson, questionIds: ["shared"], correctIds: ["shared"] }, [sk]: lesson });
  expect(migrated[key].correctIds).toEqual(["unique"]);
  expect(migrated[third].correctIds).toEqual([]);
  expect(migrated[sk].correctIds).toEqual(lesson.correctIds);
  expect(migrated[key].questionIds).toEqual(lesson.questionIds);
});

it("stops the first-step hint after a sign-test answer, including a mistake", () => {
  const signs = useSignPracticeProgressStore.getState();
  signs.recordAttempt({ signId: "", correctCount: 0, totalQuestions: 0 });
  expect(useRoadmapProgressStore.getState().hasStartedLearning).toBe(false);
  signs.recordAttempt({ signId: "stop", correctCount: 0, totalQuestions: 1 });
  expect(useRoadmapProgressStore.getState().hasStartedLearning).toBe(true);
});

it("CZ keeps first and third step coverage separate", () => {
  useAppShellStore.setState({ examCountry: "CZ" });
  useQuestionProgressStore.getState().startOrResumeSession(request(1, { roadmapStepId: "CZ:0:0" }));
  useQuestionProgressStore.getState().startOrResumeSession(request(2, { roadmapStepId: "CZ:0:2" }));
  answer("A");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[roadmapLessonKey("CZ", "B", "CZ:0:0")])).toBe(0);
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[roadmapLessonKey("CZ", "B", "CZ:0:2")])).toBe(50);
});

it("splits the ring into correct, mistakes and unanswered, with errors blocking completion", () => {
  expect(roadmapLessonCoverage({ questionIds: ["a", "b", "c", "d"], correctIds: ["a", "b"], wrongIds: ["c"], revision: "r" })).toEqual({ correctPercent: 50, wrongPercent: 25 });
  expect(roadmapLessonPercent({ questionIds: ["a"], correctIds: ["a"], wrongIds: ["a"], revision: "r" })).toBe(0);
});

it.each(["PL", "CZ", "SK"] as const)("%s removes completion after an error and restores it after correction", (country) => {
  useAppShellStore.setState({ examCountry: country });
  const step = `${country}:0:0`;
  const lessonKey = roadmapLessonKey(country, "B", step);
  useQuestionProgressStore.getState().startOrResumeSession(request(1, { roadmapStepId: step }));
  answer("A"); answer("A");
  expect(roadmapLessonPercent(useRoadmapProgressStore.getState().lessons[lessonKey])).toBe(100);
  useQuestionProgressStore.getState().startOrResumeSession(request(2, { roadmapStepId: step }));
  answer("B"); answer("A");
  expect(roadmapLessonCoverage(useRoadmapProgressStore.getState().lessons[lessonKey])).toEqual({ correctPercent: 50, wrongPercent: 50 });
  expect(useQuestionProgressStore.getState().startOrResumeSession(request(3, { roadmapStepId: step })).questionIds).toHaveLength(1);
  answer("A");
  expect(roadmapLessonCoverage(useRoadmapProgressStore.getState().lessons[lessonKey])).toEqual({ correctPercent: 100, wrongPercent: 0 });
});
