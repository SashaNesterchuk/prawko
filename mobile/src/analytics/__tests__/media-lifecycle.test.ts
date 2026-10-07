import { createMediaAnalyticsTracker } from "../media-lifecycle";

describe("media analytics lifecycle", () => {
  const track = jest.fn();
  let now = 0;
  const makeTracker = () => createMediaAnalyticsTracker({
    track, now: () => now, getProperties: () => ({ question_id: "q-1", media_revision: "rev-1" }),
  });
  beforeEach(() => { now = 0; });

  it("has one load denominator and one readiness outcome even when callbacks repeat", () => {
    const tracker = makeTracker();
    tracker.ready();
    tracker.start();
    tracker.ready();
    expect(track.mock.calls.map(([event]) => event)).toEqual(["question_media_load_started", "question_media_ready"]);
    expect(track.mock.calls[0][1].media_load_id).toBe(track.mock.calls[1][1].media_load_id);
  });

  it("distinguishes missing/load failure from a later playback failure", () => {
    const unavailable = makeTracker();
    unavailable.fail("asset_unavailable");
    unavailable.ready();
    expect(track.mock.calls[1][1].media_failure_stage).toBe("load");
    expect(track).toHaveBeenCalledTimes(2);
    const playback = makeTracker();
    playback.ready();
    playback.fail("decode_error");
    playback.fail("decode_error");
    expect(track.mock.calls.at(-1)?.[1].media_failure_stage).toBe("playback");
  });

  it("observes actual start/end once and censors interrupted buffering", () => {
    const tracker = makeTracker();
    tracker.ready();
    tracker.playing();
    tracker.playing();
    now = 10;
    tracker.buffering();
    now = 110;
    tracker.close();
    tracker.ended();
    tracker.ended();
    expect(track.mock.calls.filter(([event]) => event === "question_media_playback_started")).toHaveLength(1);
    expect(track.mock.calls.filter(([event]) => event === "question_media_playback_ended")).toHaveLength(1);
    expect(track.mock.calls.find(([event]) => event === "question_media_buffering")?.[1]).toMatchObject({
      buffering_duration_ms: 100, buffering_completed: false,
    });
  });

  it("completes buffering on native readiness without duplicating load readiness", () => {
    const tracker = makeTracker();
    tracker.ready();
    now = 10;
    tracker.buffering();
    now = 60;
    tracker.ready();
    expect(track.mock.calls.at(-1)?.[1]).toMatchObject({ buffering_duration_ms: 50, buffering_completed: true });
    expect(track.mock.calls.filter(([event]) => event === "question_media_ready")).toHaveLength(1);
  });

  it("isolates telemetry errors from native/UI callbacks", () => {
    track.mockImplementationOnce(() => { throw new Error("observer failed"); });
    expect(() => makeTracker().ready()).not.toThrow();
  });
});
