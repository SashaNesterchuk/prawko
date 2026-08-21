#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const articleUrl = "https://en.wikipedia.org/wiki/Road_signs_in_the_Czech_Republic";
const repoRoot = new URL("..", import.meta.url).pathname;
const assetDir = join(repoRoot, "mobile", "assets", "cz-road-signs");
const dataDir = join(repoRoot, "data", "cz-road-signs-wikipedia");
const concurrency = 1;

async function curlText(url) {
  const { stdout } = await execFileAsync("curl", [
    "-L", "--fail", "--silent", "--show-error", url,
  ], { maxBuffer: 20 * 1024 * 1024 });
  return stdout;
}

async function existsNonEmpty(filePath) {
  try { return (await stat(filePath)).size > 0; } catch { return false; }
}

async function mapConcurrent(values, callback) {
  let index = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (index < values.length) {
      const current = index++;
      await callback(values[current], current);
    }
  }));
}

async function downloadWithRetry(url, target) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      await execFileAsync("curl", ["-L", "--fail", "--silent", "--show-error", "-o", target, url]);
      return;
    } catch (error) {
      if (attempt === 8) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
}

const page = await curlText(articleUrl);
const namesByCode = new Map();
for (const match of page.matchAll(
  /(?:https?:)?\/\/upload\.wikimedia\.org\/wikipedia\/commons\/thumb\/[^\s"']+\/(?:120|250)px-(Czech_Republic_road_sign_([A-Z]+)_([0-9]+[a-z]?)\.svg)\.png[^\s"']*/g
)) {
  const [rawThumbnailUrl, filename, family, number] = match;
  const code = `${family}-${number}`;
  namesByCode.set(code, {
    filename,
    family,
    number,
    // The article already contains CDN URLs; use a 250px PNG rather than
    // hundreds of file-page redirects, which Wikimedia rate-limits.
    thumbnailUrl: `${rawThumbnailUrl.startsWith("//") ? "https:" : ""}${rawThumbnailUrl.replace(/&amp;/g, "&").replace("/120px-", "/250px-")}`,
  });
}
const names = [...namesByCode.values()]
  .sort((left, right) => `${left.family}-${left.number}`.localeCompare(`${right.family}-${right.number}`, "cs", { numeric: true }));

if (names.length === 0) throw new Error("No Czech road-sign SVGs found in the Wikipedia article.");
await mkdir(assetDir, { recursive: true });
await mkdir(dataDir, { recursive: true });

let downloaded = 0;
let skipped = 0;
await mapConcurrent(names, async (sign) => {
  const code = `${sign.family}-${sign.number}`;
  const target = join(assetDir, `CZ_road_sign_${code}.png`);
  if (await existsNonEmpty(target)) {
    skipped += 1;
    return;
  }
  await downloadWithRetry(sign.thumbnailUrl, target);
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  downloaded += 1;
});

const signs = names.map((sign) => {
  const code = `${sign.family}-${sign.number}`;
  return {
    id: code,
    code,
    categoryId: sign.family,
    name: { cs: code },
    description: { cs: code },
    assetFile: `CZ_road_sign_${code}.png`,
    source: {
      articleUrl,
      filePageUrl: `https://en.wikipedia.org/wiki/File:${sign.filename}`,
      thumbnailUrl: sign.thumbnailUrl,
      license: "See Wikimedia file page",
    },
  };
});
await writeFile(join(dataDir, "manifest.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(), articleUrl, count: signs.length,
  downloaded, skipped, signs,
}, null, 2)}\n`);
await writeFile(join(dataDir, "metadata.generated.json"), `${JSON.stringify(
  Object.fromEntries(signs.map((sign) => [sign.id, {
    id: sign.id, categoryId: sign.categoryId, name: sign.name, description: sign.description,
  }])), null, 2)}\n`);
console.log(JSON.stringify({ count: signs.length, downloaded, skipped, assetDir, dataDir }, null, 2));
