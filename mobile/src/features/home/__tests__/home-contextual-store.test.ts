import {
  useHomeContextualStore,
} from "../home-contextual-store";

describe("home contextual store", () => {
  beforeEach(() => {
    useHomeContextualStore.getState().resetHomeContextual();
  });

  it("records the latest completion once per session id", () => {
    const store = useHomeContextualStore.getState();

    store.recordCompletion({
      answeredCount: 10,
      examCountry: "PL",
      id: "session-a",
      kind: "training",
      mode: "learning",
      readinessDelta: 2,
      topicId: null,
      totalCount: 10,
    });
    store.recordCompletion({
      answeredCount: 10,
      examCountry: "PL",
      id: "session-a",
      kind: "training",
      mode: "learning",
      readinessDelta: 4,
      topicId: null,
      totalCount: 10,
    });

    expect(useHomeContextualStore.getState().pending).toMatchObject({
      id: "session-a",
      readinessDelta: 2,
      shownOnHome: false,
    });

    store.recordCompletion({
      answeredCount: 5,
      examCountry: "PL",
      id: "session-b",
      kind: "mistakes",
      mode: "wrong_answers",
      readinessDelta: 1,
      topicId: null,
      totalCount: 5,
    });

    expect(useHomeContextualStore.getState().pending?.id).toBe("session-b");
  });

  it("marks a completion as shown only for the matching id", () => {
    const store = useHomeContextualStore.getState();
    store.recordCompletion({
      answeredCount: 12,
      examCountry: "PL",
      id: "session-a",
      kind: "training",
      mode: "learning",
      readinessDelta: 2,
      topicId: null,
      totalCount: 12,
    });

    store.markCompletionShown("other");
    expect(useHomeContextualStore.getState().pending?.shownOnHome).toBe(false);

    store.markCompletionShown("session-a");
    expect(useHomeContextualStore.getState().pending?.shownOnHome).toBe(true);
  });

  it("cycles the debug preview without persisting it on reset", () => {
    const store = useHomeContextualStore.getState();

    expect(store.debugPreview).toBe("auto");
    store.cycleDebugPreview();
    expect(useHomeContextualStore.getState().debugPreview).toBe("resume");
    store.resetHomeContextual();
    expect(useHomeContextualStore.getState().debugPreview).toBe("auto");
  });
});
