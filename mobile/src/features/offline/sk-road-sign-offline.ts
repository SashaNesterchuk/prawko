import { CZECH_RASTER_ALIASES } from "../../../variants/slovak/cz-raster-aliases";
import { roadSignCatalog } from "../../../variants/slovak/road-sign-catalog";

/** Stored under the country-scoped offline root, not on the exam media CDN. */
export const SK_ROAD_SIGN_OFFLINE_BUCKET = "sk-road-signs";

/** Planning estimate for a 330px Commons PNG thumb. */
export const SK_ROAD_SIGN_THUMB_BYTES = 48 * 1024;

export type SlovakOfflineSignAssetPlan = {
  expectedBytes: number;
  id: string;
  key: string;
  storagePath: string;
  url: string;
};

export function buildSlovakOfflineSignStoragePath(signId: string) {
  return `${signId}.png`;
}

export function listSlovakOfflineSignAssetPlans(): SlovakOfflineSignAssetPlan[] {
  return roadSignCatalog.signs
    .filter((sign) => CZECH_RASTER_ALIASES[sign.id] == null)
    .map((sign) => {
      const storagePath = buildSlovakOfflineSignStoragePath(sign.id);
      return {
        expectedBytes: SK_ROAD_SIGN_THUMB_BYTES,
        id: sign.id,
        key: `${SK_ROAD_SIGN_OFFLINE_BUCKET}/${storagePath}`,
        storagePath,
        url: sign.previewUrl,
      };
    });
}
