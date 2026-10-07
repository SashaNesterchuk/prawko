import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppShellStore } from "../../../state/app-shell";
import { createEmptyFeatureEntitlements, useEntitlementStore } from "../../../state/entitlements";
import { validateAnalyticsPayload } from "../../../analytics/payload-contract";
import { reconcileCheckoutAccess, resetCheckoutForTests, startCheckoutPurchase, startCheckoutRestore } from "../checkout";
import { readCheckoutJournal } from "../checkout-journal";
import {
  fetchRevenueCatAccessSnapshot, purchaseRevenueCatPackage, restoreRevenueCatPurchases, type RevenueCatSnapshot,
} from "../revenuecat";
import { analyticsOffer } from "./offer-fixture";

jest.mock("../../../identity/app-user-id", () => {
  let id = 0;
  return { createAppUserId: () => `usr_payload_${++id}` };
});
jest.mock("../revenuecat", () => ({
  purchaseRevenueCatPackage: jest.fn(), restoreRevenueCatPurchases: jest.fn(),
  fetchRevenueCatAccessSnapshot: jest.fn(), fetchRevenueCatSnapshot: jest.fn(),
  getRevenueCatDiagnostic: jest.fn(() => ({})),
  getRevenueCatErrorCode: jest.fn((error: { code?: string } | null) => error?.code ?? null),
  getRevenueCatErrorMessage: jest.fn(() => "Controlled adapter response."),
  getRevenueCatWhy: jest.fn(() => "unknown"),
}));

const USER = "install-payload-golden";
function snapshot(active = false): RevenueCatSnapshot {
  return {
    featureEntitlements: { ...createEmptyFeatureEntitlements(), premium_access: active },
    customerInfoRequestDate: "2026-10-07T10:00:00Z", isConfigured: true, offerings: [], offeringsError: null,
    activeProductIdentifiers: active ? ["premium-P3M"] : [],
    purchaseAccess: active ? {
      activeEntitlementIds: ["premium"], latestExpirationDate: null, managementUrl: null, originalAppUserId: USER,
    } : null,
  };
}
function input() {
  const selectedPackage = analyticsOffer();
  return {
    appUserId: USER, originViewId: "view-one", selectedPackage, selectPackage: () => selectedPackage,
    track: jest.fn(), captureError: jest.fn(), properties: { source: "paywall" },
  };
}
function assertTrace(track: jest.Mock) {
  for (const [event, payload] of track.mock.calls) {
    expect({ event, validation: validateAnalyticsPayload(event, payload) }).toEqual({
      event, validation: expect.objectContaining({ analytics_payload_contract_version: 2, analytics_payload_valid: true }),
    });
  }
}

