import type { QuestionDeliveryAsset } from "@prawko/schemas";

import { mobileEnv } from "../../config/env";
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

  return buildStoragePublicUrl(asset.storageBucket, asset.storagePath);
}

export function getQuestionDeliveryPosterUrl(
  asset: QuestionDeliveryAsset | null | undefined
): string | null {
  if (!asset?.posterStorageBucket || !asset.posterStoragePath) {
    return null;
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

  return (
    getQuestionDeliveryPosterUrl(media.asset) ??
    getQuestionDeliveryAssetUrl(media.asset)
  );
}

export function getQuestionMediaPjmSummary(media: QuestionMedia) {
  const answerAssets = media.pjm?.answerAssets ?? {};
  const answerTrackCount = Object.values(answerAssets).filter(Boolean).length;

  return {
    hasQuestionTrack: Boolean(media.pjm?.questionAsset),
    answerTrackCount,
  };
}
