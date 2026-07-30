import AsyncStorage from "@react-native-async-storage/async-storage";

import type { RemoteExamSnapshot } from "./types";

const LAST_SNAPSHOT_PREFIX = "prawko.exam.lastSnapshot:";
const ACTIVE_SESSION_ID_KEY = "prawko.exam.activeSessionId";

let cachedSnapshot: RemoteExamSnapshot | null = null;

/**
 * Keep the latest exam snapshot in memory and on disk so both the live session
 * and answer review survive a reload / Fast Refresh, which wipes the in-memory
 * local exam store.
 */
export function cacheExamSnapshot(snapshot: RemoteExamSnapshot) {
  cachedSnapshot = snapshot;

  void persistExamSnapshot(snapshot).catch((error) => {
    console.warn("Failed to persist exam snapshot.", error);
  });
}

export function getCachedExamSnapshot(
  sessionId: string
): RemoteExamSnapshot | null {
  if (cachedSnapshot?.session.id === sessionId) {
    return cachedSnapshot;
  }

  return null;
}

export async function loadPersistedExamSnapshot(
  sessionId: string
): Promise<RemoteExamSnapshot | null> {
  const memory = getCachedExamSnapshot(sessionId);
  if (memory) {
    return memory;
  }

  try {
    const raw = await AsyncStorage.getItem(`${LAST_SNAPSHOT_PREFIX}${sessionId}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as RemoteExamSnapshot;
    if (!parsed?.session?.id || parsed.session.id !== sessionId) {
      return null;
    }

    cachedSnapshot = parsed;
    return parsed;
  } catch (error) {
    console.warn("Failed to load persisted exam snapshot.", error);
    return null;
  }
}

/** Resolve the exam that was still running when the app was last torn down. */
export async function loadPersistedActiveExamSnapshot(): Promise<RemoteExamSnapshot | null> {
  try {
    const sessionId = await AsyncStorage.getItem(ACTIVE_SESSION_ID_KEY);
    if (!sessionId) {
      return null;
    }

    const snapshot = await loadPersistedExamSnapshot(sessionId);
    if (!snapshot || snapshot.session.status !== "active") {
      return null;
    }

    return snapshot;
  } catch (error) {
    console.warn("Failed to load persisted active exam session.", error);
    return null;
  }
}

export function sortExamQuestionsByOrder(
  questions: RemoteExamSnapshot["questions"] | null | undefined
) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return [];
  }

  return [...questions].sort((left, right) => left.order - right.order);
}

export function isFinishedExamStatus(
  status: RemoteExamSnapshot["session"]["status"]
) {
  return (
    status === "completed" || status === "abandoned" || status === "expired"
  );
}

async function persistExamSnapshot(snapshot: RemoteExamSnapshot) {
  await AsyncStorage.setItem(
    `${LAST_SNAPSHOT_PREFIX}${snapshot.session.id}`,
    JSON.stringify(snapshot)
  );

  if (snapshot.session.status === "active") {
    await AsyncStorage.setItem(ACTIVE_SESSION_ID_KEY, snapshot.session.id);
    return;
  }

  const activeSessionId = await AsyncStorage.getItem(ACTIVE_SESSION_ID_KEY);
  if (activeSessionId === snapshot.session.id) {
    await AsyncStorage.removeItem(ACTIVE_SESSION_ID_KEY);
  }
}
