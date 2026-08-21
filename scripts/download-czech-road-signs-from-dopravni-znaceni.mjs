#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sourceOrigin = "http://www.dopravni-znaceni.eu";
const indexUrl = `${sourceOrigin}/znacky/`;
const repoRoot = new URL("..", import.meta.url).pathname;
const assetDir = join(repoRoot, "mobile", "assets", "cz-road-signs", "dopravni-znaceni-eu");
const dataDir = join(repoRoot, "data", "cz-road-signs-dopravni-znaceni-eu");
const delayMs = 750;
const decoder = new TextDecoder("iso-8859-2");

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function curlBytes(url) {
  const { stdout } = await execFileAsync(
    "curl",
    ["-L", "--fail", "--silent", "--show-error", url],
    { encoding: "buffer", maxBuffer: 20 * 1024 * 1024 }
  );
  return stdout;
}

async function curlText(url) {
  return decoder.decode(await curlBytes(url));
}

async function existsNonEmpty(filePath) {
  try {
    return (await stat(filePath)).size > 0;
  } catch {
    return false;
  }
}

async function downloadWithRetry(url, target) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await execFileAsync("curl", ["-L", "--fail", "--silent", "--show-error", "-o", target, url]);
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await sleep(attempt * 2_000);
    }
  }
}

function sourceCodeToId(sourceCode) {
  const match = sourceCode.match(/^([A-Z]+)0*(\d+[a-z]?)$/);
  if (!match) return sourceCode;
  return `${match[1]}-${match[2]}`;
}

function parseCategoryLinks(indexHtml) {
  return [...indexHtml.matchAll(/href="(\/znacky\/[^"?#]+\/?)"/g)]
    .map((match) => match[1])
    .filter((path) => path !== "/znacky/")
    .filter((path, index, paths) => paths.indexOf(path) === index);
}

function parseSigns(page, categoryPath) {
  const namesByFile = new Map();
  for (const match of page.matchAll(
    /<a href="[^"]*\/(?:[A-Z]+\d+[a-z]?)\/">\s*<strong>([A-Z]+\d+[a-z]?)<\/strong><span>([^<]+)<\/span>/g
  )) {
    namesByFile.set(`${match[1]}.jpg`, { sourceCode: match[1], name: match[2].trim() });
  }

  return [...page.matchAll(/<img src="(\/dopravni-znacky\/([A-Z]+\d+[a-z]?)\.jpg)"/g)]
    .map((match) => {
      const fileName = `${match[2]}.jpg`;
      const metadata = namesByFile.get(fileName);
      return {
        id: sourceCodeToId(match[2]),
        sourceCode: match[2],
        name: metadata?.name ?? match[2],
        categoryPath,
        sourcePath: match[1],
        assetFile: fileName,
      };
    });
}

await mkdir(assetDir, { recursive: true });
await mkdir(dataDir, { recursive: true });

const indexHtml = await curlText(indexUrl);
await sleep(delayMs);
const categoryPaths = parseCategoryLinks(indexHtml);
if (categoryPaths.length === 0) throw new Error("No Czech road-sign category links found.");

const signsBySourcePath = new Map();
for (const categoryPath of categoryPaths) {
  const page = await curlText(`${sourceOrigin}${categoryPath}`);
  for (const sign of parseSigns(page, categoryPath)) signsBySourcePath.set(sign.sourcePath, sign);
  await sleep(delayMs);
}
const signs = [...signsBySourcePath.values()].sort((left, right) =>
  left.id.localeCompare(right.id, "cs", { numeric: true })
);
if (signs.length === 0) throw new Error("No Czech road-sign images found in the category pages.");

let downloaded = 0;
let skipped = 0;
for (const sign of signs) {
  const target = join(assetDir, sign.assetFile);
  if (await existsNonEmpty(target)) {
    skipped += 1;
  } else {
    await downloadWithRetry(`${sourceOrigin}${sign.sourcePath}`, target);
    downloaded += 1;
  }
  await sleep(delayMs);
}

await writeFile(join(dataDir, "manifest.json"), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: {
    indexUrl,
    copyrightNotice: "Copyright People For Net a.s. No open licence was published on the source site.",
  },
  count: signs.length,
  downloaded,
  skipped,
  signs,
}, null, 2)}\n`);

console.log(JSON.stringify({ count: signs.length, downloaded, skipped, assetDir, dataDir }, null, 2));
