import fs from "node:fs/promises";
import path from "node:path";

import AdmZip from "adm-zip";

import { MEDIA_STORAGE_BUCKETS, type MediaSourceKind, type SourceMediaCollection } from "@prawko/config";
import type {
  MediaBuildJob,
  MediaBuildJobReference,
  MediaManifestEntry,
  NormalizedQuestion,
  QuestionMediaReference,
} from "@prawko/schemas";

import {
  DEFAULT_MEDIA_ALIASES,
  DELIVERY_ASSETS_DIR,
  RAW_MEDIA_ALIASES_PATH,
  RAW_MEDIA_DIR,
} from "./constants";
import {
  listFilesRecursive,
  normalizeFilenameForLookup,
  pathExists,
  readJsonFileIfExists,
  relativeToRepo,
  resolveRepoPath,
  shortHash,
  slugifySegment,
} from "./utils";

function inferMediaType(filename: string): "image" | "video" | null {
  const extension = path.extname(filename).toLowerCase();

  if ([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"].includes(extension)) {
    return "image";
  }

  if (
    [".wmv", ".mp4", ".mov", ".avi", ".mpeg", ".mpg", ".webm", ".m4v"].includes(
      extension
    )
  ) {
    return "video";
  }

  return null;
}

function classifySourceCollection(sourcePath: string): SourceMediaCollection {
  const normalizedPath = sourcePath
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

  if (normalizedPath.includes("tlumaczenia_migowe")) {
    return "pjm";
  }

  if (
    normalizedPath.includes("multimedia_do_pytan") ||
    normalizedPath.includes("multimedia do pytan")
  ) {
    return "primary";
  }

  return "unknown";
}

function buildInventoryId(sourcePath: string, archiveEntryName: string | null): string {
  return `inventory_${shortHash(`${sourcePath}:${archiveEntryName ?? ""}`, 12)}`;
}

function buildReferenceId(
  questionSourceId: string,
  sourceKind: MediaSourceKind,
  answerSlot: "A" | "B" | "C" | null
): string {
  return `${questionSourceId}:${sourceKind}:${answerSlot ?? "-"}`;
}

function buildMediaKey(sourceKind: MediaSourceKind, entry: MediaManifestEntry): string {
  const stem = slugifySegment(path.parse(entry.filename).name).slice(0, 48);
  const scopeHash = shortHash(
    `${sourceKind}:${entry.sourcePath}:${entry.archiveEntryName ?? ""}`,
    8
  );

  return `${sourceKind}-${stem}-${scopeHash}`;
}

function normalizeMediaFilename(filename: string): string {
  return normalizeFilenameForLookup(filename);
}

function inferContentType(filename: string, mediaType: "image" | "video"): string {
  if (mediaType === "video") {
    return "video/mp4";
  }

  const extension = path.extname(filename).toLowerCase();

  switch (extension) {
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    default:
      return "image/jpeg";
  }
}

function normalizeImageExtension(filename: string): string {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".jpeg") {
    return ".jpg";
  }

  if ([".jpg", ".png", ".gif", ".bmp", ".webp"].includes(extension)) {
    return extension;
  }

  return ".jpg";
}

function getCollectionPriority(
  sourceKind: MediaSourceKind,
  sourceCollection: SourceMediaCollection
): number {
  if (sourceKind === "primary") {
    if (sourceCollection === "primary") {
      return 3;
    }

    if (sourceCollection === "unknown") {
      return 2;
    }

    return 1;
  }

  if (sourceCollection === "pjm") {
    return 3;
  }

  if (sourceCollection === "unknown") {
    return 2;
  }

  return 1;
}

function sortCandidates(
  candidates: MediaManifestEntry[],
  sourceKind: MediaSourceKind,
  originalFilename: string
): MediaManifestEntry[] {
  const exactLower = path.basename(originalFilename).trim().toLowerCase();

  return [...candidates].sort((left, right) => {
    const leftPriority = getCollectionPriority(sourceKind, left.sourceCollection);
    const rightPriority = getCollectionPriority(sourceKind, right.sourceCollection);

    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    const leftExact = left.filename.trim().toLowerCase() === exactLower ? 1 : 0;
    const rightExact = right.filename.trim().toLowerCase() === exactLower ? 1 : 0;

    if (leftExact !== rightExact) {
      return rightExact - leftExact;
    }

    return `${left.sourcePath}:${left.archiveEntryName ?? ""}`.localeCompare(
      `${right.sourcePath}:${right.archiveEntryName ?? ""}`
    );
  });
}

