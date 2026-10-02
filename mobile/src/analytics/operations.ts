import { ANALYTICS_EVENTS, getAnalyticsErrorCode, type AnalyticsProperties } from "./catalog";
import { analyticsActivity } from "./activity";
import { createAnalyticsId } from "./runtime-context";
import type { AnalyticsTrack } from "../hooks/useAnalytics";

export function reportLearningOperationFailure(
  track: AnalyticsTrack,
  operation: string,
  error: unknown,
  properties: AnalyticsProperties
) {
  try {
    track(ANALYTICS_EVENTS.learningOperationFailed.key, {
      operation_id: createAnalyticsId("operation"),
      operation_id_source: properties.operation_id ? "existing_operation" : "failure_observation",
      ...properties,
      operation,
      error_code: getAnalyticsErrorCode(error),
    });
  } catch { /* Failure reporting must preserve the original error handling. */ }
}

export function createLearningIntent(properties: AnalyticsProperties) {
  const id = createAnalyticsId("intent");
  analyticsActivity.capture(ANALYTICS_EVENTS.learningIntentRequested.key, {
    ...properties,
    learning_intent_id: id,
  });
  return id;
}

/** Call only in an actual navigation handler, never while rendering hrefs. */
export function withLearningIntent(params: Record<string, string>, properties: AnalyticsProperties = {}) {
  return {
    ...params,
    analyticsIntentId: createLearningIntent({
      mode: params.mode ?? null,
      question_limit: params.questionLimit ? Number(params.questionLimit) : null,
      roadmap_step_id: params.roadmapStepId ?? null,
      topic_id: params.topic ?? null,
      ...properties,
    }),
  };
}

export function readLearningIntentId(value: unknown) {
  return typeof value === "string" &&
    /^intent_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value : null;
}
