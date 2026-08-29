import AsyncStorage from "@react-native-async-storage/async-storage";

import { getExamCountry } from "../../state/app-shell";
import type { RemoteExamSnapshot } from "./types";

function getLastSnapshotPrefix() {
  return `prawko.exam.${getExamCountry()}.lastSnapshot:`;
}

function getActiveSessionIdKey() {
  return `prawko.exam.${getExamCountry()}.activeSessionId`;
}

let cachedSnapshot: RemoteExamSnapshot | null = null;
let persistChain: Promise<void> = Promise.resolve();

export function clearExamSnapshotMemory() {
  cachedSnapshot = null;
}

/**
 * Keep the latest exam snapshot in memory and on disk so both the live session
 * and answer review survive a reload / Fast Refresh, which wipes the in-memory
 * local exam store.
 */
export function cacheExamSnapshot(snapshot: RemoteExamSnapshot) {
  cachedSnapshot = snapshot;

  persistChain = persistChain
    .then(() => persistExamSnapshot(snapshot))
    .catch((error) => {
      console.warn("Failed to persist exam snapshot.", error);
    });
}

export async function waitForExamSnapshotPersistForTests() {
  await persistChain;
}

export async function resetExamSnapshotCacheForTests() {
  await persistChain.catch(() => undefined);
  cachedSnapshot = null;
  persistChain = Promise.resolve();
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
    const raw = await AsyncStorage.getItem(`${getLastSnapshotPrefix()}${sessionId}`);
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
    const sessionId = await AsyncStorage.getItem(getActiveSessionIdKey());
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

export async function seedPersistedExamSnapshot(snapshot: RemoteExamSnapshot) {
  cachedSnapshot = snapshot;
  await persistExamSnapshot(snapshot);
}

async function persistExamSnapshot(snapshot: RemoteExamSnapshot) {
  await AsyncStorage.setItem(
    `${getLastSnapshotPrefix()}${snapshot.session.id}`,
    JSON.stringify(snapshot)
  );

  if (snapshot.session.status === "active") {
    await AsyncStorage.setItem(getActiveSessionIdKey(), snapshot.session.id);
    return;
  }

  const activeSessionId = await AsyncStorage.getItem(getActiveSessionIdKey());
  if (activeSessionId === snapshot.session.id) {
    await AsyncStorage.removeItem(getActiveSessionIdKey());
  }
}
