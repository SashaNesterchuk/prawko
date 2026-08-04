import type { DrivingCategory } from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

import { mobileEnv } from "../../config/env";
import { getE2EOfflinePackOverride } from "../../testing/e2e/state";
import { getQuestionBank } from "../questions/question-bank";
import type { LocalQuestion } from "../questions/types";
import generatedAssetSizeMap from "./generated-asset-size-map.json";
import { checkInternetReachability } from "./reachability";

const OFFLINE_PACK_VERSION = 1;
const OFFLINE_ROOT_DIR_NAME = "prawko-offline";
const OFFLINE_ASSETS_DIR_NAME = "assets";
const OFFLINE_CATALOG_FILENAME = "catalog.json";
const OFFLINE_METADATA_FILENAME = "metadata.json";
const SAFETY_FREE_SPACE_BYTES = 150 * 1024 * 1024;
const UNKNOWN_ASSET_RESERVE_BYTES = 2 * 1024 * 1024;

const offlineAssetSizeMap = generatedAssetSizeMap as Record<string, number>;
const offlineAssetUriCache = new Map<string, string | null>();

export type OfflineTransferStatus = "downloading" | "error";

export type OfflinePackReadyInfo = {
  assetCount: number;
  catalogSignature: string;
  category: DrivingCategory;
  completedAt: string;
  questionCount: number;
  totalBytes: number;
};

export type OfflinePackTransfer = {
  catalogSignature: string;
  downloadedAssetCount: number;
  downloadedBytes: number;
  lastError: string | null;
  startedAt: string;
  status: OfflineTransferStatus;
  targetAssetCount: number;
  targetCategory: DrivingCategory;
  targetQuestionCount: number;
  targetTotalBytes: number;
  unknownSizeAssetCount: number;
  updatedAt: string;
};

type OfflinePackMetadata = {
  readyPack: OfflinePackReadyInfo | null;
  transfer: OfflinePackTransfer | null;
  version: number;
};

export type OfflinePackPlan = {
  assetCount: number;
  catalogSignature: string;
  category: DrivingCategory;
  questionCount: number;
  totalBytes: number;
  unknownSizeAssetCount: number;
};

export type OfflinePackSnapshot = {
  availableDiskSpace: number | null;
  hasStoredData: boolean;
  plan: OfflinePackPlan | null;
  readyPack: OfflinePackReadyInfo | null;
  readyPackMatchesCurrentCatalog: boolean | null;
  readyPackMatchesCurrentCategory: boolean;
  transfer: OfflinePackTransfer | null;
};

type ValidatedReadyOfflinePackState = {
  metadata: OfflinePackMetadata;
  readyPack: OfflinePackReadyInfo | null;
  readyQuestions: LocalQuestion[] | null;
};

type OfflineAssetEntry = {
  bucket: string;
  expectedBytes: number | null;
  file: File;
  key: string;
  storagePath: string;
  url: string;
};

type OfflineAssetIntegrityEntry = Pick<OfflineAssetEntry, "expectedBytes" | "file">;

type DownloadOfflinePackInput = {
  category: DrivingCategory;
  questionBank: LocalQuestion[];
  onProgress?: (transfer: OfflinePackTransfer) => void;
};

type RelatedOfflineContext = {
  currentCategory: DrivingCategory;
  questionBank?: LocalQuestion[] | null;
};

export type OfflinePackBlockedReason =
  | "download_incomplete"
  | "missing_ready_pack"
  | "pack_for_other_category";

export class OfflinePackError extends Error {
  availableBytes?: number;
  code:
    | "catalog_unavailable"
    | "connectivity_required"
    | "platform_unsupported"
    | "storage_low"
    | "storage_url_missing";
  requiredBytes?: number;

  constructor(
    code: OfflinePackError["code"],
    message: string,
    options: {
      availableBytes?: number;
      requiredBytes?: number;
    } = {}
  ) {
    super(message);
    this.code = code;
    this.availableBytes = options.availableBytes;
    this.requiredBytes = options.requiredBytes;
  }
}

