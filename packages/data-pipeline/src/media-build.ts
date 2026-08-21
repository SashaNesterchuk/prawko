import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import AdmZip from "adm-zip";
import { createClient } from "@supabase/supabase-js";
import type { MediaBuildJob } from "@prawko/schemas";

import { DELIVERY_GENERATED_DIR } from "./constants";
import { loadLocalEnvFiles } from "./env";
import type { MediaBuildResult, MediaUploadResult, PipelineOptions } from "./types";
import {
  ensureDir,
  pathExists,
  relativeToRepo,
  resolveRepoPath,
  writeJsonFile,
} from "./utils";

interface MaterializedSource {
  inputPath: string;
  cleanup: () => Promise<void>;
}

interface UploadTarget {
  bucket: MediaBuildJob["storageBucket"];
  storagePath: string;
  contentType: string;
  localPath: string;
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "ignore",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function materializeSource(job: MediaBuildJob): Promise<MaterializedSource> {
  const sourceArchivePath = resolveRepoPath(job.sourcePath);

  if (job.sourceType === "file") {
    return {
      inputPath: sourceArchivePath,
      cleanup: async () => {},
    };
  }

  if (!job.archiveEntryName) {
    throw new Error(
      `Build job ${job.mediaKey} points to a zip source without archiveEntryName.`
    );
  }

  const archive = new AdmZip(sourceArchivePath);
  const entry = archive.getEntry(job.archiveEntryName);

  if (!entry) {
    throw new Error(
      `Archive entry "${job.archiveEntryName}" was not found for ${job.mediaKey}.`
    );
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "prawko-media-"));
  const tempPath = path.join(tempDir, path.basename(job.archiveEntryName));
  await fs.writeFile(tempPath, entry.getData());

  return {
    inputPath: tempPath,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
}

async function buildImage(job: MediaBuildJob, inputPath: string): Promise<void> {
  const outputPath = resolveRepoPath(job.outputPath);
  await ensureDir(path.dirname(outputPath));

  // Delivery JPEGs are shown on-device and uploaded to remote storage. Recode
  // them at a high visual quality instead of copying multi-megabyte originals.
  // Other formats keep their original representation and content type.
  if (
    [".jpg", ".jpeg"].includes(path.extname(outputPath).toLowerCase()) &&
    !(await hasAvifSignature(inputPath))
  ) {
    await runCommand("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-i",
      inputPath,
      "-map_metadata",
      "0",
      "-q:v",
      "2",
      "-threads",
      "1",
      outputPath,
    ]);
    return;
  }

  await fs.copyFile(inputPath, outputPath);
}

async function hasAvifSignature(filePath: string): Promise<boolean> {
  const file = await fs.open(filePath, "r");
  const header = Buffer.alloc(64);

  try {
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    const text = header.subarray(0, bytesRead).toString("ascii");
    return text.includes("ftypavif") || text.includes("ftypavis");
  } finally {
    await file.close();
  }
}

async function buildVideo(job: MediaBuildJob, inputPath: string): Promise<void> {
  const outputPath = resolveRepoPath(job.outputPath);
  const posterPath = job.posterPath ? resolveRepoPath(job.posterPath) : null;

  await ensureDir(path.dirname(outputPath));
  if (posterPath) {
    await ensureDir(path.dirname(posterPath));
  }

  await runCommand("ffmpeg", [
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-movflags",
    "+faststart",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    outputPath,
  ]);

  if (posterPath) {
    await runCommand("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-frames:v",
      "1",
      posterPath,
    ]);
  }
}

function collectUploadTargets(job: MediaBuildJob): UploadTarget[] {
  const targets: UploadTarget[] = [
    {
      bucket: job.storageBucket,
      storagePath: job.storagePath,
      contentType: job.contentType,
      localPath: job.outputPath,
    },
  ];

  if (
    job.posterStorageBucket &&
    job.posterStoragePath &&
    job.posterContentType &&
    job.posterPath
  ) {
    targets.push({
      bucket: job.posterStorageBucket,
      storagePath: job.posterStoragePath,
      contentType: job.posterContentType,
      localPath: job.posterPath,
    });
  }

  return targets;
}

