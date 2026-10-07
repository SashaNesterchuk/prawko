import { contentFingerprint } from "../content-revisions";
import { useTrainingResultAnalytics } from "../../features/questions/training/useTrainingResultAnalytics";
import { mapSupabaseQuestionV2RecordToLocalQuestion } from "../../features/questions/supabase-question-record";
import type { LocalQuestion, QuestionSession, QuestionSessionSummary } from "../../features/questions/types";
import type { SupportedLocale } from "@prawko/config";
import type { TrainingResultOrigin } from "../training-lifecycle";
import { validateAnalyticsPayload } from "../payload-contract";

const mockTrack = jest.fn();
const mockSetIndex = jest.fn();
let mockRefs: { current: unknown }[] = [];
let mockRefIndex = 0;
let mockEffects: (() => void)[] = [];
let mockReviewIndex: number | null = null;
let mockFocused = true;
let mockQuestion: LocalQuestion | null;
let mockQuestionsById: Map<string, LocalQuestion | null> | null = null;
let mockShell = { preferredLocale: "ua" as SupportedLocale, examCountry: "PL" };
let mockAccess: "open" | "preview" | "locked" = "preview";
let mockObservationThrows = false;

jest.mock("react", () => ({
  useRef: (initial: unknown) => {
    const index = mockRefIndex++;
    mockRefs[index] ??= { current: initial };
    return mockRefs[index];
  },
  useState: () => [mockReviewIndex, (next: number | null | ((old: number | null) => number | null)) => {
    mockSetIndex(next);
    mockReviewIndex = typeof next === "function" ? next(mockReviewIndex) : next;
  }],
  useEffect: (effect: () => void) => { mockEffects.push(effect); },
}));
jest.mock("expo-router/react-navigation", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../providers/AnalyticsProvider", () => ({ useAnalytics: () => ({ track: mockTrack }) }));
jest.mock("../../state/question-catalog", () => ({ useQuestionCatalogVersion: () => 1 }));
jest.mock("../../state/app-shell", () => ({
  useAppShellStore: (selector: (state: typeof mockShell) => unknown) => selector(mockShell),
}));
jest.mock("../../state/entitlements", () => ({ useHasPlusAccess: () => false }));
jest.mock("../../features/questions/explanation-access", () => ({
  resolveLearnerExplanationAccess: () => {
    if (mockObservationThrows) throw new Error("optional observation");
    return mockAccess;
  },
}));
jest.mock("../../features/questions/question-engine", () => ({
  getQuestionById: (id: string) => mockQuestionsById ? mockQuestionsById.get(id) ?? null : mockQuestion,
  getQuestionTopicIds: () => [],
  getLocalizedText: (text: Record<string, string>, locale: string) => text[locale] ?? text.en ?? "",
}));
jest.mock("../useAnalyticsDuration", () => ({
  useAnalyticsDuration: () => ({ measure: () => ({ visible_foreground_ms: 123 }) }),
}));
jest.mock("../useAnalyticsViewState", () => ({ useAnalyticsViewState: () => undefined }));

const session = {
  id: "training-1", request: { mode: "learning" }, finishedAt: "2026-10-07T10:00:00Z",
  questionIds: ["q-1"], answers: { "q-1": { isCorrect: false } },
} as unknown as QuestionSession;
const summary = { answered: 1, correct: 0, wrong: 1, total: 1 } as QuestionSessionSummary;

function observe(activeSession: QuestionSession | null = session, resultOrigin: TrainingResultOrigin = "new_completion",
  currentSummary: QuestionSessionSummary = summary) {
  mockRefIndex = 0;
  mockEffects = [];
  const result = useTrainingResultAnalytics({ activeSession, resultOrigin, summary: currentSummary });
  for (const effect of mockEffects) effect();
  return result;
}

function views() {
  return mockTrack.mock.calls.filter(([name]) => name === "training_answers_review_question_viewed").map(([, props]) => props);
}

// Controlled hook wiring, not rendered/native review or delivery acceptance.
describe("training review content observations", () => {
  beforeEach(() => {
    mockTrack.mockClear();
    mockSetIndex.mockClear();
    mockRefs = [];
    mockReviewIndex = null;
    mockFocused = true;
    mockShell = { preferredLocale: "ua", examCountry: "PL" };
    mockAccess = "preview";
    mockObservationThrows = false;
    mockQuestionsById = null;
    mockQuestion = mapSupabaseQuestionV2RecordToLocalQuestion({
      id: "record-1", source_id: "q-1", source_row_number: 1, points: 1,
      answer_kind: "boolean", correct_bool: true, scope: "base", primary_topic_id: null,
      topic_ids: [], difficulty_seed: 1, content: { prompt: { cs: "Prompt" } },
      ai_explanations: { cs: "Czech explanation", en: "English explanation" },
    });
  });

  it("records actual selected text and provenance without changing review actions", () => {
    observe().openReview();
    expect(mockReviewIndex).toBe(0);
    const review = observe();
    expect(views()).toHaveLength(1);
    expect(views()[0]).toMatchObject({
      training_session_id: "training-1", view_state: "question", was_answered: true, is_correct: false,
      content_requested_locale: "ua", content_text_field: "ua", content_source_language: "cs",
      explanation_source_language: "cs", explanation_display_variant: "free_topic_marked",
      explanation_display_revision: contentFingerprint("Czech explanation"),
    });
    expect(JSON.stringify(views()[0])).not.toContain("Czech explanation");
    review.closeReview("back");
    expect(mockReviewIndex).toBeNull();
  });

  it("observes locale/revision/access changes once each, without treating rerenders as another view", () => {
    observe().openReview();
    observe();
    observe();
    expect(views()).toHaveLength(1);
    mockShell.preferredLocale = "en";
    observe();
    expect(views()[1].explanation_display_revision).toBe(contentFingerprint("English explanation"));
    mockAccess = "locked";
    observe();
    expect(views()[2]).toMatchObject({ explanation_rendered_state: "locked", explanation_display_revision: null });
    mockAccess = "open";
    mockQuestion = { ...mockQuestion!, explanation: { ...mockQuestion!.explanation, en: "Revised" } };
    observe();
    expect(views()[3].explanation_display_revision).toBe(contentFingerprint("Revised"));
    expect(mockSetIndex).toHaveBeenCalledTimes(1);
  });

  it("does not claim visible text for unfocused/missing review or a failed optional observer", () => {
    observe().openReview();
    mockFocused = false;
    observe();
    expect(views()).toHaveLength(0);
    mockFocused = true;
    mockObservationThrows = true;
    const review = observe();
    expect(views()[0].view_state).toBe("question");
    expect(views()[0].explanation_display_observation_version).toBeUndefined();
    mockQuestion = null;
    observe();
    expect(views()[1].view_state).toBe("missing_question");
    expect(views()[1].explanation_display_revision).toBeUndefined();
    review.closeReview("finished");
    expect(mockReviewIndex).toBeNull();
  });

  it("validates real result/review payloads and counts distinct questions, not locale/revision views", () => {
    observe().openReview();
    observe();
    mockShell.preferredLocale = "en";
    observe();
    observe().closeReview("back");
    observe();
    const results = mockTrack.mock.calls.filter(([name]) => name === "training_result_viewed").map(([, p]) => p);
    expect(results.map((p) => [p.result_origin, p.view_reason])).toEqual([
      ["new_completion", "initial"], ["new_completion", "review_return"],
    ]);
    expect(views()).toHaveLength(2);
    const closed = mockTrack.mock.calls.find(([name]) => name === "training_answers_review_closed")![1];
    expect(closed).toMatchObject({ viewed_count: 1, question_index: 1, question_total: 1, review_foreground_ms: 123 });
    for (const [event, props] of mockTrack.mock.calls) {
      expect(validateAnalyticsPayload(event, props).analytics_payload_contract_status).toBe("valid");
    }
    expect(mockTrack.mock.calls.some(([name]) => name === "training_session_completed")).toBe(false);
  });

  it("tracks actual next/previous/missing review items without counting repeated or missing content twice", () => {
    const active = { ...session, questionIds: ["q-1", "q-2", "q-missing"],
      answers: { ...session.answers, "q-2": { isCorrect: true } } } as QuestionSession;
    const counts = { total: 3, answered: 2, correct: 1, wrong: 1 };
    mockQuestionsById = new Map([["q-1", mockQuestion], ["q-2", { ...mockQuestion!, id: "q-2" }]]);
    const review = () => observe(active, "existing_result", counts);
    review().openReview();
    review().nextReviewQuestion();
    review().previousReviewQuestion();
    review().nextReviewQuestion();
    review().nextReviewQuestion();
    review().nextReviewQuestion();
    review();
    expect(views().map((p) => [p.question_id, p.question_index])).toEqual([
      ["q-1", 1], ["q-2", 2], ["q-1", 1], ["q-2", 2], ["q-missing", 3],
    ]);
    expect(views()[4]).toMatchObject({ view_state: "missing_question", was_answered: false, is_correct: null });
    expect(mockReviewIndex).toBeNull();
    const closed = mockTrack.mock.calls.find(([name]) => name === "training_answers_review_closed")![1];
    expect(closed).toMatchObject({ close_reason: "finished", viewed_count: 2, question_index: 3, question_total: 3 });
    for (const [event, props] of mockTrack.mock.calls) {
      expect(validateAnalyticsPayload(event, props).analytics_payload_valid).toBe(true);
    }
  });

  it("keeps stored-result exposure and focus returns separate from a new session completion", () => {
    observe(null).openReview();
    mockFocused = false;
    observe(session, "existing_result");
    expect(mockTrack).not.toHaveBeenCalled();
    mockFocused = true;
    observe(session, "existing_result");
    observe(session, "existing_result");
    mockFocused = false;
    observe(session, "existing_result");
    mockFocused = true;
    observe(session, "existing_result");
    expect(mockTrack.mock.calls.map(([name]) => name)).toEqual(["training_result_viewed", "training_result_viewed"]);
    expect(mockTrack.mock.calls.every(([, p]) => p.result_origin === "existing_result" && p.view_reason === "initial")).toBe(true);
    expect(mockSetIndex).not.toHaveBeenCalled();
  });
});
