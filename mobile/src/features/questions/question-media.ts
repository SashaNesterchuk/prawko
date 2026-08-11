import type { QuestionDeliveryAsset } from "@prawko/schemas";

import { mobileEnv } from "../../config/env";
import {
  getOfflineQuestionAssetUrl,
  getOfflineQuestionPosterUrl,
} from "../offline/offline-pack";
import type { QuestionMedia } from "./types";

function encodeStoragePath(storagePath: string) {
  return storagePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildStoragePublicUrl(
  bucket: string,
  storagePath: string
): string | null {
  if (mobileEnv.mediaBaseUrl) {
    const normalizedBaseUrl = mobileEnv.mediaBaseUrl.replace(/\/+$/, "");
    return `${normalizedBaseUrl}/${encodeURIComponent(
      bucket
    )}/${encodeStoragePath(storagePath)}`;
  }

  if (!mobileEnv.supabaseUrl) {
    return null;
  }

  const normalizedBaseUrl = mobileEnv.supabaseUrl.replace(/\/+$/, "");
  return `${normalizedBaseUrl}/storage/v1/object/public/${encodeURIComponent(
    bucket
  )}/${encodeStoragePath(storagePath)}`;
}

export function getQuestionDeliveryAssetUrl(
  asset: QuestionDeliveryAsset | null | undefined
): string | null {
  if (!asset) {
    return null;
  }

  // Offline media is only used when the app is actively serving the offline
  // catalog (device offline / remote unavailable). Online always uses remote URLs.
  const offlineUrl = getOfflineQuestionAssetUrl(asset);

  if (offlineUrl) {
    return offlineUrl;
  }

  return buildStoragePublicUrl(asset.storageBucket, asset.storagePath);
}

export function getQuestionDeliveryPosterUrl(
  asset: QuestionDeliveryAsset | null | undefined
): string | null {
  if (!asset?.posterStorageBucket || !asset.posterStoragePath) {
    return null;
  }

  const offlinePosterUrl = getOfflineQuestionPosterUrl(asset);

  if (offlinePosterUrl) {
    return offlinePosterUrl;
  }

  return buildStoragePublicUrl(
    asset.posterStorageBucket,
    asset.posterStoragePath
  );
}

export function getQuestionMediaPreviewUrl(
  media: QuestionMedia | null | undefined
): string | null {
  if (!media) {
    return null;
  }

  if (media.type === "image") {
    return getQuestionDeliveryAssetUrl(media.asset);
  }

  return getQuestionDeliveryPosterUrl(media.asset);
}

export type QuestionMediaPrefetchUrls = {
  /** Still images + video posters (safe for Image.prefetch). */
  imageUrls: string[];
  /** Video file URLs (warm via expo-video players / cache). */
  videoUrls: string[];
};

/**
 * Collect every media URL worth warming before a question is shown.
 * Images/posters are cheap; video bytes are separate so callers can
 * bound concurrent video players.
 */
export function collectQuestionMediaPrefetchUrls(
  media: QuestionMedia | null | undefined
): QuestionMediaPrefetchUrls {
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];

  if (!media) {
    return { imageUrls, videoUrls };
  }

  function pushUnique(target: string[], url: string | null | undefined) {
    if (url && !target.includes(url)) {
      target.push(url);
    }
  }

  function collectAsset(
    asset: QuestionDeliveryAsset | null | undefined,
    fallbackAsVideo: boolean
  ) {
    if (!asset) {
      return;
    }

    pushUnique(imageUrls, getQuestionDeliveryPosterUrl(asset));

    const assetUrl = getQuestionDeliveryAssetUrl(asset);
    if (!assetUrl) {
      return;
    }

    const isVideo =
      asset.mediaType === "video" ||
      (asset.mediaType !== "image" && fallbackAsVideo);

    if (isVideo) {
      pushUnique(videoUrls, assetUrl);
      return;
    }

    pushUnique(imageUrls, assetUrl);
  }

  collectAsset(media.asset, media.type === "video");
  collectAsset(media.pjm?.questionAsset ?? null, true);

  const answerAssets = media.pjm?.answerAssets;
  if (answerAssets) {
    for (const asset of Object.values(answerAssets)) {
      collectAsset(asset ?? null, true);
    }
  }

  return { imageUrls, videoUrls };
}

export function getQuestionMediaPjmSummary(media: QuestionMedia) {
  const answerAssets = media.pjm?.answerAssets ?? {};
  const answerTrackCount = Object.values(answerAssets).filter(Boolean).length;

  return {
    hasQuestionTrack: Boolean(media.pjm?.questionAsset),
    answerTrackCount,
  };
}
