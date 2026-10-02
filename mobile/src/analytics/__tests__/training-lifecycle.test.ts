import { createTrainingLifecycle } from "../training-lifecycle";

const unfinished = { id: "training-1", finishedAt: null, emptyReason: null };
const finished = { ...unfinished, finishedAt: "2026-10-02T10:00:00.000Z" };

describe("training analytics lifecycle", () => {
  it("emits a start for actual creation and one completion for the live transition", () => {
    const lifecycle = createTrainingLifecycle();
    lifecycle.enter(unfinished, null);
    expect(lifecycle.observe(unfinished)).toEqual({ entryEvent: "started", completed: false });
    expect(lifecycle.observe(unfinished)).toEqual({ entryEvent: null, completed: false });
    expect(lifecycle.observe(finished)).toEqual({ entryEvent: null, completed: true });
    expect(lifecycle.observe(finished)).toEqual({ entryEvent: null, completed: false });
    expect(lifecycle.resultOrigin(finished.id)).toBe("new_completion");
  });

  it("resumes an existing unfinished attempt even when it has no answers", () => {
    const lifecycle = createTrainingLifecycle();
    lifecycle.enter(unfinished, unfinished);
    expect(lifecycle.observe(unfinished)).toEqual({ entryEvent: "resumed", completed: false });
  });

  it("never emits start, resume or completion for a stored result, including remounts", () => {
    for (let visit = 0; visit < 2; visit += 1) {
      const lifecycle = createTrainingLifecycle();
      lifecycle.enter(finished, finished);
      expect(lifecycle.observe(finished)).toEqual({ entryEvent: null, completed: false });
      expect(lifecycle.resultOrigin(finished.id)).toBe("existing_result");
    }
  });

  it("preserves a live entry through repeated initialization effects", () => {
    const lifecycle = createTrainingLifecycle();
    lifecycle.enter(unfinished, null);
    lifecycle.enter(unfinished, unfinished);
    expect(lifecycle.observe(unfinished)).toEqual({ entryEvent: "started", completed: false });
  });

  it("observes a timer finish performed by startOrResumeSession", () => {
    const lifecycle = createTrainingLifecycle();
    lifecycle.enter(finished, unfinished);
    expect(lifecycle.observe(finished)).toEqual({ entryEvent: "resumed", completed: true });
    expect(lifecycle.observe(finished)).toEqual({ entryEvent: null, completed: false });
  });

  it("ignores a stale render of the previous attempt and starts a fresh restart", () => {
    const lifecycle = createTrainingLifecycle();
    lifecycle.enter(finished, finished);
    const next = { ...unfinished, id: "training-2" };
    lifecycle.enter(next, null);
    expect(lifecycle.observe(finished)).toEqual({ entryEvent: null, completed: false });
    expect(lifecycle.observe(next)).toEqual({ entryEvent: "started", completed: false });
  });

  it("does not turn an empty queue into a training completion", () => {
    const lifecycle = createTrainingLifecycle();
    const empty = { ...finished, emptyReason: "saved_empty" };
    lifecycle.enter(empty, null);
    expect(lifecycle.observe(empty)).toEqual({ entryEvent: null, completed: false });
  });
});
