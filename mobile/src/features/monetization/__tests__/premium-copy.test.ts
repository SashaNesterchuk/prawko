import { getCountryConfig, type CountryCode } from "@prawko/config";

import { resources } from "../../../i18n/resources";
import { getPremiumCopyKeys } from "../premium-copy";

const locales = ["pl", "en", "ua", "cs", "sk", "de", "es"] as const;

describe("country-specific Premium copy", () => {
  it("uses subscription copy for PL", () => {
    expect(getPremiumCopyKeys(getCountryConfig("PL").paywallOffer)).toEqual({
      roadmapBody: "roadmap.unlockSubscriptionBody",
      roadmapBillingPerk: "roadmap.perkSubscription",
      profileSubtitle: "monetizationV2.profileSubscriptionSubtitle",
    });
  });

  it.each(["CZ", "SK"] as const)("preserves lifetime copy for %s", (country) => {
    expect(getPremiumCopyKeys(getCountryConfig(country).paywallOffer)).toEqual({
      roadmapBody: "roadmap.unlockBody",
      roadmapBillingPerk: "roadmap.perkLifetime",
      profileSubtitle: "monetizationV2.profileSubtitle",
    });
  });

  it.each(locales)("keeps both billing flows translated in %s", (locale) => {
    const { roadmap, monetizationV2 } = resources[locale].translation;
    expect(roadmap.unlockSubscriptionBody.length).toBeGreaterThan(0);
    expect(roadmap.perkSubscription.length).toBeGreaterThan(0);
    expect(monetizationV2.profileSubscriptionSubtitle.length).toBeGreaterThan(0);
    expect(monetizationV2.profileChoosePlan.length).toBeGreaterThan(0);
    expect(roadmap.unlockSubscriptionBody).not.toBe(roadmap.unlockBody);
    expect(roadmap.perkSubscription).not.toBe(roadmap.perkLifetime);
    expect(monetizationV2.profileSubscriptionSubtitle).not.toBe(monetizationV2.profileSubtitle);
  });

  it.each(locales)("selects the same billing model regardless of %s UI copy", (locale) => {
    const translation = resources[locale].translation;
    for (const country of ["PL", "CZ", "SK"] as const satisfies readonly CountryCode[]) {
      const keys = getPremiumCopyKeys(getCountryConfig(country).paywallOffer);
      const body = keys.roadmapBody === "roadmap.unlockSubscriptionBody"
        ? translation.roadmap.unlockSubscriptionBody
        : translation.roadmap.unlockBody;
      expect(body).toBe(country === "PL"
        ? translation.roadmap.unlockSubscriptionBody
        : translation.roadmap.unlockBody);
    }
  });
});
