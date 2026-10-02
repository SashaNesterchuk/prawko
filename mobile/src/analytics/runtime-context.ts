import { createUuid } from "../identity/uuid";
import { ANALYTICS_PROPERTIES } from "./catalog";

export function createAnalyticsId(prefix: string) {
  try {
    return `${prefix}_${createUuid()}`;
  } catch {
    // A broken native UUID implementation must not block a product handler.
    const id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const value = Math.floor(Math.random() * 16);
      return (character === "x" ? value : (value & 3) | 8).toString(16);
    });
    return `${prefix}_${id}`;
  }
}

const appRunId = createAnalyticsId("run");
let eventSequence = 0;

/** One ordering domain per JS runtime, not a user visit or PostHog session. */
export function nextAnalyticsEventContext() {
  eventSequence += 1;
  return {
    [ANALYTICS_PROPERTIES.analyticsSchemaVersion]: 3,
    [ANALYTICS_PROPERTIES.appRunId]: appRunId,
    [ANALYTICS_PROPERTIES.clientOccurredAt]: new Date().toISOString(),
    [ANALYTICS_PROPERTIES.eventId]: `${appRunId}:${eventSequence}`,
    [ANALYTICS_PROPERTIES.eventSequence]: eventSequence,
  };
}