function createReferenceDescriptors(question: NormalizedQuestion): Array<{
  sourceKind: MediaSourceKind;
  answerSlot: "A" | "B" | "C" | null;
  filename: string;
}> {
  const descriptors: Array<{
    sourceKind: MediaSourceKind;
    answerSlot: "A" | "B" | "C" | null;
    filename: string;
  }> = [];

  if (question.mediaFilename) {
    descriptors.push({
      sourceKind: "primary",
      answerSlot: null,
      filename: question.mediaFilename,
    });
  }

  if (question.pjmQuestionMediaFilename) {
    descriptors.push({
      sourceKind: "pjm_question",
      answerSlot: null,
      filename: question.pjmQuestionMediaFilename,
    });
  }

  if (question.pjmAnswerAMediaFilename) {
    descriptors.push({
      sourceKind: "pjm_answer",
      answerSlot: "A",
      filename: question.pjmAnswerAMediaFilename,
    });
  }

  if (question.pjmAnswerBMediaFilename) {
    descriptors.push({
      sourceKind: "pjm_answer",
      answerSlot: "B",
      filename: question.pjmAnswerBMediaFilename,
    });
  }

  if (question.pjmAnswerCMediaFilename) {
    descriptors.push({
      sourceKind: "pjm_answer",
      answerSlot: "C",
      filename: question.pjmAnswerCMediaFilename,
    });
  }

  return descriptors;
}

function buildJobReference(reference: QuestionMediaReference): MediaBuildJobReference {
  return {
    questionSourceId: reference.questionSourceId,
    sourceKind: reference.sourceKind,
    answerSlot: reference.answerSlot,
  };
}

function resolveBuildPaths(
  mediaKey: string,
  sourceKind: MediaSourceKind,
  mediaType: "image" | "video",
  sourceFilename: string,
  deliveryDir: string
): Omit<
  MediaBuildJob,
  | "mediaKey"
  | "inventoryId"
  | "sourceKind"
  | "mediaType"
  | "sourceCollection"
  | "sourceFilename"
  | "sourcePath"
  | "sourceType"
  | "containerName"
  | "archiveEntryName"
  | "referencedBy"
> {
  const resolvedDeliveryDir = resolveRepoPath(deliveryDir);

  if (mediaType === "image") {
    const extension = normalizeImageExtension(sourceFilename);
    const outputFilename = `${mediaKey}${extension}`;
    const storageBucket =
      sourceKind === "primary"
        ? MEDIA_STORAGE_BUCKETS.images
        : MEDIA_STORAGE_BUCKETS.pjm;
    const storageScope =
      sourceKind === "primary"
        ? "primary"
        : sourceKind === "pjm_question"
          ? "question"
          : "answer";
    const storagePath = `${storageScope}/${outputFilename}`;
    const outputPath = relativeToRepo(
      path.join(resolvedDeliveryDir, storageBucket, storagePath)
    );

    return {
      outputFilename,
      outputPath,
      posterFilename: null,
      posterPath: null,
      storageBucket,
      storagePath,
      posterStorageBucket: null,
      posterStoragePath: null,
      contentType: inferContentType(sourceFilename, mediaType),
      posterContentType: null,
    };
  }

  const outputFilename = `${mediaKey}.mp4`;
  const posterFilename = `${mediaKey}.jpg`;
  const storageBucket =
    sourceKind === "primary"
      ? MEDIA_STORAGE_BUCKETS.videos
      : MEDIA_STORAGE_BUCKETS.pjm;
  const storageScope =
    sourceKind === "primary"
      ? "primary"
      : sourceKind === "pjm_question"
        ? "question"
        : "answer";
  const posterScope =
    sourceKind === "primary"
      ? "primary"
      : sourceKind === "pjm_question"
        ? "pjm-question"
        : "pjm-answer";
  const storagePath = `${storageScope}/${outputFilename}`;
  const posterStoragePath = `${posterScope}/${posterFilename}`;
  const outputPath = relativeToRepo(
    path.join(resolvedDeliveryDir, storageBucket, storagePath)
  );
  const posterPath = relativeToRepo(
    path.join(
      resolvedDeliveryDir,
      MEDIA_STORAGE_BUCKETS.posters,
      posterStoragePath
    )
  );

  return {
    outputFilename,
    outputPath,
    posterFilename,
    posterPath,
    storageBucket,
    storagePath,
    posterStorageBucket: MEDIA_STORAGE_BUCKETS.posters,
    posterStoragePath,
    contentType: inferContentType(sourceFilename, mediaType),
    posterContentType: "image/jpeg",
  };
}

