#!/usr/bin/env node

import { spawn } from "node:child_process";
import { cp, mkdir, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const sourceRoot = path.resolve(
  process.argv[2] ?? path.join(repoRoot, "..", "czech-etesty-questions-2026-08-19", "media")
);
const outputRoot = path.resolve(
  process.argv[3] ?? path.join(path.dirname(sourceRoot), "media-opt")
);
const concurrency = 2;
const videoExtensions = new Set([".mp4"]);
const jpegExtensions = new Set([".jpg", ".jpeg"]);
const pngExtensions = new Set([".png"]);

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
  const children = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return listFiles(entryPath);
      return entry.isFile() ? [entryPath] : [];
    })
  );
  return children.flat();
}

async function optimizeOne(sourcePath) {
  const relativePath = path.relative(sourceRoot, sourcePath);
  const destinationPath = path.join(outputRoot, relativePath);
  const extension = path.extname(sourcePath).toLowerCase();
  const temporaryPath = `${destinationPath}.optimizing${extension}`;
  const originalSize = (await stat(sourcePath)).size;

  await mkdir(path.dirname(destinationPath), { recursive: true });
  await rm(temporaryPath, { force: true });

  try {
    if (videoExtensions.has(extension)) {
      await run("ffmpeg", [
        "-y", "-v", "error", "-i", sourcePath,
        "-map", "0", "-map_metadata", "0",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", temporaryPath,
      ]);
    } else if (jpegExtensions.has(extension)) {
      await run("ffmpeg", [
        "-y", "-v", "error", "-i", sourcePath, "-map_metadata", "0",
        "-q:v", "2", "-threads", "1", temporaryPath,
      ]);
    } else if (pngExtensions.has(extension)) {
      await run("ffmpeg", [
        "-y", "-v", "error", "-i", sourcePath, "-map_metadata", "0",
        "-compression_level", "9", "-pred", "mixed", temporaryPath,
      ]);
    } else {
      await cp(sourcePath, temporaryPath);
    }

    const optimizedSize = (await stat(temporaryPath)).size;
    if (optimizedSize < originalSize) {
      await rename(temporaryPath, destinationPath);
      return { originalSize, optimizedSize, optimized: true, copied: false };
    }

    await rm(temporaryPath, { force: true });
    await cp(sourcePath, destinationPath);
    return { originalSize, optimizedSize: originalSize, optimized: false, copied: true };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    await cp(sourcePath, destinationPath);
    return {
      originalSize,
      optimizedSize: originalSize,
      optimized: false,
      copied: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const files = (await listFiles(sourceRoot)).sort();
await mkdir(outputRoot, { recursive: true });
let cursor = 0;
let originalBytes = 0;
let optimizedBytes = 0;
let optimizedFiles = 0;
let copiedFiles = 0;
let failedFiles = 0;

async function worker() {
  while (cursor < files.length) {
    const sourcePath = files[cursor++];
    const result = await optimizeOne(sourcePath);
    originalBytes += result.originalSize;
    optimizedBytes += result.optimizedSize;
    if (result.optimized) optimizedFiles += 1;
    if (result.copied) copiedFiles += 1;
    if (result.error) failedFiles += 1;
    const processed = optimizedFiles + copiedFiles;
    if (processed % 20 === 0 || processed === files.length) {
      console.log(`Processed ${processed}/${files.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
const report = {
  generatedAt: new Date().toISOString(),
  sourceRoot,
  outputRoot,
  profile: { video: "H.264 CRF 23 / AAC 128k", jpeg: "ffmpeg q:v=2", png: "lossless compression level 9" },
  totalFiles: files.length,
  optimizedFiles,
  copiedFiles,
  failedFiles,
  originalBytes,
  optimizedBytes,
  savedBytes: originalBytes - optimizedBytes,
};
await writeFile(path.join(outputRoot, "optimization-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
