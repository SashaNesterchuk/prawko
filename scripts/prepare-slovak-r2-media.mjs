#!/usr/bin/env node

/**
 * Make a drag-and-drop R2 staging tree for Slovakia without country or source
 * subfolders. The database/import plan is deliberately not modified here.
 *
 * Output:
 *   data/sk-questions-vodicak/slovak-media-prod/question-images/<flat-name>
 *
 * Flat names retain their source folder as a filename prefix (`ds--01.png`),
 * which avoids collisions such as ds/01.png versus dz/01.png.
 */
import { cp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const preparedRoot = path.join(repoRoot, "data", "sk-questions-vodicak");
const sourceRoot = path.join(preparedRoot, "media", "questions");
const planPath = path.join(preparedRoot, "supabase-import", "r2-upload-plan.json");
const outputRoot = path.join(preparedRoot, "slovak-media-prod", "question-images");
const manifestPath = path.join(
  preparedRoot,
  "supabase-import",
  "r2-flat-media-manifest.json"
);
const concurrency = 2;
const jpegExtensions = new Set([".jpg", ".jpeg"]);
const pngExtensions = new Set([".png"]);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with code ${code ?? "unknown"}.`))
    );
  });
}

function sourcePathToFlatName(sourcePath) {
  return sourcePath
    .replace(/^\/questions\//, "")
    .split("/")
    .map((part) => part.replace(/[^A-Za-z0-9._-]/g, "_"))
    .join("--");
}

async function optimizeOne(item) {
  const sourcePath = path.join(preparedRoot, item.local_path);
  const flatName = sourcePathToFlatName(item.source_path);
  const destinationPath = path.join(outputRoot, flatName);
  const extension = path.extname(flatName).toLowerCase();
  const temporaryPath = `${destinationPath}.optimizing${extension}`;
  const originalBytes = (await stat(sourcePath)).size;

  await rm(temporaryPath, { force: true });

  try {
    if (jpegExtensions.has(extension)) {
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

    const candidateBytes = (await stat(temporaryPath)).size;
    if (candidateBytes < originalBytes) {
      await rename(temporaryPath, destinationPath);
      return { flatName, originalBytes, outputBytes: candidateBytes, optimized: true };
    }

    await rm(temporaryPath, { force: true });
    await cp(sourcePath, destinationPath);
    return { flatName, originalBytes, outputBytes: originalBytes, optimized: false };
  } catch (error) {
    await rm(temporaryPath, { force: true });
    await cp(sourcePath, destinationPath);
    return {
      flatName,
      originalBytes,
      outputBytes: originalBytes,
      optimized: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const plan = JSON.parse(await (await import("node:fs/promises")).readFile(planPath, "utf8"));
const names = plan.map((item) => sourcePathToFlatName(item.source_path));
if (new Set(names).size !== names.length) {
  throw new Error("Flat R2 filenames are not unique; refusing to overwrite media.");
}

await mkdir(outputRoot, { recursive: true });
let cursor = 0;
const results = new Array(plan.length);

async function worker() {
  while (cursor < plan.length) {
    const index = cursor++;
    results[index] = await optimizeOne(plan[index]);
    if ((index + 1) % 25 === 0 || index + 1 === plan.length) {
      console.log(`Prepared ${index + 1}/${plan.length}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, plan.length) }, worker));

const originalBytes = results.reduce((sum, result) => sum + result.originalBytes, 0);
const outputBytes = results.reduce((sum, result) => sum + result.outputBytes, 0);
const manifest = {
  generatedAt: new Date().toISOString(),
  bucket: "slovak-media-prod",
  uploadRoot: "slovak-media-prod",
  r2Prefix: "question-images/",
  profile: { jpeg: "ffmpeg q:v=2", png: "ffmpeg lossless compression level 9" },
  totalFiles: results.length,
  optimizedFiles: results.filter((result) => result.optimized).length,
  failedOptimizations: results.filter((result) => result.error).length,
  originalBytes,
  outputBytes,
  savedBytes: originalBytes - outputBytes,
  files: plan.map((item, index) => ({
    sourcePath: item.source_path,
    sourceLocalPath: item.local_path,
    uploadKey: `question-images/${results[index].flatName}`,
    storageBucket: "question-images",
    storagePath: results[index].flatName,
    ...results[index],
  })),
};

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  outputRoot,
  manifestPath,
  totalFiles: manifest.totalFiles,
  optimizedFiles: manifest.optimizedFiles,
  failedOptimizations: manifest.failedOptimizations,
  originalBytes,
  outputBytes,
  savedBytes: manifest.savedBytes,
}, null, 2));