export async function scanMediaSources(
  mediaDir = RAW_MEDIA_DIR
): Promise<MediaManifestEntry[]> {
  const resolvedMediaDir = resolveRepoPath(mediaDir);

  if (!(await pathExists(resolvedMediaDir))) {
    return [];
  }

  const discoveredFiles = await listFilesRecursive(resolvedMediaDir);
  const manifest: MediaManifestEntry[] = [];

  for (const filePath of discoveredFiles) {
    const extension = path.extname(filePath).toLowerCase();

    if (extension === ".zip") {
      const archive = new AdmZip(filePath);

      for (const entry of archive.getEntries()) {
        if (entry.isDirectory) {
          continue;
        }

        const mediaType = inferMediaType(entry.entryName);
        if (!mediaType) {
          continue;
        }

        const filename = path.basename(entry.entryName);
        const sourcePath = relativeToRepo(filePath);
        manifest.push({
          inventoryId: buildInventoryId(sourcePath, entry.entryName),
          filename,
          normalizedFilename: normalizeMediaFilename(filename),
          extension: path.extname(filename).toLowerCase(),
          mediaType,
          sourcePath,
          sourceType: "zip_entry",
          containerName: path.basename(filePath),
          archiveEntryName: entry.entryName,
          sizeBytes: Number(
            (entry as { header?: { size?: number } }).header?.size ?? 0
          ),
          sourceCollection: classifySourceCollection(filePath),
        });
      }

      continue;
    }

    const mediaType = inferMediaType(filePath);
    if (!mediaType) {
      continue;
    }

    const stat = await fs.stat(filePath);
    const filename = path.basename(filePath);
    const sourcePath = relativeToRepo(filePath);

    manifest.push({
      inventoryId: buildInventoryId(sourcePath, null),
      filename,
      normalizedFilename: normalizeMediaFilename(filename),
      extension: path.extname(filename).toLowerCase(),
      mediaType,
      sourcePath,
      sourceType: "file",
      containerName: null,
      archiveEntryName: null,
      sizeBytes: stat.size,
      sourceCollection: classifySourceCollection(filePath),
    });
  }

  return manifest.sort((left, right) =>
    `${left.normalizedFilename}:${left.sourcePath}`.localeCompare(
      `${right.normalizedFilename}:${right.sourcePath}`
    )
  );
}

export async function loadMediaAliases(
  aliasesPath = RAW_MEDIA_ALIASES_PATH
): Promise<Record<string, string>> {
  const resolvedAliasesPath = resolveRepoPath(aliasesPath);
  const fileAliases =
    (await readJsonFileIfExists<Record<string, string>>(resolvedAliasesPath)) ??
    {};
  const mergedAliases = {
    ...DEFAULT_MEDIA_ALIASES,
    ...fileAliases,
  };

  return Object.entries(mergedAliases).reduce<Record<string, string>>(
    (result, [from, to]) => {
      const fromKey = normalizeMediaFilename(from);
      const toKey = normalizeMediaFilename(to);

      if (fromKey && toKey) {
        result[fromKey] = toKey;
      }

      return result;
    },
    {}
  );
}

