import AsyncStorage from "@react-native-async-storage/async-storage";
import { isCountryCode, type CountryCode } from "@prawko/config";

import { getExamCountry } from "../../state/app-shell";
import type { RemoteExamSession, RemoteExamSnapshot } from "./types";

function getLastSnapshotPrefix(country: CountryCode) {
  return `prawko.exam.${country}.lastSnapshot:`;
}

function getActiveSessionIdKey(country: CountryCode) {
  return `prawko.exam.${country}.activeSessionId`;
}

function getHistoryKey(country: CountryCode) {
  return `prawko.exam.${country}.history`;
}

function getSnapshotCountry(snapshot: RemoteExamSnapshot) {
  const country = snapshot.session.metadata.exam_country;
  return typeof country === "string" && isCountryCode(country) ? country : getExamCountry();
}

let cachedSnapshot: RemoteExamSnapshot | null = null;
let cachedCountry: CountryCode | null = null;
let persistChain: Promise<void> = Promise.resolve();
const listeners = new Set<(country: CountryCode, session?: RemoteExamSession) => void>();

export function subscribeExamHistory(listener: (country: CountryCode, session?: RemoteExamSession) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function notifyHistory(country: CountryCode, session?: RemoteExamSession) {
  for (const listener of listeners) {
    listener(country, session);
  }
}

export function clearExamSnapshotMemory() {
  cachedSnapshot = null;
  cachedCountry = null;
}

/**
 * Keep the latest exam snapshot in memory and on disk so both the live session
 * and answer review survive a reload / Fast Refresh, which wipes the in-memory
 * local exam store.
 */
export function cacheExamSnapshot(
  snapshot: RemoteExamSnapshot,
  country: CountryCode = getSnapshotCountry(snapshot)
) {
  if (country === getExamCountry()) {
    cachedSnapshot = snapshot;
    cachedCountry = country;
  }

  // Capture country now, not when the queued write runs after a country switch.
  persistChain = persistChain
    .then(() => persistExamSnapshot(snapshot, country))
    .catch((error) => {
      console.warn("Failed to persist exam snapshot.", error);
    });
}

export async function waitForExamSnapshotPersistForTests() {
  await flushExamSnapshotPersistence();
}

export async function flushExamSnapshotPersistence() {
  await persistChain;
}

export async function resetExamSnapshotCacheForTests() {
  await persistChain.catch(() => undefined);
  cachedSnapshot = null;
  cachedCountry = null;
  persistChain = Promise.resolve();
}

export function getCachedExamSnapshot(
  sessionId: string,
  country: CountryCode = getExamCountry()
): RemoteExamSnapshot | null {
  if (cachedCountry === country && cachedSnapshot?.session.id === sessionId) {
    return cachedSnapshot;
  }

  return null;
}

export async function loadPersistedExamSnapshot(
  sessionId: string,
  country: CountryCode = getExamCountry()
): Promise<RemoteExamSnapshot | null> {
  const memory = getCachedExamSnapshot(sessionId, country);
  if (memory) {
    return memory;
  }

  try {
    const raw = await AsyncStorage.getItem(`${getLastSnapshotPrefix(country)}${sessionId}`);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as RemoteExamSnapshot;
    if (!parsed?.session?.id || parsed.session.id !== sessionId ||
        (typeof parsed.session.metadata.exam_country === "string" &&
          isCountryCode(parsed.session.metadata.exam_country) && parsed.session.metadata.exam_country !== country)) {
      return null;
    }

    if (country === getExamCountry()) {
      cachedSnapshot = parsed;
      cachedCountry = country;
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to load persisted exam snapshot.", error);
    return null;
  }
}

/** Resolve the exam that was still running when the app was last torn down. */
export async function loadPersistedActiveExamSnapshot(
  country: CountryCode = getExamCountry()
): Promise<RemoteExamSnapshot | null> {
  try {
    await persistChain;
    const sessionId = await AsyncStorage.getItem(getActiveSessionIdKey(country));
    if (!sessionId) {
      return null;
    }

    const snapshot = await loadPersistedExamSnapshot(sessionId, country);
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
  cachedCountry = getExamCountry();
  await persistExamSnapshot(snapshot, cachedCountry);
}

async function persistExamSnapshot(snapshot: RemoteExamSnapshot, country: CountryCode) {
  await AsyncStorage.setItem(
    `${getLastSnapshotPrefix(country)}${snapshot.session.id}`,
    JSON.stringify(snapshot)
  );

  if (snapshot.session.status === "active") {
    await AsyncStorage.setItem(getActiveSessionIdKey(country), snapshot.session.id);
  } else {
    const activeSessionId = await AsyncStorage.getItem(getActiveSessionIdKey(country));
    if (activeSessionId === snapshot.session.id) {
      await AsyncStorage.removeItem(getActiveSessionIdKey(country));
    }
  }
  await writeHistory([snapshot.session], country);
  notifyHistory(country, snapshot.session);
}

/** Country-scoped history also works for guests and with no connection. */
export async function loadPersistedExamHistory(country: CountryCode = getExamCountry()) {
  await persistChain;
  return readHistory(country);
}

/**
 * A process can die after the full snapshot write but before the history/index
 * write. Discover only these missing entries; do not reread the entire history.
 */
export async function loadPersistedUnindexedExamSnapshots(
  country: CountryCode,
  indexedSessionIds: string[]
) {
  await persistChain;
  const prefix = getLastSnapshotPrefix(country);
  const indexed = new Set(indexedSessionIds);
  const sessionIds = (await AsyncStorage.getAllKeys())
    .filter((key) => key.startsWith(prefix) && !indexed.has(key.slice(prefix.length)))
    .map((key) => key.slice(prefix.length));
  const snapshots = await Promise.all(
    sessionIds.map((sessionId) => loadPersistedExamSnapshot(sessionId, country))
  );
  return snapshots.filter((snapshot): snapshot is RemoteExamSnapshot => snapshot !== null);
}

export async function mergePersistedExamHistory(
  sessions: RemoteExamSession[],
  country: CountryCode
) {
  persistChain = persistChain.then(async () => {
    await writeHistory(sessions, country);
    notifyHistory(country);
  }).catch((error) => {
    console.warn("Failed to persist exam history.", error);
  });
  await persistChain;
}

async function readHistory(country: CountryCode): Promise<RemoteExamSession[]> {
  const raw = await AsyncStorage.getItem(getHistoryKey(country));
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((session): session is RemoteExamSession =>
          typeof session?.id === "string" && typeof session?.startedAt === "string"
        );
      }
    } catch {
      // Rebuild only the summary index; full result snapshots remain intact.
    }
  }

  // Older releases saved full snapshots without an index. Discover them once
  // when first writing the index; no existing results are deleted or rewritten.
  const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
    key.startsWith(getLastSnapshotPrefix(country))
  );
  if (keys.length === 0) {
    return [];
  }
  const entries = await AsyncStorage.multiGet(keys);
  return entries.flatMap(([, value]) => {
    try {
      const snapshot = value ? JSON.parse(value) as RemoteExamSnapshot : null;
      return snapshot?.session?.id ? [snapshot.session] : [];
    } catch {
      return [];
    }
  });
}

async function writeHistory(sessions: RemoteExamSession[], country: CountryCode) {
  const byId = new Map((await readHistory(country)).map((session) => [session.id, session]));
  for (const session of sessions) {
    // Full backups belong in lastSnapshot, not in every history summary.
    const { local_exam_snapshot: _backup, ...metadata } = session.metadata;
    byId.set(session.id, { ...session, metadata });
  }
  const history = [...byId.values()].sort((left, right) =>
    right.startedAt.localeCompare(left.startedAt)
  );
  await AsyncStorage.setItem(getHistoryKey(country), JSON.stringify(history));
}
