#!/usr/bin/env node

import { spawn } from "node:child_process";
import { cp, mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const sourceRoot = path.resolve(
  process.argv[2] ?? path.join(repoRoot, "..", "czech-etesty-questions-2026-08-19", "media-opt")
);
const outputRoot = path.resolve(
  process.argv[3] ?? path.join(path.dirname(sourceRoot), "media-webp")
);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif"]);
const concurrency = 3;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code ?? "unknown"}.`))
    );
  });
}

async function listFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return listFiles(entryPath);
    return entry.isFile() && entry.name !== "optimization-report.json" ? [entryPath] : [];
  }));
  return nested.flat();
}

function targetPath(sourcePath) {
  const relativePath = path.relative(sourceRoot, sourcePath);
  const extension = path.extname(relativePath).toLowerCase();
  return imageExtensions.has(extension)
    ? path.join(outputRoot, `${relativePath.slice(0, -extension.length)}.webp`)
    : path.join(outputRoot, relativePath);
}

async function convertOne(sourcePath) {
  const sourceSize = (await stat(sourcePath)).size;
  const extension = path.extname(sourcePath).toLowerCase();
  const destinationPath = targetPath(sourcePath);
  const temporaryPath = `${destinationPath}.converting.webp`;
  await mkdir(path.dirname(destinationPath), { recursive: true });

  if (!imageExtensions.has(extension)) {
    await cp(sourcePath, destinationPath);
    return { sourceSize, outputSize: sourceSize, converted: false };
  }

  await rm(temporaryPath, { force: true });
  try {
    await run("ffmpeg", [
      "-y", "-v", "error", "-i", sourcePath,
      "-map_metadata", "0", "-c:v", "libwebp", "-q:v", "90",
      "-compression_level", "6", "-loop", "0", temporaryPath,
    ]);
    const outputSize = (await stat(temporaryPath)).size;
    await rename(temporaryPath, destinationPath);
    return { sourceSize, outputSize, converted: true };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw new Error(`${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const files = (await listFiles(sourceRoot)).sort();
await mkdir(outputRoot, { recursive: true });
let cursor = 0;
let sourceBytes = 0;
let outputBytes = 0;
let convertedFiles = 0;
let copiedFiles = 0;

async function worker() {
  while (cursor < files.length) {
    const result = await convertOne(files[cursor++]);
    sourceBytes += result.sourceSize;
    outputBytes += result.outputSize;
    if (result.converted) convertedFiles += 1;
    else copiedFiles += 1;
    const processed = convertedFiles + copiedFiles;
    if (processed % 25 === 0 || processed === files.length) console.log(`Converted ${processed}/${files.length}`);
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  outputRoot,
  profile: { images: "WebP quality 90", videos: "copied from media-opt" },
  totalFiles: files.length,
  convertedFiles,
  copiedFiles,
  sourceBytes,
  outputBytes,
  savedBytes: sourceBytes - outputBytes,
};
await writeFile(path.join(outputRoot, "conversion-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