export async function readOfflinePackSnapshot(
  input: RelatedOfflineContext
): Promise<OfflinePackSnapshot> {
  const e2eSnapshot = readE2EOfflinePackSnapshot(input);

  if (e2eSnapshot) {
    return e2eSnapshot;
  }

  if (Platform.OS === "web") {
    return {
      availableDiskSpace: null,
      hasStoredData: false,
      plan: null,
      readyPack: null,
      readyPackMatchesCurrentCatalog: null,
      readyPackMatchesCurrentCategory: false,
      transfer: null,
    };
  }

  const { metadata, readyPack } = await readValidatedReadyOfflinePackState();
  const plan =
    input.questionBank && input.questionBank.length > 0
      ? buildOfflinePackPlan(input.questionBank, input.currentCategory)
      : null;
  const readyPackMatchesCurrentCategory =
    readyPack?.category === input.currentCategory;
  const readyPackMatchesCurrentCatalog =
    readyPackMatchesCurrentCategory && readyPack && plan
      ? readyPack.catalogSignature === plan.catalogSignature
      : null;

  return {
    availableDiskSpace: readAvailableDiskSpace(),
    hasStoredData: hasOfflinePackData(metadata),
    plan,
    readyPack,
    readyPackMatchesCurrentCatalog,
    readyPackMatchesCurrentCategory,
    transfer: metadata.transfer,
  };
}

export async function hasReadyOfflinePackForCategory(
  category: DrivingCategory
) {
  const e2eOverride = getE2EOfflinePackOverride();

  if (e2eOverride) {
    return (
      e2eOverride.status === "ready" && e2eOverride.category === category
    );
  }

  if (Platform.OS === "web") {
    return false;
  }

  const { readyPack } = await readValidatedReadyOfflinePackState();

  return readyPack?.category === category;
}

export async function getOfflinePackBlockedReason(
  category: DrivingCategory
): Promise<{
  downloadedCategory: DrivingCategory | null;
  reason: OfflinePackBlockedReason;
}> {
  const e2eOverride = getE2EOfflinePackOverride();

  if (e2eOverride) {
    if (e2eOverride.status === "ready" && e2eOverride.category) {
      return e2eOverride.category === category
        ? {
            downloadedCategory: e2eOverride.category,
            reason: "missing_ready_pack",
          }
        : {
            downloadedCategory: e2eOverride.category,
            reason: "pack_for_other_category",
          };
    }

    if (
      e2eOverride.status === "incomplete" &&
      e2eOverride.category === category
    ) {
      return {
        downloadedCategory: null,
        reason: "download_incomplete",
      };
    }

    if (e2eOverride.status === "incomplete" && e2eOverride.category) {
      return {
        downloadedCategory: e2eOverride.category,
        reason: "pack_for_other_category",
      };
    }

    return {
      downloadedCategory: null,
      reason: "missing_ready_pack",
    };
  }

  if (Platform.OS === "web") {
    return {
      downloadedCategory: null,
      reason: "missing_ready_pack",
    };
  }

  const { metadata, readyPack } = await readValidatedReadyOfflinePackState();

  if (readyPack?.category) {
    return readyPack.category === category
      ? {
          downloadedCategory: readyPack.category,
          reason: "missing_ready_pack",
        }
      : {
          downloadedCategory: readyPack.category,
          reason: "pack_for_other_category",
        };
  }

  if (metadata.transfer?.targetCategory === category) {
    return {
      downloadedCategory: null,
      reason: "download_incomplete",
    };
  }

  return {
    downloadedCategory: null,
    reason: "missing_ready_pack",
  };
}

export async function loadReadyOfflineQuestionCatalog(
  category: DrivingCategory
): Promise<LocalQuestion[] | null> {
  const e2eOverride = getE2EOfflinePackOverride();

  if (e2eOverride) {
    return e2eOverride.status === "ready" && e2eOverride.category === category
      ? [...getQuestionBank()]
      : null;
  }

  if (Platform.OS === "web") {
    return null;
  }

  const { readyPack, readyQuestions } = await readValidatedReadyOfflinePackState();

  if (readyPack?.category !== category) {
    return null;
  }

  return readyQuestions;
}

export function getOfflineQuestionAssetUrl(
  asset: QuestionDeliveryAsset | null | undefined
) {
  if (!asset || Platform.OS === "web") {
    return null;
  }

  return getOfflineAssetUriIfComplete(
    asset.storageBucket,
    asset.storagePath
  );
}

export function getOfflineQuestionPosterUrl(
  asset: QuestionDeliveryAsset | null | undefined
) {
  if (
    !asset?.posterStorageBucket ||
    !asset.posterStoragePath ||
    Platform.OS === "web"
  ) {
    return null;
  }

  return getOfflineAssetUriIfComplete(
    asset.posterStorageBucket,
    asset.posterStoragePath
  );
}

