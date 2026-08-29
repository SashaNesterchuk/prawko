import type { DrivingCategory } from "@prawko/config";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { mobileEnv } from "../../config/env";
import { getQuestionSetKey } from "../../countries/runtime";
import type { LocalQuestion } from "./types";

/**
 * The question catalog is effectively static: a few thousand rows that change
 * when content is edited, not per session. Downloading all of it on every cold
 * start costs seconds, so the mapped catalog is kept on disk and only replaced
 * when a cheap freshness probe says the remote content moved.
 */
const CATALOG_CACHE_DIR_NAME = "prawko-question-catalog";

/** Bump whenever LocalQuestion or its Supabase mapping changes shape. */
const CATALOG_CACHE_VERSION = 2;

export type QuestionCatalogSignature = {
  explanationCount: number;
  explanationsUpdatedAt: string | null;
  questionCount: number;
  questionsUpdatedAt: string | null;
};

export type CachedQuestionCatalog = {
  category: DrivingCategory;
  questions: LocalQuestion[];
  savedAt: string;
  signature: QuestionCatalogSignature;
};

type PersistedQuestionCatalogCache = CachedQuestionCatalog & {
  version: number;
};

export function areQuestionCatalogSignaturesEqual(
  left: QuestionCatalogSignature | null | undefined,
  right: QuestionCatalogSignature | null | undefined
) {
  if (!left || !right) {
    return false;
  }

  return (
    left.explanationCount === right.explanationCount &&
    left.explanationsUpdatedAt === right.explanationsUpdatedAt &&
    left.questionCount === right.questionCount &&
    left.questionsUpdatedAt === right.questionsUpdatedAt
  );
}

export function isQuestionCatalogCacheSupported() {
  // E2E flows seed their own catalog and must not inherit a previous run.
  return Platform.OS !== "web" && !mobileEnv.enableE2ETestMode;
}

export async function readQuestionCatalogCache(
  category: DrivingCategory
): Promise<CachedQuestionCatalog | null> {
  if (!isQuestionCatalogCacheSupported()) {
    return null;
  }

  try {
    const file = getCatalogCacheFile(category);

    if (!file.exists) {
      return null;
    }

    return parseCachedQuestionCatalog(
      JSON.parse(await file.text()) as unknown,
      category
    );
  } catch {
    return null;
  }
}

export async function writeQuestionCatalogCache(
  cache: CachedQuestionCatalog
): Promise<void> {
  if (!isQuestionCatalogCacheSupported() || cache.questions.length === 0) {
    return;
  }

  const payload: PersistedQuestionCatalogCache = {
    ...cache,
    version: CATALOG_CACHE_VERSION,
  };

  // Serializing the whole catalog is heavy, so let the caller's frame finish
  // painting the freshly hydrated bank first.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));

  const directory = getCatalogCacheDirectory();

  if (!directory.exists) {
    directory.create({ idempotent: true, intermediates: true });
  }

  const file = getCatalogCacheFile(cache.category);

  file.create({ intermediates: true, overwrite: true });
  file.write(JSON.stringify(payload));

  pruneOtherCategoryCaches(cache.category);
}

export function clearQuestionCatalogCache() {
  if (!isQuestionCatalogCacheSupported()) {
    return;
  }

  try {
    const directory = getCatalogCacheDirectory();

    if (directory.exists) {
      directory.delete();
    }
  } catch {
    // A stale cache is validated by signature anyway.
  }
}

function parseCachedQuestionCatalog(
  value: unknown,
  category: DrivingCategory
): CachedQuestionCatalog | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PersistedQuestionCatalogCache>;

  if (
    candidate.version !== CATALOG_CACHE_VERSION ||
    candidate.category !== category ||
    !Array.isArray(candidate.questions) ||
    candidate.questions.length === 0
  ) {
    return null;
  }

  const signature = parseSignature(candidate.signature);

  if (!signature) {
    return null;
  }

  return {
    category,
    questions: candidate.questions as LocalQuestion[],
    savedAt:
      typeof candidate.savedAt === "string"
        ? candidate.savedAt
        : new Date(0).toISOString(),
    signature,
  };
}

function parseSignature(value: unknown): QuestionCatalogSignature | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<QuestionCatalogSignature>;

  if (
    !Number.isFinite(candidate.questionCount) ||
    !Number.isFinite(candidate.explanationCount)
  ) {
    return null;
  }

  return {
    explanationCount: candidate.explanationCount as number,
    explanationsUpdatedAt:
      typeof candidate.explanationsUpdatedAt === "string"
        ? candidate.explanationsUpdatedAt
        : null,
    questionCount: candidate.questionCount as number,
    questionsUpdatedAt:
      typeof candidate.questionsUpdatedAt === "string"
        ? candidate.questionsUpdatedAt
        : null,
  };
}

function pruneOtherCategoryCaches(category: DrivingCategory) {
  try {
    const keptFileName = getCatalogCacheFileName(category);

    for (const entry of getCatalogCacheDirectory().list()) {
      if (entry instanceof File && entry.name !== keptFileName) {
        entry.delete();
      }
    }
  } catch {
    // Leftover files only cost disk space.
  }
}

function getCatalogCacheDirectory() {
  // Regenerable content lives in the cache directory: it stays out of iCloud
  // backups, and an OS eviction just costs one download.
  return new Directory(Paths.cache, CATALOG_CACHE_DIR_NAME);
}

function getCatalogCacheFileName(category: DrivingCategory) {
  const setKey = getQuestionSetKey().replace(/[^a-z0-9_-]/gi, "_");
  return `${setKey}-${category}.json`;
}

function getCatalogCacheFile(category: DrivingCategory) {
  return new File(getCatalogCacheDirectory(), getCatalogCacheFileName(category));
}