export async function executeMediaBuild(
  buildJobs: MediaBuildJob[],
  options: PipelineOptions = {}
): Promise<MediaBuildResult> {
  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? options.limit
      : buildJobs.length;
  const selectedJobs = buildJobs.slice(0, limit);

  let createdAssets = 0;
  let createdPosters = 0;
  let skippedJobs = 0;
  let failedJobs = 0;

  const deliveryManifest: Array<{
    mediaKey: string;
    sourceKind: MediaBuildJob["sourceKind"];
    mediaType: MediaBuildJob["mediaType"];
    storageBucket: MediaBuildJob["storageBucket"];
    storagePath: string;
    posterStorageBucket: MediaBuildJob["posterStorageBucket"];
    posterStoragePath: string | null;
    outputPath: string;
    posterPath: string | null;
    outputSizeBytes: number;
    posterSizeBytes: number | null;
  }> = [];

  for (const job of selectedJobs) {
    const outputPath = resolveRepoPath(job.outputPath);
    const posterPath = job.posterPath ? resolveRepoPath(job.posterPath) : null;
    const outputAlreadyExists =
      options.skipExisting &&
      (await pathExists(outputPath)) &&
      (!posterPath || (await pathExists(posterPath)));

    if (outputAlreadyExists) {
      skippedJobs += 1;
      const outputStat = await fs.stat(outputPath);
      const posterStat =
        posterPath && (await pathExists(posterPath))
          ? await fs.stat(posterPath)
          : null;

      deliveryManifest.push({
        mediaKey: job.mediaKey,
        sourceKind: job.sourceKind,
        mediaType: job.mediaType,
        storageBucket: job.storageBucket,
        storagePath: job.storagePath,
        posterStorageBucket: job.posterStorageBucket,
        posterStoragePath: job.posterStoragePath,
        outputPath: job.outputPath,
        posterPath: job.posterPath,
        outputSizeBytes: outputStat.size,
        posterSizeBytes: posterStat?.size ?? null,
      });
      continue;
    }

    if (options.dryRun) {
      continue;
    }

    const materializedSource = await materializeSource(job);

    try {
      if (job.mediaType === "image") {
        await buildImage(job, materializedSource.inputPath);
        createdAssets += 1;
      } else {
        await buildVideo(job, materializedSource.inputPath);
        createdAssets += 1;
        if (job.posterPath) {
          createdPosters += 1;
        }
      }

      const outputStat = await fs.stat(outputPath);
      const posterStat =
        posterPath && (await pathExists(posterPath))
          ? await fs.stat(posterPath)
          : null;

      deliveryManifest.push({
        mediaKey: job.mediaKey,
        sourceKind: job.sourceKind,
        mediaType: job.mediaType,
        storageBucket: job.storageBucket,
        storagePath: job.storagePath,
        posterStorageBucket: job.posterStorageBucket,
        posterStoragePath: job.posterStoragePath,
        outputPath: job.outputPath,
        posterPath: job.posterPath,
        outputSizeBytes: outputStat.size,
        posterSizeBytes: posterStat?.size ?? null,
      });
    } catch {
      failedJobs += 1;
    } finally {
      await materializedSource.cleanup();
    }
  }

  const outputManifestPath = path.join(
    DELIVERY_GENERATED_DIR,
    "delivery-manifest.json"
  );
  const buildReportPath = path.join(DELIVERY_GENERATED_DIR, "build-report.json");

  await writeJsonFile(outputManifestPath, deliveryManifest);
  await writeJsonFile(buildReportPath, {
    processedJobs: selectedJobs.length,
    createdAssets,
    createdPosters,
    skippedJobs,
    failedJobs,
    dryRun: Boolean(options.dryRun),
  });

  return {
    processedJobs: selectedJobs.length,
    createdAssets,
    createdPosters,
    skippedJobs,
    failedJobs,
    outputManifestPath: relativeToRepo(outputManifestPath),
    buildReportPath: relativeToRepo(buildReportPath),
  };
}

export async function uploadBuiltMedia(
  buildJobs: MediaBuildJob[],
  options: PipelineOptions = {}
): Promise<MediaUploadResult> {
  await loadLocalEnvFiles();

  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? options.limit
      : buildJobs.length;
  const selectedJobs = buildJobs.slice(0, limit);

  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.EXPO_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase credentials. Expected SUPABASE_SERVICE_ROLE_KEY and a Supabase URL in env files."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  let uploadedObjects = 0;
  let failedObjects = 0;
  const uploadLog: Array<{
    bucket: string;
    storagePath: string;
    localPath: string;
    uploaded: boolean;
    error: string | null;
  }> = [];

  for (const job of selectedJobs) {
    const uploadTargets = collectUploadTargets(job);

    for (const target of uploadTargets) {
      const localPath = resolveRepoPath(target.localPath);
      if (!(await pathExists(localPath))) {
        failedObjects += 1;
        uploadLog.push({
          bucket: target.bucket,
          storagePath: target.storagePath,
          localPath: target.localPath,
          uploaded: false,
          error: "local_file_missing",
        });
        continue;
      }

      if (options.dryRun) {
        uploadLog.push({
          bucket: target.bucket,
          storagePath: target.storagePath,
          localPath: target.localPath,
          uploaded: false,
          error: null,
        });
        continue;
      }

      const fileBuffer = await fs.readFile(localPath);
      const { error } = await supabase.storage
        .from(target.bucket)
        .upload(target.storagePath, fileBuffer, {
          upsert: true,
          contentType: target.contentType,
        });

      if (error) {
        failedObjects += 1;
        uploadLog.push({
          bucket: target.bucket,
          storagePath: target.storagePath,
          localPath: target.localPath,
          uploaded: false,
          error: error.message,
        });
        continue;
      }

      uploadedObjects += 1;
      uploadLog.push({
        bucket: target.bucket,
        storagePath: target.storagePath,
        localPath: target.localPath,
        uploaded: true,
        error: null,
      });
    }
  }

  const uploadReportPath = path.join(DELIVERY_GENERATED_DIR, "upload-report.json");
  await writeJsonFile(uploadReportPath, {
    uploadedObjects,
    failedObjects,
    dryRun: Boolean(options.dryRun),
    objects: uploadLog,
  });

  return {
    uploadedObjects,
    failedObjects,
    uploadReportPath: relativeToRepo(uploadReportPath),
  };
}