export async function downloadOfflinePack({
  category,
  questionBank,
  onProgress,
}: DownloadOfflinePackInput) {
  assertOfflinePackSupported();

  if (!(await checkInternetReachability())) {
    throw new OfflinePackError(
      "connectivity_required",
      "An internet connection is required to download the offline pack."
    );
  }

  if (questionBank.length === 0) {
    throw new OfflinePackError(
      "catalog_unavailable",
      "The question catalog is not ready yet."
    );
  }

  const assets = buildOfflineAssetEntries(questionBank);
  pruneIncompleteOfflineAssetFiles(assets);
  const plan = buildOfflinePackPlan(questionBank, category, assets);
  const metadata = await readOfflinePackMetadata();

  if (
    metadata.readyPack?.category &&
    metadata.readyPack.category !== category
  ) {
    await clearOfflinePack();
  }
  const initialProgress = computeTransferProgress(assets);
  const now = new Date().toISOString();

  const transferBase: OfflinePackTransfer = {
    catalogSignature: plan.catalogSignature,
    downloadedAssetCount: initialProgress.downloadedAssetCount,
    downloadedBytes: initialProgress.downloadedBytes,
    lastError: null,
    startedAt: metadata.transfer?.status === "downloading"
      ? metadata.transfer.startedAt
      : now,
    status: "downloading",
    targetAssetCount: plan.assetCount,
    targetCategory: category,
    targetQuestionCount: plan.questionCount,
    targetTotalBytes: estimateOfflinePackDownloadBytes(plan),
    unknownSizeAssetCount: plan.unknownSizeAssetCount,
    updatedAt: now,
  };

  await ensureOfflineRootDirectory();
  await writeOfflinePackMetadata({
    readyPack: metadata.readyPack?.category === category
      ? metadata.readyPack
      : null,
    transfer: transferBase,
    version: OFFLINE_PACK_VERSION,
  });
  onProgress?.(transferBase);

  try {
    assertEnoughDiskSpace(
      readAvailableDiskSpace(),
      getRemainingBytes(assets)
    );

    let downloadedAssetCount = initialProgress.downloadedAssetCount;
    let downloadedBytes = initialProgress.downloadedBytes;

    for (const asset of assets) {
      if (isOfflineAssetComplete(asset)) {
        continue;
      }

      ensureDirectoryExists(asset.file.parentDirectory);
      assertEnoughDiskSpace(
        readAvailableDiskSpace(),
        getRemainingBytes(assets)
      );

      if (asset.file.exists) {
        asset.file.delete();
      }

      await File.downloadFileAsync(asset.url, asset.file, {
        idempotent: true,
      });

      if (!isOfflineAssetComplete(asset)) {
        throw new Error(`Downloaded asset is incomplete: ${asset.key}`);
      }

      offlineAssetUriCache.set(asset.key, asset.file.uri);
      downloadedAssetCount += 1;
      downloadedBytes += asset.expectedBytes ?? asset.file.size;

      const nextTransfer: OfflinePackTransfer = {
        ...transferBase,
        downloadedAssetCount,
        downloadedBytes,
        updatedAt: new Date().toISOString(),
      };
      await writeOfflinePackMetadata({
        readyPack: metadata.readyPack?.category === category
          ? metadata.readyPack
          : null,
        transfer: nextTransfer,
        version: OFFLINE_PACK_VERSION,
      });
      onProgress?.(nextTransfer);
    }

    await writeJsonFile(getOfflineCatalogFile(), questionBank);

    const readyPack: OfflinePackReadyInfo = {
      assetCount: plan.assetCount,
      catalogSignature: plan.catalogSignature,
      category,
      completedAt: new Date().toISOString(),
      questionCount: plan.questionCount,
      totalBytes: downloadedBytes,
    };

    await writeOfflinePackMetadata({
      readyPack,
      transfer: null,
      version: OFFLINE_PACK_VERSION,
    });
    pruneOfflineAssetFiles(assets);

    return readyPack;
  } catch (error) {
    const failedTransfer: OfflinePackTransfer = {
      ...transferBase,
      ...computeTransferProgress(assets),
      lastError: getOfflinePackErrorMessage(error),
      status: "error",
      updatedAt: new Date().toISOString(),
    };

    await writeOfflinePackMetadata({
      readyPack: metadata.readyPack?.category === category
        ? metadata.readyPack
        : null,
      transfer: failedTransfer,
      version: OFFLINE_PACK_VERSION,
    });
    onProgress?.(failedTransfer);
    throw error;
  }
}

export async function clearOfflinePack() {
  assertOfflinePackSupported();
  const root = getOfflineRootDirectory();

  if (root.exists) {
    root.delete();
  }

  offlineAssetUriCache.clear();
}

