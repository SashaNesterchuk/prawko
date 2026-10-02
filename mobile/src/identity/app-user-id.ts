import { secureSessionStorage } from "../lib/auth-storage";
import { createUuid } from "./uuid";

export const APP_USER_ID_STORAGE_KEY = "prawko.app_user_id";

let cachedAppUserId: string | null = null;
let inflightAppUserId: Promise<string> | null = null;

export function createAppUserId() {
  return `usr_${createUuid()}`;
}

export async function getOrCreateAppUserId() {
  if (cachedAppUserId) {
    return cachedAppUserId;
  }

  if (!inflightAppUserId) {
    inflightAppUserId = loadOrCreateAppUserId();
  }

  try {
    return await inflightAppUserId;
  } finally {
    inflightAppUserId = null;
  }
}

export function peekCachedAppUserId() {
  return cachedAppUserId;
}

export function resetAppUserIdCacheForTests() {
  cachedAppUserId = null;
  inflightAppUserId = null;
}

async function loadOrCreateAppUserId() {
  const stored = (await secureSessionStorage.getItem(APP_USER_ID_STORAGE_KEY))?.trim();

  if (stored) {
    cachedAppUserId = stored;
    return stored;
  }

  const created = createAppUserId();
  await secureSessionStorage.setItem(APP_USER_ID_STORAGE_KEY, created);
  cachedAppUserId = created;
  return created;
}
