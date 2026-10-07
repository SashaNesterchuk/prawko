import type { AnalyticsProperties } from "../../analytics/catalog";
import type { RevenueCatPackageSummary } from "../../state/entitlements";

type PackageSnapshot = {
  product_id: string | null; package_id: string | null; offering_id: string | null; package_type: string | null;
  subscription_period: string | null; price: number | null; price_string: string | null;
  currency: string | null; price_basis: "store_display";
};
type KnownPackageSnapshot = PackageSnapshot & { product_id: string; currency: string; price: number };

/** Store offer metadata is a display snapshot, never verified revenue. */
export function getPackageAnalyticsSnapshot(pkg: RevenueCatPackageSummary): KnownPackageSnapshot;
export function getPackageAnalyticsSnapshot(pkg: RevenueCatPackageSummary | null): PackageSnapshot;
export function getPackageAnalyticsSnapshot(pkg: RevenueCatPackageSummary | null): PackageSnapshot & AnalyticsProperties {
  return {
    product_id: pkg?.productIdentifier ?? null,
    package_id: pkg?.identifier ?? null,
    offering_id: pkg?.offeringIdentifier ?? null,
    package_type: pkg?.packageType ?? null,
    subscription_period: pkg?.subscriptionPeriod ?? null,
    price: pkg?.price ?? null,
    price_string: pkg?.priceString || null,
    currency: pkg?.currencyCode ?? null,
    price_basis: "store_display",
  };
}