export function formatOfflineBytes(bytes: number | null | undefined) {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return "0 MB";
  }

  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const rounded = value >= 100 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(rounded)} ${units[unitIndex]}`;
}

export function estimateOfflinePackDownloadBytes(
  plan: OfflinePackPlan | null | undefined
) {
  if (!plan) {
    return 0;
  }

  return (
    plan.totalBytes + plan.unknownSizeAssetCount * UNKNOWN_ASSET_RESERVE_BYTES
  );
}

export function isOfflinePackStorageLow(
  availableBytes: number | null,
  plan: OfflinePackPlan | null | undefined
) {
  if (availableBytes === null || !plan) {
    return false;
  }

  return (
    availableBytes <
    estimateOfflinePackDownloadBytes(plan) + SAFETY_FREE_SPACE_BYTES
  );
}

export function getOfflinePackErrorMessage(error: unknown) {
  if (error instanceof OfflinePackError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" && message.trim()
    ? message
    : "The offline pack could not be prepared.";
}

function assertOfflinePackSupported() {
  if (Platform.OS === "web") {
    throw new OfflinePackError(
      "platform_unsupported",
      "Offline downloads are not supported on web."
    );
  }
}

function buildOfflinePackPlan(
  questionBank: LocalQuestion[],
  category: DrivingCategory,
  assets = buildOfflineAssetEntries(questionBank)
): OfflinePackPlan {
  return {
    assetCount: assets.length,
    catalogSignature: buildCatalogSignature(questionBank),
    category,
    questionCount: questionBank.length,
    totalBytes: assets.reduce(
      (sum, asset) => sum + (asset.expectedBytes ?? 0),
      0
    ),
    unknownSizeAssetCount: assets.filter(
      (asset) => asset.expectedBytes === null
    ).length,
  };
}

function buildSyntheticOfflinePackPlan(
  questionBank: LocalQuestion[],
  category: DrivingCategory
): OfflinePackPlan {
  const assets = buildOfflineAssetIntegrityEntries(questionBank);

  return {
    assetCount: assets.length,
    catalogSignature: buildCatalogSignature(questionBank),
    category,
    questionCount: questionBank.length,
    totalBytes: assets.reduce(
      (sum, asset) => sum + (asset.expectedBytes ?? 0),
      0
    ),
    unknownSizeAssetCount: assets.filter(
      (asset) => asset.expectedBytes === null
    ).length,
  };
}

function readE2EOfflinePackSnapshot(
  input: RelatedOfflineContext
): OfflinePackSnapshot | null {
  const e2eOverride = getE2EOfflinePackOverride();

  if (!e2eOverride) {
    return null;
  }

  const questionBank = input.questionBank ?? getQuestionBank();
  const plan =
    questionBank.length > 0
      ? buildSyntheticOfflinePackPlan(questionBank, input.currentCategory)
      : null;
  const overrideCategory = e2eOverride.category ?? input.currentCategory;
  const readyPack =
    e2eOverride.status === "ready"
      ? createSyntheticReadyPack(questionBank, overrideCategory)
      : null;
  const transfer =
    e2eOverride.status === "incomplete"
      ? createSyntheticTransfer(questionBank, overrideCategory)
      : null;
  const readyPackMatchesCurrentCategory =
    readyPack?.category === input.currentCategory;
  const readyPackMatchesCurrentCatalog =
    readyPack && plan && readyPackMatchesCurrentCategory
      ? readyPack.catalogSignature === plan.catalogSignature
      : null;

  return {
    availableDiskSpace: 2 * 1024 * 1024 * 1024,
    hasStoredData: e2eOverride.status !== "missing",
    plan,
    readyPack,
    readyPackMatchesCurrentCatalog,
    readyPackMatchesCurrentCategory,
    transfer,
  };
}

function createSyntheticReadyPack(
  questionBank: LocalQuestion[],
  category: DrivingCategory
): OfflinePackReadyInfo {
  const plan = buildSyntheticOfflinePackPlan(questionBank, category);

  return {
    assetCount: plan.assetCount,
    catalogSignature: plan.catalogSignature,
    category,
    completedAt: new Date().toISOString(),
    questionCount: plan.questionCount,
    totalBytes: plan.totalBytes,
  };
}

function createSyntheticTransfer(
  questionBank: LocalQuestion[],
  category: DrivingCategory
): OfflinePackTransfer {
  const plan = buildSyntheticOfflinePackPlan(questionBank, category);
  const targetTotalBytes = estimateOfflinePackDownloadBytes(plan);
  const downloadedAssetCount =
    plan.assetCount > 0 ? Math.max(0, Math.floor(plan.assetCount / 2)) : 0;
  const downloadedBytes =
    plan.assetCount > 0
      ? Math.floor(targetTotalBytes * 0.5)
      : Math.floor(targetTotalBytes * 0.25);

  return {
    catalogSignature: plan.catalogSignature,
    downloadedAssetCount,
    downloadedBytes,
    lastError: "E2E seeded interrupted offline download.",
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    status: "error",
    targetAssetCount: plan.assetCount,
    targetCategory: category,
    targetQuestionCount: plan.questionCount,
    targetTotalBytes,
    unknownSizeAssetCount: plan.unknownSizeAssetCount,
    updatedAt: new Date().toISOString(),
  };
}

function buildOfflineAssetEntries(questionBank: LocalQuestion[]) {
  const entries = new Map<string, OfflineAssetEntry>();

  const pushAsset = (asset: QuestionDeliveryAsset | null | undefined) => {
    if (!asset) {
      return;
    }

    const mainUrl = buildRemoteStorageUrl(
      asset.storageBucket,
      asset.storagePath
    );

    if (!mainUrl) {
      throw new OfflinePackError(
        "storage_url_missing",
        "The media base URL is missing for offline downloads."
      );
    }

    const mainKey = buildOfflineAssetKey(
      asset.storageBucket,
      asset.storagePath
    );

    if (!entries.has(mainKey)) {
      entries.set(mainKey, {
        bucket: asset.storageBucket,
        expectedBytes: lookupOfflineAssetBytes(
          asset.storageBucket,
          asset.storagePath
        ),
        file: getOfflineAssetFile(asset.storageBucket, asset.storagePath),
        key: mainKey,
        storagePath: asset.storagePath,
        url: mainUrl,
      });
    }

    if (!asset.posterStorageBucket || !asset.posterStoragePath) {
      return;
    }

    const posterUrl = buildRemoteStorageUrl(
      asset.posterStorageBucket,
      asset.posterStoragePath
    );

    if (!posterUrl) {
      throw new OfflinePackError(
        "storage_url_missing",
        "The poster base URL is missing for offline downloads."
      );
    }

    const posterKey = buildOfflineAssetKey(
      asset.posterStorageBucket,
      asset.posterStoragePath
    );

    if (!entries.has(posterKey)) {
      entries.set(posterKey, {
        bucket: asset.posterStorageBucket,
        expectedBytes: lookupOfflineAssetBytes(
          asset.posterStorageBucket,
          asset.posterStoragePath
        ),
        file: getOfflineAssetFile(
          asset.posterStorageBucket,
          asset.posterStoragePath
        ),
        key: posterKey,
        storagePath: asset.posterStoragePath,
        url: posterUrl,
      });
    }
  };

  for (const question of questionBank) {
    pushAsset(question.media?.asset);
    pushAsset(question.media?.pjm?.questionAsset ?? null);

    const answerAssets = question.media?.pjm?.answerAssets ?? {};
    for (const asset of Object.values(answerAssets)) {
      pushAsset(asset ?? null);
    }
  }

  return Array.from(entries.values()).sort((left, right) => {
    const leftWeight = left.bucket === "question-posters" ? 0 : 1;
    const rightWeight = right.bucket === "question-posters" ? 0 : 1;

    if (leftWeight !== rightWeight) {
      return leftWeight - rightWeight;
    }

    return left.key.localeCompare(right.key);
  });
}

function buildCatalogSignature(questionBank: LocalQuestion[]) {
  const normalized = [...questionBank]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((question) => JSON.stringify(normalizeQuestionForSignature(question)))
    .join("||");

  let hash = 2166136261;

  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `offline-${questionBank.length}-${(hash >>> 0).toString(16)}`;
}

function normalizeQuestionForSignature(question: LocalQuestion) {
  return {
    answerType: question.answerType,
    choices:
      question.choices?.map((choice) => ({
        id: choice.id,
        text: {
          de: choice.text.de,
          en: choice.text.en,
          pl: choice.text.pl,
          ua: choice.text.ua,
        },
      })) ?? null,
    correctAnswer: question.correctAnswer,
    difficultySeed: question.difficultySeed,
    explanation: {
      de: question.explanation.de,
      en: question.explanation.en,
      pl: question.explanation.pl,
      ua: question.explanation.ua,
    },
    id: question.id,
    media: question.media
      ? {
          asset: normalizeQuestionDeliveryAsset(question.media.asset),
          pjm: question.media.pjm
            ? {
                answerAssets: {
                  A: normalizeQuestionDeliveryAsset(
                    question.media.pjm.answerAssets?.A ?? null
                  ),
                  B: normalizeQuestionDeliveryAsset(
                    question.media.pjm.answerAssets?.B ?? null
                  ),
                  C: normalizeQuestionDeliveryAsset(
                    question.media.pjm.answerAssets?.C ?? null
                  ),
                },
                questionAsset: normalizeQuestionDeliveryAsset(
                  question.media.pjm.questionAsset ?? null
                ),
              }
            : null,
          type: question.media.type,
        }
      : null,
    points: question.points,
    primaryTopicId: question.primaryTopicId ?? null,
    prompt: {
      de: question.prompt.de,
      en: question.prompt.en,
      pl: question.prompt.pl,
      ua: question.prompt.ua,
    },
    scope: question.scope,
    sourceRowNumber: question.sourceRowNumber,
    topicBlock: question.topicBlock,
    topicIds: question.topicIds ?? [],
  };
}

function normalizeQuestionDeliveryAsset(
  asset: QuestionDeliveryAsset | null | undefined
) {
  if (!asset) {
    return null;
  }

  return {
    matchStrategy: asset.matchStrategy,
    mediaKey: asset.mediaKey,
    mediaType: asset.mediaType,
    originalFilename: asset.originalFilename,
    posterStorageBucket: asset.posterStorageBucket ?? null,
    posterStoragePath: asset.posterStoragePath ?? null,
    resolvedFilename: asset.resolvedFilename,
    sourceKind: asset.sourceKind,
    storageBucket: asset.storageBucket,
    storagePath: asset.storagePath,
  };
}

function buildRemoteStorageUrl(bucket: string, storagePath: string) {
  if (mobileEnv.mediaBaseUrl) {
    return `${mobileEnv.mediaBaseUrl.replace(/\/+$/, "")}/${encodeURIComponent(
      bucket
    )}/${encodeStoragePath(storagePath)}`;
  }

  if (!mobileEnv.supabaseUrl) {
    return null;
  }

  return `${mobileEnv.supabaseUrl.replace(
    /\/+$/,
    ""
  )}/storage/v1/object/public/${encodeURIComponent(
    bucket
  )}/${encodeStoragePath(storagePath)}`;
}

function encodeStoragePath(storagePath: string) {
  return storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function lookupOfflineAssetBytes(bucket: string, storagePath: string) {
  const value = offlineAssetSizeMap[buildOfflineAssetKey(bucket, storagePath)];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getOfflineRootDirectory() {
  return new Directory(Paths.document, OFFLINE_ROOT_DIR_NAME);
}

function getOfflineAssetsDirectory() {
  return new Directory(getOfflineRootDirectory(), OFFLINE_ASSETS_DIR_NAME);
}

function getOfflineMetadataFile() {
  return new File(getOfflineRootDirectory(), OFFLINE_METADATA_FILENAME);
}

function getOfflineCatalogFile() {
  return new File(getOfflineRootDirectory(), OFFLINE_CATALOG_FILENAME);
}

function buildOfflineAssetKey(bucket: string, storagePath: string) {
  return `${bucket}/${storagePath}`;
}

function getOfflineAssetFile(bucket: string, storagePath: string) {
  return new File(
    getOfflineAssetsDirectory(),
    bucket,
    ...storagePath.split("/")
  );
}

function getOfflineAssetUriIfComplete(bucket: string, storagePath: string) {
  const key = buildOfflineAssetKey(bucket, storagePath);
  const file = getOfflineAssetFile(bucket, storagePath);
  const cached = offlineAssetUriCache.get(key);

  if (cached !== undefined) {
    if (cached && isOfflineAssetComplete({
      expectedBytes: lookupOfflineAssetBytes(bucket, storagePath),
      file,
    })) {
      return cached;
    }

    if (!cached) {
      return null;
    }
  }

  const uri = isOfflineAssetComplete({
    expectedBytes: lookupOfflineAssetBytes(bucket, storagePath),
    file,
  })
    ? file.uri
    : null;
  offlineAssetUriCache.set(key, uri);
  return uri;
}

function computeTransferProgress(assets: OfflineAssetEntry[]) {
  return assets.reduce(
    (progress, asset) => {
      if (!isOfflineAssetComplete(asset)) {
        return progress;
      }

      return {
        downloadedAssetCount: progress.downloadedAssetCount + 1,
        downloadedBytes:
          progress.downloadedBytes + (asset.expectedBytes ?? asset.file.size),
      };
    },
    {
      downloadedAssetCount: 0,
      downloadedBytes: 0,
    }
  );
}

function buildOfflineAssetIntegrityEntries(questionBank: LocalQuestion[]) {
  const entries = new Map<string, OfflineAssetIntegrityEntry>();

  const pushAsset = (asset: QuestionDeliveryAsset | null | undefined) => {
    if (!asset) {
      return;
    }

    const mainKey = buildOfflineAssetKey(
      asset.storageBucket,
      asset.storagePath
    );

    if (!entries.has(mainKey)) {
      entries.set(mainKey, {
        expectedBytes: lookupOfflineAssetBytes(
          asset.storageBucket,
          asset.storagePath
        ),
        file: getOfflineAssetFile(asset.storageBucket, asset.storagePath),
      });
    }

    if (!asset.posterStorageBucket || !asset.posterStoragePath) {
      return;
    }

    const posterKey = buildOfflineAssetKey(
      asset.posterStorageBucket,
      asset.posterStoragePath
    );

    if (!entries.has(posterKey)) {
      entries.set(posterKey, {
        expectedBytes: lookupOfflineAssetBytes(
          asset.posterStorageBucket,
          asset.posterStoragePath
        ),
        file: getOfflineAssetFile(
          asset.posterStorageBucket,
          asset.posterStoragePath
        ),
      });
    }
  };

  for (const question of questionBank) {
    pushAsset(question.media?.asset);
    pushAsset(question.media?.pjm?.questionAsset ?? null);

    const answerAssets = question.media?.pjm?.answerAssets ?? {};
    for (const asset of Object.values(answerAssets)) {
      pushAsset(asset ?? null);
    }
  }

  return Array.from(entries.values());
}

function pruneIncompleteOfflineAssetFiles(assets: OfflineAssetEntry[]) {
  for (const asset of assets) {
    if (!asset.file.exists || isOfflineAssetComplete(asset)) {
      continue;
    }

    try {
      asset.file.delete();
    } catch {
      // Best effort: a stale partial file should not abort the whole refresh.
    }

    offlineAssetUriCache.delete(asset.key);
  }
}

function pruneOfflineAssetFiles(expectedAssets: OfflineAssetEntry[]) {
  const assetsDirectory = getOfflineAssetsDirectory();

  if (!assetsDirectory.exists) {
    return;
  }

  const expectedAssetUris = new Set(expectedAssets.map((asset) => asset.file.uri));

  try {
    pruneOfflineDirectoryContents(assetsDirectory, expectedAssetUris);
    offlineAssetUriCache.clear();
  } catch {
    // Best effort: stale files are not ideal, but they should not make the
    // freshly downloaded pack unusable.
  }
}

function pruneOfflineDirectoryContents(
  directory: Directory,
  expectedAssetUris: Set<string>
) {
  for (const entry of directory.list()) {
    if (entry instanceof Directory) {
      pruneOfflineDirectoryContents(entry, expectedAssetUris);

      if (entry.exists && entry.list().length === 0) {
        entry.delete();
      }

      continue;
    }

    if (!expectedAssetUris.has(entry.uri)) {
      entry.delete();
    }
  }
}

function getRemainingBytes(assets: OfflineAssetEntry[]) {
  return assets.reduce((sum, asset) => {
    if (isOfflineAssetComplete(asset)) {
      return sum;
    }

    return sum + (asset.expectedBytes ?? UNKNOWN_ASSET_RESERVE_BYTES);
  }, 0);
}

function isOfflineAssetComplete(asset: OfflineAssetIntegrityEntry) {
  if (!asset.file.exists) {
    return false;
  }

  if (asset.expectedBytes === null) {
    return asset.file.size > 0;
  }

  return asset.file.size === asset.expectedBytes;
}

function ensureDirectoryExists(directory: Directory) {
  if (directory.exists) {
    return;
  }

  directory.create({
    idempotent: true,
    intermediates: true,
  });
}

async function ensureOfflineRootDirectory() {
  ensureDirectoryExists(getOfflineRootDirectory());
  ensureDirectoryExists(getOfflineAssetsDirectory());
}

function readAvailableDiskSpace() {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return null;
  }
}

function hasOfflinePackData(metadata: OfflinePackMetadata) {
  return (
    metadata.readyPack !== null ||
    metadata.transfer !== null ||
    getOfflineRootDirectory().exists
  );
}

function assertEnoughDiskSpace(
  availableBytes: number | null,
  requiredBytes: number
) {
  if (availableBytes === null) {
    return;
  }

  const minimumRequired = requiredBytes + SAFETY_FREE_SPACE_BYTES;

  if (availableBytes < minimumRequired) {
    throw new OfflinePackError(
      "storage_low",
      "There is not enough free space for the offline pack.",
      {
        availableBytes,
        requiredBytes: minimumRequired,
      }
    );
  }
}

function createEmptyOfflinePackMetadata(): OfflinePackMetadata {
  return {
    readyPack: null,
    transfer: null,
    version: OFFLINE_PACK_VERSION,
  };
}

async function readOfflinePackMetadata() {
  if (Platform.OS === "web") {
    return createEmptyOfflinePackMetadata();
  }

  const metadataFile = getOfflineMetadataFile();

  if (!metadataFile.exists) {
    return createEmptyOfflinePackMetadata();
  }

  try {
    const parsed = JSON.parse(await metadataFile.text()) as unknown;

    if (!parsed || typeof parsed !== "object") {
      return createEmptyOfflinePackMetadata();
    }

    const candidate = parsed as Partial<OfflinePackMetadata>;
    const normalizedTransfer = isOfflineTransfer(candidate.transfer)
      ? normalizePersistedTransfer(candidate.transfer)
      : null;

    return {
      readyPack: isOfflineReadyPack(candidate.readyPack)
        ? candidate.readyPack
        : null,
      transfer: normalizedTransfer,
      version:
        candidate.version === OFFLINE_PACK_VERSION
          ? OFFLINE_PACK_VERSION
          : OFFLINE_PACK_VERSION,
    };
  } catch {
    return createEmptyOfflinePackMetadata();
  }
}

async function readValidatedReadyOfflinePackState(): Promise<ValidatedReadyOfflinePackState> {
  const metadata = await readOfflinePackMetadata();
  const readyPack = metadata.readyPack;

  if (!readyPack) {
    return {
      metadata,
      readyPack: null,
      readyQuestions: null,
    };
  }

  const readyQuestions = await readOfflineCatalogQuestions();

  if (!readyQuestions || readyQuestions.length === 0) {
    return {
      metadata,
      readyPack: null,
      readyQuestions: null,
    };
  }

  if (buildCatalogSignature(readyQuestions) !== readyPack.catalogSignature) {
    return {
      metadata,
      readyPack: null,
      readyQuestions: null,
    };
  }

  const readyAssets = buildOfflineAssetIntegrityEntries(readyQuestions);

  if (readyAssets.some((asset) => !isOfflineAssetComplete(asset))) {
    return {
      metadata,
      readyPack: null,
      readyQuestions: null,
    };
  }

  return {
    metadata,
    readyPack,
    readyQuestions,
  };
}

async function readOfflineCatalogQuestions() {
  const catalogFile = getOfflineCatalogFile();

  if (!catalogFile.exists) {
    return null;
  }

  try {
    const parsed = JSON.parse(await catalogFile.text()) as unknown;

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed as LocalQuestion[];
  } catch {
    return null;
  }
}

async function writeOfflinePackMetadata(metadata: OfflinePackMetadata) {
  await writeJsonFile(getOfflineMetadataFile(), metadata);
}

async function writeJsonFile(file: File, value: unknown) {
  ensureDirectoryExists(file.parentDirectory);

  file.create({
    intermediates: true,
    overwrite: true,
  });

  file.write(JSON.stringify(value));
}

function isOfflineReadyPack(value: unknown): value is OfflinePackReadyInfo {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OfflinePackReadyInfo>;
  return (
    typeof candidate.category === "string" &&
    typeof candidate.catalogSignature === "string" &&
    typeof candidate.completedAt === "string" &&
    typeof candidate.questionCount === "number" &&
    typeof candidate.assetCount === "number" &&
    typeof candidate.totalBytes === "number"
  );
}

function isOfflineTransfer(value: unknown): value is OfflinePackTransfer {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<OfflinePackTransfer>;
  return (
    (candidate.status === "downloading" || candidate.status === "error") &&
    typeof candidate.targetCategory === "string" &&
    typeof candidate.catalogSignature === "string" &&
    typeof candidate.startedAt === "string" &&
    typeof candidate.updatedAt === "string" &&
    typeof candidate.targetQuestionCount === "number" &&
    typeof candidate.targetAssetCount === "number" &&
    typeof candidate.targetTotalBytes === "number" &&
    typeof candidate.downloadedAssetCount === "number" &&
    typeof candidate.downloadedBytes === "number" &&
    typeof candidate.unknownSizeAssetCount === "number"
  );
}

function normalizePersistedTransfer(transfer: OfflinePackTransfer) {
  if (transfer.status !== "downloading") {
    return transfer;
  }

  return {
    ...transfer,
    lastError:
      transfer.lastError ??
      "The app was closed before the offline download completed.",
    status: "error" as const,
    updatedAt: new Date().toISOString(),
  };
}
