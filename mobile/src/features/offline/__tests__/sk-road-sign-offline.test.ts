import { CZECH_RASTER_ALIASES } from "../../../../variants/slovak/cz-raster-aliases";
import { roadSignCatalog } from "../../../../variants/slovak/road-sign-catalog";
import {
  listSlovakOfflineSignAssetPlans,
  SK_ROAD_SIGN_OFFLINE_BUCKET,
  SK_ROAD_SIGN_THUMB_BYTES,
} from "../sk-road-sign-offline";

describe("Slovak offline road-sign downloads", () => {
  const plans = listSlovakOfflineSignAssetPlans();
  const plannedIds = new Set(plans.map((plan) => plan.id));

  it("queues Commons thumbs for signs that are not already in the app bundle", () => {
    expect(plannedIds.has("101")).toBe(true);
    expect(plannedIds.has("110-10")).toBe(true);
    expect(plannedIds.has("202")).toBe(false);
    expect(plannedIds.has("230")).toBe(false);

    expect(plans.length).toBe(
      roadSignCatalog.signs.length - Object.keys(CZECH_RASTER_ALIASES).length
    );
    expect(plans.length).toBeGreaterThan(500);
  });

  it("keeps Wikimedia PNG URLs and a small size estimate, not the 2MB unknown-asset reserve", () => {
    expect(
      plans.every(
        (plan) =>
          plan.url.startsWith("https://") &&
          plan.key.startsWith(`${SK_ROAD_SIGN_OFFLINE_BUCKET}/`) &&
          plan.expectedBytes === SK_ROAD_SIGN_THUMB_BYTES
      )
    ).toBe(true);
    expect(SK_ROAD_SIGN_THUMB_BYTES).toBeLessThan(100 * 1024);
  });
});
