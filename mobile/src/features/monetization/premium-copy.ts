import type { CountryConfig } from "@prawko/config";

const LIFETIME_COPY_KEYS = {
  roadmapBody: "roadmap.unlockBody",
  roadmapBillingPerk: "roadmap.perkLifetime",
  profileSubtitle: "monetizationV2.profileSubtitle",
} as const;

const SUBSCRIPTION_COPY_KEYS = {
  roadmapBody: "roadmap.unlockSubscriptionBody",
  roadmapBillingPerk: "roadmap.perkSubscription",
  profileSubtitle: "monetizationV2.profileSubscriptionSubtitle",
} as const;

/**
 * Billing follows the exam country, never the UI language or loaded offering:
 * PL sells subscriptions; CZ/SK keep the legacy one-time lifetime purchase.
 * Keep shared marketing surfaces consistent with docs/paywall.md.
 */
export function getPremiumCopyKeys(paywallOffer: CountryConfig["paywallOffer"]) {
  return paywallOffer === "plans" ? SUBSCRIPTION_COPY_KEYS : LIFETIME_COPY_KEYS;
}
