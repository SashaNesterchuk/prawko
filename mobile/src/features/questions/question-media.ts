import type { QuestionDeliveryAsset } from "@prawko/schemas";

import { mobileEnv } from "../../config/env";
import type { QuestionMedia } from "./types";

export type QuestionMediaViewerParams = {
  label: string;
  mediaType: QuestionDeliveryAsset["mediaType"];
  posterStorageBucket?: string;
  posterStoragePath?: string;
  storageBucket: string;
  storagePath: string;
};

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

export function buildQuestionMediaViewerParams(input: {
  asset: QuestionDeliveryAsset;
  label: string;
}): QuestionMediaViewerParams {
  return {
    label: input.label,
    mediaType: input.asset.mediaType,
    posterStorageBucket: input.asset.posterStorageBucket ?? undefined,
    posterStoragePath: input.asset.posterStoragePath ?? undefined,
    storageBucket: input.asset.storageBucket,
    storagePath: input.asset.storagePath,
  };
}

export function getQuestionMediaViewerAssetUrl(
  params: QuestionMediaViewerParams | null | undefined
) {
  if (!params) {
    return null;
  }

  return buildStoragePublicUrl(params.storageBucket, params.storagePath);
}

export function getQuestionMediaViewerPreviewUrl(
  params: QuestionMediaViewerParams | null | undefined
) {
  if (!params) {
    return null;
  }

  if (params.mediaType === "image") {
    return getQuestionMediaViewerAssetUrl(params);
  }

  if (params.posterStorageBucket && params.posterStoragePath) {
    return buildStoragePublicUrl(
      params.posterStorageBucket,
      params.posterStoragePath
    );
  }

  return null;
}

export function getQuestionMediaPreviewUrl(
  media: QuestionMedia | null | undefined
): string | null {
  if (!media) {
    return null;
  }

  return getQuestionMediaViewerPreviewUrl(
    buildQuestionMediaViewerParams({
      asset: media.asset,
      label: media.asset.originalFilename,
    })
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