describe("actual checkout coordinator with controlled native adapters: payload v2", () => {
  beforeEach(async () => {
    await new Promise((done) => setTimeout(done, 0));
    resetCheckoutForTests();
    useEntitlementStore.getState().clearRevenueCatState();
    await AsyncStorage.clear();
    useAppShellStore.setState({ examCountry: "PL", preferredCategory: "B", preferredLocale: "pl" });
    jest.mocked(purchaseRevenueCatPackage).mockReset();
    jest.mocked(restoreRevenueCatPurchases).mockReset();
    jest.mocked(fetchRevenueCatAccessSnapshot).mockReset().mockResolvedValue(snapshot());
  });

  it("observes persist -> native invocation -> SDK success once, with a nullable transaction", async () => {
    const request = input();
    jest.mocked(purchaseRevenueCatPackage).mockImplementationOnce(async (native) => {
      await native.onStage?.("purchase_package", request.selectedPackage);
      native.onNativePurchaseStart?.();
      return { snapshot: snapshot(true), transactionId: null };
    });
    const attempt = await startCheckoutPurchase(request);
    expect(attempt?.status).toBe("succeeded");
    const events = request.track.mock.calls.map(([event]) => event);
    expect(events).toEqual(["purchase_stage_changed", "purchase_stage_changed", "purchase_stage_changed",
      "purchase_started", "purchase_succeeded"]);
    expect(request.track.mock.calls.find(([event]) => event === "purchase_succeeded")?.[1]).toMatchObject({
      native_purchase_completed: true, transaction_id: null, confirmation_source: "purchase_result",
    });
    expect(purchaseRevenueCatPackage).toHaveBeenCalledTimes(1);
    await expect(readCheckoutJournal(USER)).resolves.toEqual([]);
    assertTrace(request.track);
  });

  it.each([
    ["20", "awaiting_confirmation", "purchase_pending", "payment_pending"],
    ["6", "awaiting_confirmation", "purchase_pending", "already_owned"],
    ["2", "outcome_unknown", "purchase_outcome_unknown", "store_problem"],
    ["10", "outcome_unknown", "purchase_outcome_unknown", "network"],
    ["unmapped", "outcome_unknown", "purchase_outcome_unknown", "unknown"],
    ["1", "cancelled", "purchase_cancelled", "cancelled"],
    ["3", "failed", "purchase_failed", "not_allowed"],
    ["15", "failed", "purchase_failed", "operation_in_progress"],
  ] as const)("retains native error %s as %s without changing its business decision", async (code, status, event, category) => {
    const request = input();
    jest.mocked(purchaseRevenueCatPackage).mockImplementationOnce(async (native) => {
      await native.onStage?.("purchase_package", request.selectedPackage);
      native.onNativePurchaseStart?.();
      throw Object.assign(new Error("private@example.com native response"), { code });
    });
    const attempt = await startCheckoutPurchase(request);
    expect(attempt?.status).toBe(status);
    const emitted = request.track.mock.calls.find(([name]) => name === event)?.[1];
    expect(emitted).toMatchObject({ error_category: category });
    if (event === "purchase_outcome_unknown" || event === "purchase_pending") {
      expect(emitted.confirmation_reason).toBe(category);
      expect(request.track.mock.calls.some(([name]) => name === "purchase_failed")).toBe(false);
    }
    expect(JSON.stringify(request.track.mock.calls)).not.toContain("private@example.com");
    expect(purchaseRevenueCatPackage).toHaveBeenCalledTimes(1);
    assertTrace(request.track);
  });

  it("keeps preflight network failure before native invocation and does not fabricate a native start", async () => {
    jest.mocked(fetchRevenueCatAccessSnapshot).mockRejectedValueOnce({ code: "10" });
    const request = input();
    expect((await startCheckoutPurchase(request))?.status).toBe("failed");
    expect(request.track.mock.calls.map(([event]) => event)).toEqual([
      "purchase_stage_changed", "purchase_preparation_failed",
    ]);
    expect(purchaseRevenueCatPackage).not.toHaveBeenCalled();
    assertTrace(request.track);
  });

  it("separates adapter preparation failure from a native purchase error", async () => {
    const request = input();
    jest.mocked(purchaseRevenueCatPackage).mockRejectedValueOnce({ code: "10" });
    expect((await startCheckoutPurchase(request))?.status).toBe("failed");
    expect(request.track.mock.calls.map(([event]) => event)).toEqual([
      "purchase_stage_changed", "purchase_preparation_failed",
    ]);
    expect(purchaseRevenueCatPackage).toHaveBeenCalledTimes(1);
    assertTrace(request.track);
  });

  it("retains pending SDK completion until matching access arrives without a second native invocation", async () => {
    const request = input();
    jest.mocked(purchaseRevenueCatPackage).mockImplementationOnce(async (native) => {
      await native.onStage?.("purchase_package", request.selectedPackage);
      native.onNativePurchaseStart?.();
      return { snapshot: snapshot(), transactionId: "transaction-one" };
    });
    expect((await startCheckoutPurchase(request))?.status).toBe("awaiting_confirmation");
    expect(request.track.mock.calls.find(([event]) => event === "purchase_pending")?.[1]).toMatchObject({
      transaction_id: "transaction-one", confirmation_reason: "entitlement_not_yet_active",
    });
    expect(request.track.mock.calls.some(([event]) => event === "purchase_succeeded")).toBe(false);
    reconcileCheckoutAccess(USER, snapshot(true));
    expect(request.track.mock.calls.filter(([event]) => event === "purchase_succeeded")).toHaveLength(1);
    expect(request.track.mock.calls.find(([event]) => event === "purchase_succeeded")?.[1]).toMatchObject({
      native_purchase_completed: true, transaction_id: "transaction-one", confirmation_source: "customer_info",
    });
    expect(purchaseRevenueCatPackage).toHaveBeenCalledTimes(1);
    assertTrace(request.track);
  });

  it("keeps unreadable journal failure diagnostic and never calls the native adapter", async () => {
    await AsyncStorage.setItem(`prawko.checkout.v1:ios:${USER}`, "{");
    const request = input();
    expect((await startCheckoutPurchase(request))?.status).toBe("failed");
    expect(request.track.mock.calls.map(([event]) => event)).toEqual(["purchase_preparation_failed"]);
    expect(request.track.mock.calls[0][1].error_category).toBe("local_storage");
    expect(purchaseRevenueCatPackage).not.toHaveBeenCalled();
    assertTrace(request.track);
  });

  it("does not let capture failure change native success, access or journal cleanup", async () => {
    const request = input();
    request.track.mockImplementation(() => { throw new Error("optional analytics"); });
    jest.mocked(purchaseRevenueCatPackage).mockImplementationOnce(async (native) => {
      await native.onStage?.("purchase_package", request.selectedPackage);
      native.onNativePurchaseStart?.();
      return { snapshot: snapshot(true), transactionId: "transaction-one" };
    });
    expect((await startCheckoutPurchase(request))?.status).toBe("succeeded");
    expect(useEntitlementStore.getState().revenueCatFeatureEntitlements.premium_access).toBe(true);
    expect(purchaseRevenueCatPackage).toHaveBeenCalledTimes(1);
    await expect(readCheckoutJournal(USER)).resolves.toEqual([]);
    assertTrace(request.track);
  });

  it.each([false, true])("keeps canonical restore %s separate from legacy alias and purchases", async (active) => {
    const request = { ...input(), properties: { source: "access_center" } };
    jest.mocked(restoreRevenueCatPurchases).mockResolvedValueOnce(snapshot(active));
    const attempt = await startCheckoutRestore(request);
    expect(attempt?.status).toBe(active ? "succeeded" : "empty");
    expect(request.track.mock.calls.map(([event]) => event)).toEqual([
      "purchase_restore_started", "restore_started", "restore_succeeded",
      active ? "purchase_restore_succeeded" : "purchase_restore_empty",
    ]);
    expect(restoreRevenueCatPurchases).toHaveBeenCalledTimes(1);
    expect(purchaseRevenueCatPackage).not.toHaveBeenCalled();
    assertTrace(request.track);
  });

  it("keeps a failed restore explicit even if a concurrent access snapshot is active", async () => {
    const request = { ...input(), properties: { source: "access_center" } };
    jest.mocked(restoreRevenueCatPurchases).mockImplementationOnce(async () => {
      useEntitlementStore.getState().hydrateRevenueCatSnapshot(snapshot(true));
      throw { code: "10" };
    });
    const attempt = await startCheckoutRestore(request);
    expect(attempt?.status).toBe("failed");
    expect(request.track.mock.calls.find(([event]) => event === "purchase_restore_failed")?.[1]).toMatchObject({
      entitlement_active: true, restore_outcome: "failed", error_category: "network",
    });
    expect(request.track.mock.calls.some(([event]) => event === "purchase_restore_succeeded")).toBe(false);
    assertTrace(request.track);
  });
});
