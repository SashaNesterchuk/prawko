import { ANALYTICS_EVENTS, type AnalyticsProperties } from "./catalog";
import { createAnalyticsId } from "./runtime-context";
import type { AnalyticsTrack } from "../hooks/useAnalytics";
import type { MediaEventPayloads, MediaScope } from "./critical-payloads";
import type { AnalyticsEventPayloads } from "./catalog";

export function createMediaAnalyticsTracker(input: {
  track: AnalyticsTrack;
  getProperties: () => AnalyticsProperties;
  now?: () => number;
}) {
  const now = input.now ?? Date.now;
  const loadId = createAnalyticsId("media");
  const startedAt = now();
  let started = false;
  let terminal: "ready" | "failed" | null = null;
  let played = false;
  let ended = false;
  let failedPlayback = false;
  let bufferingAt: number | null = null;
  const emit = <EventName extends keyof MediaEventPayloads>(
    event: EventName, extra: Omit<MediaEventPayloads[EventName], keyof MediaScope> & AnalyticsProperties,
  ) => {
    try {
      const payload = {
        ...input.getProperties(), media_load_id: loadId,
        media_elapsed_ms: Math.max(0, now() - startedAt), ...extra,
      };
      input.track(event, payload as AnalyticsEventPayloads[EventName]);
    } catch { /* Media behavior never depends on observation. */ }
  };
  const start = () => {
    if (started) return;
    started = true;
    emit(ANALYTICS_EVENTS.questionMediaLoadStarted.key, {});
  };
  const stopBuffering = (completed: boolean) => {
    if (bufferingAt === null) return;
    const duration = Math.max(0, now() - bufferingAt);
    bufferingAt = null;
    emit(ANALYTICS_EVENTS.questionMediaBuffering.key, {
      buffering_duration_ms: duration, buffering_completed: completed,
    });
  };
  return {
    start,
    ready: () => {
      start();
      stopBuffering(true);
      if (terminal) return;
      terminal = "ready";
      emit(ANALYTICS_EVENTS.questionMediaReady.key, { media_load_duration_ms: Math.max(0, now() - startedAt) });
    },
    fail: (code: string) => {
      start();
      stopBuffering(false);
      const stage = terminal === "ready" ? "playback" : "load";
      if (terminal === "failed" || (stage === "playback" && failedPlayback)) return;
      if (stage === "load") terminal = "failed";
      else failedPlayback = true;
      emit(ANALYTICS_EVENTS.questionMediaFailed.key, { error_code: code, media_failure_stage: stage });
    },
    playing: () => {
      start();
      stopBuffering(true);
      if (played) return;
      played = true;
      emit(ANALYTICS_EVENTS.questionMediaPlaybackStarted.key, {});
    },
    ended: () => {
      if (ended) return;
      start();
      stopBuffering(true);
      ended = true;
      emit(ANALYTICS_EVENTS.questionMediaPlaybackEnded.key, {});
    },
    buffering: () => {
      if (terminal === "ready" && bufferingAt === null) bufferingAt = now();
    },
    close: () => stopBuffering(false),
  };
}
