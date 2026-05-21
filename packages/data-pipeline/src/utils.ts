import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  DELIVERY_ASSETS_DIR,
  DELIVERY_GENERATED_DIR,
  EXPORTS_GENERATED_DIR,
  INTERIM_GENERATED_DIR,
  NORMALIZED_GENERATED_DIR,
  REPO_ROOT,
} from "./constants";

export function normalizeToken(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function toTrimmedString(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function toNullableString(value: unknown): string | null {
  const trimmed = toTrimmedString(value);
  return trimmed.length > 0 ? trimmed : null;
}

export function splitCategories(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[,;|/ ]+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);
}

export function parseInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const matched = value.match(/\d+/);
  if (!matched) {
    return null;
  }

  const parsed = Number.parseInt(matched[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hashToRange(value: string, min: number, max: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  const range = max - min + 1;
  return min + (Math.abs(hash) % range);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function ensureGeneratedDirs(): Promise<void> {
  await Promise.all([
    ensureDir(INTERIM_GENERATED_DIR),
    ensureDir(NORMALIZED_GENERATED_DIR),
    ensureDir(EXPORTS_GENERATED_DIR),
    ensureDir(DELIVERY_GENERATED_DIR),
    ensureDir(DELIVERY_ASSETS_DIR),
  ]);
}

export async function writeJsonFile(
  filePath: string,
  payload: unknown
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const contents = await fs.readFile(filePath, "utf8");
  return JSON.parse(contents) as T;
}

export async function readJsonFileIfExists<T>(
  filePath: string
): Promise<T | null> {
  try {
    return await readJsonFile<T>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function listFilesRecursive(rootDir: string): Promise<string[]> {
  if (!(await pathExists(rootDir))) {
    return [];
  }

  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const targetPath = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return listFilesRecursive(targetPath);
      }
      return [targetPath];
    })
  );

  return nested.flat().sort();
}

export async function resolveNewestFile(
  dirPath: string,
  extensions: string[]
): Promise<string | null> {
  const files = (await listFilesRecursive(dirPath)).filter((filePath) =>
    extensions.some((extension) => filePath.toLowerCase().endsWith(extension))
  );

  if (files.length === 0) {
    return null;
  }

  const withStats = await Promise.all(
    files.map(async (filePath) => ({
      filePath,
      stat: await fs.stat(filePath),
    }))
  );

  return withStats
    .sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs)[0]
    ?.filePath ?? null;
}

export function relativeToRepo(targetPath: string): string {
  return path.relative(REPO_ROOT, targetPath) || ".";
}

export function incrementCounter(
  record: Record<string, number>,
  key: string
): void {
  record[key] = (record[key] ?? 0) + 1;
}

export function normalizeFilenameForLookup(value: string): string {
  return path
    .basename(value)
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function slugifySegment(value: string): string {
  return normalizeToken(value).replace(/\s+/g, "-") || "asset";
}

export function shortHash(value: string, length = 10): string {
  return createHash("sha1").update(value).digest("hex").slice(0, length);
}

export function resolveRepoPath(relativeOrAbsolutePath: string): string {
  return path.isAbsolute(relativeOrAbsolutePath)
    ? relativeOrAbsolutePath
    : path.resolve(REPO_ROOT, relativeOrAbsolutePath);
}
