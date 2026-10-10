import { readFileSync } from "fs";
import { join } from "path";
import ts from "typescript";
import { ANALYTICS_EVENTS } from "../../../../analytics/catalog";
import { useAppShellStore } from "../../../../state/app-shell";
import { syncQuestionBookmarkState } from "../../supabase-question-state";
import { getMobileSupabaseClient } from "../../../../lib/supabase";

jest.mock("../../../../config/env", () => ({ isMockAuthEnabled: false, isMobileSupabaseConfigured: true }));
jest.mock("../../../../lib/supabase", () => ({ getMobileSupabaseClient: jest.fn() }));

// Execute the production callbacks without mounting unrelated navigation/ad hooks.
function action(name: string, context: Record<string, unknown>) {
  const text = readFileSync(join(__dirname, "../useQuestionTrainingSession.ts"), "utf8");
  const source = ts.createSourceFile("training.ts", text, ts.ScriptTarget.Latest, true);
  let initializer: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) initializer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!initializer) throw new Error(`Missing training action ${name}`);
  const js = ts.transpileModule(`const callback = ${initializer.getText(source)};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function(...Object.keys(context), `${js}\nreturn callback;`)(...Object.values(context));
}

function context() {
  return {
    ANALYTICS_EVENTS,
    currentQuestion: { id: "q1", answerType: "abc", points: 1, topicIds: [] },
    currentAnswer: null,
    answerCurrentQuestion: jest.fn(() => ({ id: "answer-1", sessionId: "session-1", isCorrect: true })),
    setHasAnsweredThisEntry: jest.fn(), isMonetizationV2Active: () => false,
    recordQuestionAnsweredForAds: jest.fn(), shouldAttemptPracticeAdRef: { current: false },
    questionStartedAtRef: { current: Date.now() }, questionDuration: { measure: () => ({ visible_foreground_ms: 1 }) },
    track: jest.fn(), displayLocale: "en", currentQuestionState: null,
    sessionMode: "learning", sessionTopic: null, activeSession: null, summary: { total: 20 },
    roadmapStepAnalytics: () => ({}), trainingPracticeEntry: () => ({}),
    toggleBookmark: jest.fn(() => true),
    // Legacy backend mode can still be supabase for a signed-out installation.
    authMode: "supabase", isMobileSupabaseConfigured: true, currentStudyPlanRemoteId: null,
    readHasPlusAccess: () => false,
    recordQuestionAttemptBySourceId: jest.fn(async () => "attempt-1"),
    syncQuestionBookmarkState: jest.fn(async () => {}),
  };
}

it("saves an accountless answer locally and tracks it without a server upload", () => {
  const ctx = context();
  action("handleAnswer", ctx)("A");
  expect(ctx.answerCurrentQuestion).toHaveBeenCalledWith("A");
  expect(ctx.track).toHaveBeenCalledWith(ANALYTICS_EVENTS.trainingQuestionAnswered.key,
    expect.objectContaining({ question_id: "q1", answer_id: "answer-1", is_correct: true }));
  expect(ctx.recordQuestionAttemptBySourceId).not.toHaveBeenCalled();
});
it("keeps local bookmarks and their normal analytics without an upload", () => {
  const ctx = context();
  action("handleToggleBookmark", ctx)("q1");
  expect(ctx.toggleBookmark).toHaveBeenCalledWith("q1");
  expect(ctx.track).toHaveBeenCalledWith(ANALYTICS_EVENTS.questionBookmarkChanged.key,
    expect.objectContaining({ question_id: "q1", is_bookmarked: true }));
  expect(ctx.syncQuestionBookmarkState).not.toHaveBeenCalled();
});
it("legacy review bookmark calls do not create a client or request for an accountless user", async () => {
  useAppShellStore.getState().setSupabaseUser(null);
  expect(useAppShellStore.getState().authMode).toBe("supabase");
  await expect(syncQuestionBookmarkState({ questionSourceId: "q1", isBookmarked: true })).resolves.toBeUndefined();
  expect(getMobileSupabaseClient).not.toHaveBeenCalled();
});
