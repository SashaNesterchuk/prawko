import { secureSessionStorage } from "../lib/auth-storage";

export const APP_USER_ID_STORAGE_KEY = "prawko.app_user_id";

let cachedAppUserId: string | null = null;
let inflightAppUserId: Promise<string> | null = null;

export function createAppUserId() {
  const uuid =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : createFallbackUuid();

  return `usr_${uuid}`;
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

function createFallbackUuid() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
