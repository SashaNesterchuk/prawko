jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
    multiSet: jest.fn(async () => undefined),
  },
}));

const mockIsInterstitialShowing = jest.fn(() => false);
const mockShowingListeners = new Set<(showing: boolean) => void>();

jest.mock("../../ads/interstitial-controller", () => ({
  isInterstitialShowing: () => mockIsInterstitialShowing(),
  subscribeInterstitialShowing: (listener: (showing: boolean) => void) => {
    mockShowingListeners.add(listener);
    return () => {
      mockShowingListeners.delete(listener);
    };
  },
}));

import { AppState } from "react-native";

import { useQuestionProgressStore } from "../../../state/question-progress";
import {
  hydrateQuestionBankFromLocalQuestions,
  resetQuestionBankToMock,
} from "../question-bank";
import type { LocalQuestion } from "../types";
import {
  startTimedSessionClock,
  syncTimedSessionClock,
} from "../timed-session-clock";

const txt = {
  pl: "q",
  ua: "q",
  en: "q",
  de: "q",
};

function makeQuestion(id: string): LocalQuestion {
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
    points: 1,
    scope: "base",
    topicBlock: "signs",
    primaryTopicId: "signs_signals",
    topicIds: ["signs_signals"],
    difficultySeed: 50,
  };
}

type MockAppState = typeof AppState & {
  currentState: string;
  __emit: (state: string) => void;
  __reset: () => void;
};

const mockAppState = AppState as MockAppState;

describe("timed session clock", () => {
  beforeEach(() => {
    hydrateQuestionBankFromLocalQuestions([
      makeQuestion("q1"),
      makeQuestion("q2"),
    ]);
    useQuestionProgressStore.getState().resetProgress();
    mockIsInterstitialShowing.mockReturnValue(false);
    mockShowingListeners.clear();
    mockAppState.currentState = "active";
    if (typeof mockAppState.__reset === "function") {
      mockAppState.__reset();
    }
  });

  afterEach(() => {
    useQuestionProgressStore.getState().resetProgress();
    resetQuestionBankToMock();
    mockAppState.currentState = "active";
    if (typeof mockAppState.__reset === "function") {
      mockAppState.__reset();
    }
    jest.useRealTimers();
  });

  it("pauses a live blitz when an interstitial starts showing", () => {
    useQuestionProgressStore.getState().startOrResumeSession({
      currentCategory: "B",
      mode: "blitz",
      sessionKey: "blitz-ad-pause",
      timeLimitSeconds: 180,
    });

    mockIsInterstitialShowing.mockReturnValue(true);
    syncTimedSessionClock();

    const session = useQuestionProgressStore.getState().activeSession;
    expect(session?.timerPausedAt).toEqual(expect.any(String));
  });

  it("extends expiresAt by the paused duration when the ad closes", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));

    useQuestionProgressStore.getState().startOrResumeSession({
      currentCategory: "B",
      mode: "blitz",
      sessionKey: "blitz-ad-resume",
      timeLimitSeconds: 180,
    });
    const started = useQuestionProgressStore.getState().activeSession!;

    mockIsInterstitialShowing.mockReturnValue(true);
    syncTimedSessionClock();

    jest.setSystemTime(new Date("2026-08-15T12:00:20.000Z"));
    mockIsInterstitialShowing.mockReturnValue(false);
    syncTimedSessionClock();

    const resumed = useQuestionProgressStore.getState().activeSession!;
    expect(resumed.timerPausedAt).toBeNull();
    expect(Date.parse(resumed.expiresAt!) - Date.parse(started.expiresAt!)).toBe(
      20_000
    );

    jest.useRealTimers();
  });

  it("pauses while the app is inactive even without an ad", () => {
    useQuestionProgressStore.getState().startOrResumeSession({
      currentCategory: "B",
      mode: "blitz",
      sessionKey: "blitz-inactive-pause",
      timeLimitSeconds: 180,
    });

    mockAppState.currentState = "inactive";
    syncTimedSessionClock();

    expect(useQuestionProgressStore.getState().activeSession?.timerPausedAt).toEqual(
      expect.any(String)
    );
  });

  it("subscribes to interstitial showing and app state", () => {
    const stop = startTimedSessionClock();
    useQuestionProgressStore.getState().startOrResumeSession({
      currentCategory: "B",
      mode: "blitz",
      sessionKey: "blitz-subscribe",
      timeLimitSeconds: 180,
    });

    mockIsInterstitialShowing.mockReturnValue(true);
    for (const listener of mockShowingListeners) {
      listener(true);
    }

    expect(useQuestionProgressStore.getState().activeSession?.timerPausedAt).toEqual(
      expect.any(String)
    );
    stop();
  });
});
