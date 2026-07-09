import fs from "node:fs/promises";
import path from "node:path";

import { REPO_ROOT } from "./constants";
import { pathExists } from "./utils";

const DEFAULT_ENV_FILES = [
  path.join(REPO_ROOT, ".env.local"),
  path.join(REPO_ROOT, ".env"),
  path.join(REPO_ROOT, "mobile", ".env.local"),
  path.join(REPO_ROOT, ".env.example"),
];

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const rawValue = trimmed.slice(separatorIndex + 1).trim();
  const value = rawValue.replace(/^['"]|['"]$/g, "");

  if (!key) {
    return null;
  }

  return [key, value];
}

export async function loadLocalEnvFiles(
  envFiles = DEFAULT_ENV_FILES
): Promise<string[]> {
  const loadedFiles: string[] = [];

  for (const envFile of envFiles) {
    if (!(await pathExists(envFile))) {
      continue;
    }

    const contents = await fs.readFile(envFile, "utf8");
    for (const line of contents.split(/\r?\n/g)) {
      const parsed = parseEnvLine(line);
      if (!parsed) {
        continue;
      }

      const [key, value] = parsed;
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }

    loadedFiles.push(envFile);
  }

  return loadedFiles;
}
