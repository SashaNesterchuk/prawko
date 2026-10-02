type SessionState = {
  id: string;
  finishedAt?: string | null;
  emptyReason?: string | null;
};

export type TrainingResultOrigin = "new_completion" | "existing_result";

/**
 * Creation is determined from the store operation, not from answer count.
 * A finished session first seen on entry must never become a new completion.
 */
export function createTrainingLifecycle() {
  let entry: {
    id: string;
    kind: "started" | "resumed" | "existing_result";
    entryTracked: boolean;
    completionTracked: boolean;
  } | null = null;

  return {
    enter(session: SessionState, previous: SessionState | null) {
      if (entry?.id === session.id) {
        return;
      }
      const reused = previous?.id === session.id;
      entry = {
        id: session.id,
        kind: reused
          ? previous?.finishedAt
            ? "existing_result"
            : "resumed"
          : session.finishedAt
            ? "existing_result"
            : "started",
        entryTracked: false,
        completionTracked: false,
      };
    },
    observe(session: SessionState) {
      if (!entry || entry.id !== session.id || session.emptyReason) {
        return { entryEvent: null, completed: false } as const;
      }
      const entryEvent =
        !entry.entryTracked && entry.kind !== "existing_result"
          ? entry.kind
          : null;
      entry.entryTracked = true;
      const completed =
        Boolean(session.finishedAt) &&
        entry.kind !== "existing_result" &&
        !entry.completionTracked;
      if (completed) {
        entry.completionTracked = true;
      }
      return { entryEvent, completed };
    },
    resultOrigin(sessionId: string): TrainingResultOrigin {
      return entry?.id === sessionId && entry.kind !== "existing_result"
        ? "new_completion"
        : "existing_result";
    },
    matches(sessionId: string) {
      return entry?.id === sessionId;
    },
  };
}
