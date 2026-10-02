import { useAppShellStore } from "../../../state/app-shell";
import {
  discardPendingQuestionProgressPersist,
  useQuestionProgressStore,
} from "../../../state/question-progress";
import { createEmptyQuestionUserState } from "../../questions/question-engine";
import {
  LOCAL_EXAM_PROGRESS_VERSION,
  prepareLocalExamProgress,
  recordLocalExamProgress,
} from "../exam-learning-progress";
import type { RemoteExamSnapshot } from "../types";

const QUESTION_ID = "q-signs";
const NEWER = "2026-10-01T12:00:00.000Z";
const OLDER = "2026-09-01T12:00:00.000Z";

function snapshot(input: {
  status?: RemoteExamSnapshot["session"]["status"];
  navigation?: "free" | "linear";
  country?: "PL" | "CZ";
  version?: number;
  startedAt?: string;
  answeredAt?: string;
  attemptId?: string;
}): RemoteExamSnapshot {
  const country = input.country ?? "PL";
  return {
    answers: [
      {
        answerDurationMs: 1000,
        answerGiven: "A",
        answeredAt: input.answeredAt ?? OLDER,
        isCorrect: true,
        order: 1,
        pointsAwarded: 2,
        questionAttemptId: input.attemptId ?? "attempt-1",
        questionId: QUESTION_ID,
        questionSourceId: QUESTION_ID,
      },
    ],
    questions: [],
    wrongQuestionSourceIds: [],
    session: {
      correctAnswersCount: 1,
      currentCategory: "B",
      currentQuestionIndex: 1,
      expiresAt: "2026-10-01T13:00:00.000Z",
      finishedAt: input.status && input.status !== "active" ? NEWER : null,
      id: "local-11111111-1111-4111-8111-111111111111",
      metadata: {
        exam_country: country,
        navigation: input.navigation ?? "linear",
        learning_progress_version: input.version ?? LOCAL_EXAM_PROGRESS_VERSION,
      },
      mode: "exam",
      passPoints: 68,
      passed: null,
      remainingSeconds: 60,
      scorePoints: 2,
      sessionLocale: "pl",
      startedAt: input.startedAt ?? "2026-09-01T11:00:00.000Z",
      status: input.status ?? "active",
      studyPlanId: null,
      totalPointsTarget: 74,
      totalQuestionsAnswered: 1,
      totalQuestionsTarget: 32,
      wrongAnswersCount: 0,
    },
  };
}

function seedLearner() {
  useAppShellStore.setState({ examCountry: "PL" });
  useQuestionProgressStore.setState({
    hasHydrated: true,
    hydratedCountry: "PL",
    examProgressLedger: {},
    examProgressResetAt: null,
    questionUserState: {
      [QUESTION_ID]: {
        ...createEmptyQuestionUserState(QUESTION_ID),
        timesSeen: 2,
        timesCorrect: 2,
        consecutiveCorrect: 2,
        lastSeenAt: NEWER,
        lastCorrectAt: NEWER,
        reviewDueAt: "2026-10-15T12:00:00.000Z",
      },
    },
  });
}

describe("local exam learning progress", () => {
  beforeEach(() => {
    seedLearner();
  });

  afterEach(() => {
    discardPendingQuestionProgressPersist();
  });

  it("counts an older recovered answer without replacing the latest streak", () => {
    const applied = useQuestionProgressStore.getState().applyExamAttemptBatch({
      country: "PL",
      sessionId: "local-11111111-1111-4111-8111-111111111111",
      startedAt: "2026-09-01T11:00:00.000Z",
      finalized: false,
      attempts: [
        {
          id: "attempt-old",
          questionId: QUESTION_ID,
          answeredAt: OLDER,
          isCorrect: false,
        },
      ],
    });

    const state = useQuestionProgressStore.getState().questionUserState[QUESTION_ID];
    expect(applied).toBe(true);
    expect(state?.timesSeen).toBe(3);
    expect(state?.timesWrong).toBe(1);
    expect(state?.consecutiveCorrect).toBe(2);
    expect(state?.lastSeenAt).toBe(NEWER);
    expect(state?.lastCorrectAt).toBe(NEWER);
    expect(state?.reviewDueAt).toBe("2026-10-15T12:00:00.000Z");
  });

  it("does not credit the same exam answer twice", () => {
    const exam = snapshot({ status: "completed", answeredAt: NEWER });

    recordLocalExamProgress(exam, "PL");
    recordLocalExamProgress(exam, "PL");

    const state = useQuestionProgressStore.getState().questionUserState[QUESTION_ID];
    expect(state?.timesSeen).toBe(3);
    expect(
      useQuestionProgressStore.getState().examProgressLedger[`PL:${exam.session.id}`]?.finalized
    ).toBe(true);
  });

  it("waits until a free-navigation exam is finished before counting revisions", () => {
    recordLocalExamProgress(snapshot({ navigation: "free", status: "active" }), "PL");
    expect(useQuestionProgressStore.getState().questionUserState[QUESTION_ID]?.timesSeen).toBe(2);

    recordLocalExamProgress(snapshot({ navigation: "free", status: "completed" }), "PL");
    expect(useQuestionProgressStore.getState().questionUserState[QUESTION_ID]?.timesSeen).toBe(3);
  });

  it("does not let an exam from before reset resurrect cleared learning", () => {
    useQuestionProgressStore.setState({
      examProgressResetAt: "2026-10-01T00:00:00.000Z",
      questionUserState: {},
    });

    const applied = useQuestionProgressStore.getState().applyExamAttemptBatch({
      country: "PL",
      sessionId: "local-11111111-1111-4111-8111-111111111111",
      startedAt: "2026-09-01T11:00:00.000Z",
      finalized: true,
      attempts: [
        {
          id: "attempt-old",
          questionId: QUESTION_ID,
          answeredAt: OLDER,
          isCorrect: true,
        },
      ],
    });

    expect(applied).toBe(true);
    expect(useQuestionProgressStore.getState().questionUserState).toEqual({});
  });

  it("ignores a batch for a country that is not the open progress store", () => {
    const applied = useQuestionProgressStore.getState().applyExamAttemptBatch({
      country: "CZ",
      sessionId: "local-11111111-1111-4111-8111-111111111111",
      startedAt: NEWER,
      finalized: true,
      attempts: [
        {
          id: "attempt-cz",
          questionId: QUESTION_ID,
          answeredAt: NEWER,
          isCorrect: true,
        },
      ],
    });

    expect(applied).toBe(false);
    expect(useQuestionProgressStore.getState().questionUserState[QUESTION_ID]?.timesSeen).toBe(2);
  });

  it("baselines an in-progress linear exam and does not replay a finished legacy snapshot", () => {
    const active = snapshot({ version: undefined, status: "active" });
    delete active.session.metadata.learning_progress_version;
    const prepared = prepareLocalExamProgress(active, "PL");

    expect(prepared.session.metadata.learning_progress_baseline_orders).toEqual([1]);

    const finished = snapshot({ version: undefined, status: "completed" });
    delete finished.session.metadata.learning_progress_version;
    const leftAlone = prepareLocalExamProgress(finished, "PL");

    expect(leftAlone.session.metadata.learning_progress_version).toBeUndefined();
    recordLocalExamProgress(leftAlone, "PL");
    expect(useQuestionProgressStore.getState().questionUserState[QUESTION_ID]?.timesSeen).toBe(2);
  });
});
