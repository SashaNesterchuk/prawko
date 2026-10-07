import * as Application from "expo-application";

import type { AnalyticsProperties } from "./catalog";

export function getApplicationScopeProperties(): AnalyticsProperties {
  try {
    const value = Application.applicationId;
    const valid = typeof value === "string" && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
    return {
      application_id: valid ? value : null,
      application_id_basis: valid ? "native_application_id" : "not_available",
    };
  } catch {
    return { application_id: null, application_id_basis: "observation_failed" };
  }
}