export function buildQuestionMediaReferences(
  questions: NormalizedQuestion[],
  mediaManifest: MediaManifestEntry[],
  aliases: Record<string, string>
): QuestionMediaReference[] {
  const mediaEntriesByFilename = new Map<string, MediaManifestEntry[]>();

  for (const entry of mediaManifest) {
    const existingEntries = mediaEntriesByFilename.get(entry.normalizedFilename) ?? [];
    existingEntries.push(entry);
    mediaEntriesByFilename.set(entry.normalizedFilename, existingEntries);
  }

  const references: QuestionMediaReference[] = [];

  for (const question of questions) {
    for (const descriptor of createReferenceDescriptors(question)) {
      const normalizedFilename = normalizeMediaFilename(descriptor.filename);
      const aliasTarget = aliases[normalizedFilename];
      const lookupKey = aliasTarget ?? normalizedFilename;
      const candidates = mediaEntriesByFilename.get(lookupKey) ?? [];
      const sortedCandidates = sortCandidates(
        candidates,
        descriptor.sourceKind,
        descriptor.filename
      );
      const selectedCandidate = sortedCandidates[0] ?? null;
      const matchStrategy = selectedCandidate
        ? aliasTarget
          ? "alias"
          : selectedCandidate.filename.trim().toLowerCase() ===
              path.basename(descriptor.filename).trim().toLowerCase()
            ? "exact"
            : "normalized"
        : "missing";

      references.push({
        referenceId: buildReferenceId(
          question.questionSourceId,
          descriptor.sourceKind,
          descriptor.answerSlot
        ),
        questionSourceId: question.questionSourceId,
        sourceRowNumber: question.sourceRowNumber,
        sourceKind: descriptor.sourceKind,
        answerSlot: descriptor.answerSlot,
        originalFilename: descriptor.filename,
        normalizedFilename,
        mediaType: selectedCandidate?.mediaType ?? inferMediaType(descriptor.filename),
        matchStrategy,
        mediaKey: selectedCandidate
          ? buildMediaKey(descriptor.sourceKind, selectedCandidate)
          : null,
        inventoryId: selectedCandidate?.inventoryId ?? null,
        resolvedFilename: selectedCandidate?.filename ?? null,
        sourcePath: selectedCandidate?.sourcePath ?? null,
        sourceCollection: selectedCandidate?.sourceCollection ?? null,
        candidateCount: sortedCandidates.length,
      });
    }
  }

  return references.sort((left, right) =>
    left.referenceId.localeCompare(right.referenceId)
  );
}

export function buildMediaBuildPlan(
  references: QuestionMediaReference[],
  mediaManifest: MediaManifestEntry[],
  deliveryDir = DELIVERY_ASSETS_DIR
): MediaBuildJob[] {
  const mediaEntriesById = new Map(
    mediaManifest.map((entry) => [entry.inventoryId, entry])
  );
  const jobsByKey = new Map<string, MediaBuildJob>();

  for (const reference of references) {
    if (!reference.mediaKey || !reference.inventoryId || !reference.mediaType) {
      continue;
    }

    const sourceEntry = mediaEntriesById.get(reference.inventoryId);
    if (!sourceEntry) {
      continue;
    }

    const existingJob = jobsByKey.get(reference.mediaKey);

    if (existingJob) {
      const refDescriptor = buildJobReference(reference);
      if (
        !existingJob.referencedBy.some(
          (entry) =>
            entry.questionSourceId === refDescriptor.questionSourceId &&
            entry.sourceKind === refDescriptor.sourceKind &&
            entry.answerSlot === refDescriptor.answerSlot
        )
      ) {
        existingJob.referencedBy.push(refDescriptor);
      }
      continue;
    }

    const buildPaths = resolveBuildPaths(
      reference.mediaKey,
      reference.sourceKind,
      reference.mediaType,
      sourceEntry.filename,
      deliveryDir
    );

    jobsByKey.set(reference.mediaKey, {
      mediaKey: reference.mediaKey,
      inventoryId: sourceEntry.inventoryId,
      sourceKind: reference.sourceKind,
      mediaType: reference.mediaType,
      sourceCollection: sourceEntry.sourceCollection,
      sourceFilename: sourceEntry.filename,
      sourcePath: sourceEntry.sourcePath,
      sourceType: sourceEntry.sourceType,
      containerName: sourceEntry.containerName,
      archiveEntryName: sourceEntry.archiveEntryName,
      ...buildPaths,
      referencedBy: [buildJobReference(reference)],
    });
  }

  return Array.from(jobsByKey.values()).sort((left, right) =>
    left.mediaKey.localeCompare(right.mediaKey)
  );
}
