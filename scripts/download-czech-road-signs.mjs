#!/usr/bin/env node

/**
 * Downloads the Czech sign diagrams grouped by their official code on
 * Wikimedia Commons. The generated manifest preserves source URLs and licenses
 * alongside every bundled asset; it does not touch R2 or question media.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { promisify } from "node:util";

const apiUrl = "https://commons.wikimedia.org/w/api.php";
const rootCategory = "Category:Road signs of the Czech Republic by number";
const repoRoot = new URL("..", import.meta.url).pathname;
const assetDir = join(repoRoot, "mobile", "assets", "cz-road-signs");
const dataDir = join(repoRoot, "data", "cz-road-signs-wikimedia");
// Commons throttles category traversal; keep this deliberately polite.
const concurrency = 1;
const apiRequestDelayMs = 1_000;
const execFileAsync = promisify(execFile);

function queryString(params) {
  return new URLSearchParams({ format: "json", formatversion: "2", ...params });
}

async function api(params) {
  const url = `${apiUrl}?${queryString(params)}`;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      // Curl is the same client used for the initial catalogue verification and
      // is not throttled like undici by the Commons edge in this environment.
      const { stdout } = await execFileAsync("curl", [
        "-L", "--fail", "--silent", "--show-error", url,
      ], { maxBuffer: 10 * 1024 * 1024 });
      await new Promise((resolve) => setTimeout(resolve, apiRequestDelayMs));
      return JSON.parse(stdout);
    } catch (error) {
      if (attempt === 6) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    }
  }
  throw new Error("Commons API retry loop unexpectedly ended.");
}

async function categoryMembers(title, type) {
  const result = [];
  let continuation = {};
  do {
    const payload = await api({
      action: "query", list: "categorymembers", cmtitle: title,
      cmtype: type, cmlimit: "max", ...continuation,
    });
    result.push(...(payload.query?.categorymembers ?? []));
    continuation = payload.continue ?? {};
  } while (Object.keys(continuation).length > 0);
  return result;
}

function parseCategory(title) {
  const match = title.match(/^Category:([A-Z]+)\s+(\d+[a-z]?)\s+(.+)\s+\(Czech road sign\)$/u);
  if (!match) return null;
  const [, family, number, name] = match;
  const code = `${family}-${number}`;
  return { code, family, name, categoryTitle: title };
}

async function mapConcurrent(values, callback) {
  const output = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next++;
      output[index] = await callback(values[index], index);
    }
  }));
  return output;
}

async function imageInfo(fileTitles) {
  const result = new Map();
  for (let index = 0; index < fileTitles.length; index += 40) {
    const titles = fileTitles.slice(index, index + 40);
    const payload = await api({
      action: "query", prop: "imageinfo", iiprop: "url|mime|extmetadata",
      titles: titles.join("|"),
    });
    for (const page of payload.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      if (info?.url) result.set(page.title, info);
    }
  }
  return result;
}

function extension(title, mime) {
  if (mime === "image/svg+xml") return "svg";
  const matched = title.match(/\.([a-z0-9]+)$/iu);
  return matched?.[1]?.toLowerCase() ?? "bin";
}

async function existsNonEmpty(filePath) {
  try { return (await stat(filePath)).size > 0; } catch { return false; }
}

const rootMembers = await categoryMembers(rootCategory, "subcat");
const categories = rootMembers.map((member) => parseCategory(member.title)).filter(Boolean);
if (categories.length === 0) throw new Error("No coded Czech road-sign categories found on Commons.");

await mkdir(assetDir, { recursive: true });
await mkdir(dataDir, { recursive: true });

const categoryFiles = await mapConcurrent(categories, async (category) => ({
  category,
  files: await categoryMembers(category.categoryTitle, "file"),
}));
const sourceRows = categoryFiles.flatMap(({ category, files }) =>
  files.map((file) => ({ ...category, sourceTitle: file.title }))
);
const infoByTitle = await imageInfo([...new Set(sourceRows.map((row) => row.sourceTitle))]);

const candidates = sourceRows.flatMap((row) => {
  const info = infoByTitle.get(row.sourceTitle);
  if (!info || !["image/svg+xml", "image/png"].includes(info.mime)) return [];
  return [{ ...row, info }];
});

const duplicateCodes = new Map();
for (const candidate of candidates) {
  const existing = duplicateCodes.get(candidate.code) ?? [];
  existing.push(candidate);
  duplicateCodes.set(candidate.code, existing);
}
const selected = [...duplicateCodes.values()].map((entries) =>
  entries.sort((left, right) => Number(right.info.mime === "image/svg+xml") - Number(left.info.mime === "image/svg+xml"))[0]
).sort((left, right) => left.code.localeCompare(right.code, "cs", { numeric: true }));

let downloaded = 0;
let skipped = 0;
const manifest = await mapConcurrent(selected, async (entry) => {
  const ext = extension(entry.sourceTitle, entry.info.mime);
  const filename = `CZ_road_sign_${entry.code.replace(/[^A-Za-z0-9-]/g, "_")}.${ext}`;
  const destination = join(assetDir, filename);
  if (await existsNonEmpty(destination)) {
    skipped += 1;
  } else {
    const response = await fetch(entry.info.url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok || !response.body) throw new Error(`${entry.code}: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
    downloaded += 1;
  }
  const metadata = entry.info.extmetadata ?? {};
  return {
    id: entry.code,
    code: entry.code,
    categoryId: entry.family,
    name: { cs: entry.name },
    description: { cs: entry.name },
    assetFile: filename,
    source: {
      commonsTitle: entry.sourceTitle,
      url: entry.info.url,
      license: metadata.LicenseShortName?.value ?? null,
      licenseUrl: metadata.LicenseUrl?.value ?? null,
      artist: metadata.Artist?.value ?? null,
      attributionRequired: metadata.AttributionRequired?.value ?? null,
    },
  };
});

await writeFile(join(dataDir, "manifest.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(), rootCategory, count: manifest.length,
  downloaded, skipped, signs: manifest,
}, null, 2)}\n`);
await writeFile(join(dataDir, "metadata.generated.json"), `${JSON.stringify(
  Object.fromEntries(manifest.map((sign) => [sign.id, {
    id: sign.id, categoryId: sign.categoryId, name: sign.name, description: sign.description,
  }])), null, 2)}\n`);

console.log(JSON.stringify({ total: manifest.length, downloaded, skipped, assetDir, dataDir }, null, 2));
