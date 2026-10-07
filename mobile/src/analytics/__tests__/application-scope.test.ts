jest.mock("expo-application", () => ({
  __esModule: true, applicationId: "pl.synthetic.bundle", nativeBuildVersion: "27",
}));
jest.mock("expo-constants", () => ({ expoConfig: { version: "1.0.synthetic" } }));
jest.mock("@prawko/config", () => ({ FEATURE_FLAGS: { monetizationV2: true, enableAds: false } }));
jest.mock("../../config/env", () => ({ mobileEnv: { enableE2ETestMode: false } }));
jest.mock("../../countries/runtime", () => ({ getQuestionSetKey: () => "synthetic-questions" }));
jest.mock("../../features/exam/exam-profile", () => ({ getExamProfileForCountry: () => ({ country: "PL" }) }));
jest.mock("../../state/app-shell", () => ({
  getCurrentUserFromState: () => null,
  useAppShellStore: { getState: () => ({
    preferredCategory: "B", examCountry: "PL", preferredLocale: "uk", onboardingCompleted: true,
  }) },
}));
jest.mock("../../state/entitlements", () => ({
  readHasPlusAccess: () => false,
  useEntitlementStore: { getState: () => ({
    revenueCatFeatureEntitlements: {}, featureEntitlements: {}, schoolAccess: null,
  }) },
}));
jest.mock("../../state/question-catalog", () => ({
  useQuestionCatalogStore: { getState: () => ({ status: "ready", version: 1, resolved: true }) },
}));
jest.mock("../ContentAnalyticsObserver", () => ({ getObservedBankRevision: () => null }));
jest.mock("../install-observation", () => ({ getInstallObservationProperties: () => ({}) }));

import * as Application from "expo-application";
import { getApplicationScopeProperties } from "../application-scope";
import { getAnalyticsBaseProperties } from "../base-properties";
import { ANALYTICS_PROPERTIES, sanitizeAnalyticsProperties } from "../catalog";

describe("native application analytics namespace", () => {
  afterEach(() => {
    Object.defineProperty(Application, "applicationId", { configurable: true, value: "pl.synthetic.bundle" });
  });

  it("observes the actual native ID without a country or locale fallback", () => {
    expect(getApplicationScopeProperties()).toEqual({
      application_id: "pl.synthetic.bundle", application_id_basis: "native_application_id",
    });
    expect(ANALYTICS_PROPERTIES.applicationId).toBe("application_id");
    expect(sanitizeAnalyticsProperties(getApplicationScopeProperties())).toEqual(getApplicationScopeProperties());
  });

  it.each([null, undefined, "", "https://private/token", "learner@example.com", "x".repeat(201)])(
    "leaves unavailable or unsafe application identity unknown: %p",
    (value) => {
      Object.defineProperty(Application, "applicationId", { configurable: true, value });
      expect(getApplicationScopeProperties()).toEqual({
        application_id: null, application_id_basis: "not_available",
      });
    },
  );

  it("contains optional native observation failure without interrupting capture", () => {
    Object.defineProperty(Application, "applicationId", {
      configurable: true, get: () => { throw new Error("native observation failure"); },
    });
    expect(getApplicationScopeProperties()).toEqual({
      application_id: null, application_id_basis: "observation_failed",
    });
  });

  it("wires the native namespace into the actual base properties, independently of UI language", () => {
    expect(getAnalyticsBaseProperties("usr_synthetic")).toEqual(expect.objectContaining({
      app_user_id: "usr_synthetic", application_id: "pl.synthetic.bundle",
      application_id_basis: "native_application_id", exam_country: "PL", locale: "uk", app_build: "27",
    }));
  });

  it("keeps the base properties usable when the optional application ID getter fails", () => {
    Object.defineProperty(Application, "applicationId", {
      configurable: true, get: () => { throw new Error("optional native metadata unavailable"); },
    });
    expect(getAnalyticsBaseProperties("usr_synthetic")).toEqual(expect.objectContaining({
      app_user_id: "usr_synthetic", application_id: null, application_id_basis: "observation_failed",
      exam_country: "PL", locale: "uk",
    }));
  });
});
