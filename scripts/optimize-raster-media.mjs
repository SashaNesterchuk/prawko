#!/usr/bin/env node

import { spawn } from "node:child_process";
import { readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = new URL("..", import.meta.url).pathname;
const roots = [
  path.join(repoRoot, "data", "questions", "delivery", "generated", "assets"),
  path.join(repoRoot, "mobile", "assets", "cz-road-signs", "dopravni-znaceni-eu"),
];
const reportPath = path.join(
  repoRoot,
  "data",
  "questions",
  "delivery",
  "generated",
  "raster-optimization-report.json"
);
const concurrency = 3;
const jpegExtensions = new Set([".jpg", ".jpeg"]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code ?? "unknown"}.`))
    );
  });
}

async function listRasterFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listRasterFiles(entryPath);
      return jpegExtensions.has(path.extname(entry.name).toLowerCase()) ? [entryPath] : [];
    })
  );
  return nested.flat();
}

async function optimize(filePath) {
  const originalSize = (await stat(filePath)).size;
  const temporaryPath = `${filePath}.optimizing.jpg`;

  try {
    await run("ffmpeg", [
      "-y",
      "-v", "error",
      "-i", filePath,
      "-map_metadata", "0",
      "-q:v", "2",
      "-threads", "1",
      temporaryPath,
    ]);
    await run("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,width,height",
      "-of", "default=noprint_wrappers=1",
      temporaryPath,
    ]);

    const optimizedSize = (await stat(temporaryPath)).size;
    if (optimizedSize < originalSize) {
      await rename(temporaryPath, filePath);
      return { optimized: true, originalSize, optimizedSize };
    }

    await rm(temporaryPath, { force: true });
    return { optimized: false, originalSize, optimizedSize: originalSize };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    return {
      optimized: false,
      originalSize,
      optimizedSize: originalSize,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const files = (await Promise.all(roots.map(listRasterFiles))).flat().sort();
let cursor = 0;
let optimizedFiles = 0;
let unchangedFiles = 0;
let failedFiles = 0;
let originalBytes = 0;
let optimizedBytes = 0;

async function worker() {
  while (cursor < files.length) {
    const filePath = files[cursor++];
    const result = await optimize(filePath);
    originalBytes += result.originalSize;
    optimizedBytes += result.optimizedSize;
    if (result.error) failedFiles += 1;
    else if (result.optimized) optimizedFiles += 1;
    else unchangedFiles += 1;

    const processed = optimizedFiles + unchangedFiles + failedFiles;
    if (processed % 25 === 0 || processed === files.length) {
      console.log(`Optimized ${processed}/${files.length} raster files`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));

const report = {
  generatedAt: new Date().toISOString(),
  profile: { encoder: "ffmpeg", jpegQualityScale: 2, resize: "none" },
  roots: roots.map((root) => path.relative(repoRoot, root)),
  totalFiles: files.length,
  optimizedFiles,
  unchangedFiles,
  failedFiles,
  originalBytes,
  optimizedBytes,
  savedBytes: originalBytes - optimizedBytes,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
