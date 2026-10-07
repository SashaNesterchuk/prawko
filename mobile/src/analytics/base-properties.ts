import { FEATURE_FLAGS } from "@prawko/config";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { Platform } from "react-native";

import { mobileEnv } from "../config/env";
import { getQuestionSetKey } from "../countries/runtime";
import { getExamProfileForCountry } from "../features/exam/exam-profile";
import { getCurrentUserFromState, useAppShellStore } from "../state/app-shell";
import { readHasPlusAccess, useEntitlementStore } from "../state/entitlements";
import { useQuestionCatalogStore } from "../state/question-catalog";
import type { AnalyticsProperties } from "./catalog";
import { contentFingerprint } from "./content-revisions";
import { getObservedBankRevision } from "./ContentAnalyticsObserver";
import { getInstallObservationProperties } from "./install-observation";
import { getApplicationScopeProperties } from "./application-scope";

export function getAnalyticsBaseProperties(appUserId: string): AnalyticsProperties {
  const shell = useAppShellStore.getState();
  const user = getCurrentUserFromState(shell);
  const catalog = useQuestionCatalogStore.getState();
  const access = useEntitlementStore.getState();
  const isPlus = readHasPlusAccess();
  const purchaseGranted = access.revenueCatFeatureEntitlements.premium_access || access.revenueCatFeatureEntitlements.ai_question_chat;
  const schoolGranted = Boolean(access.schoolAccess) &&
    (access.featureEntitlements.premium_access || access.featureEntitlements.ai_question_chat);
  let timezone: string | null = null;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null; } catch { /* Optional locale metadata. */ }
  return {
    ...getInstallObservationProperties(appUserId),
    ...getApplicationScopeProperties(),
    app_user_id: appUserId,
    app_version: Constants.expoConfig?.version ?? "unknown",
    app_build: Application.nativeBuildVersion ?? null,
    runtime_version: typeof Constants.expoConfig?.runtimeVersion === "string"
      ? Constants.expoConfig.runtimeVersion : null,
    analytics_environment: mobileEnv.enableE2ETestMode ? "e2e" : __DEV__ ? "development" : "production_candidate",
    auth_mode: user?.provider ?? "guest",
    supabase_user_id: user?.provider === "supabase" ? user.id : null,
    category: shell.preferredCategory,
    exam_country: shell.examCountry,
    locale: shell.preferredLocale,
    platform: Platform.OS,
    is_plus: isPlus,
    access_source: !isPlus ? "none" : purchaseGranted ? "purchase" : schoolGranted ? "school" : "other",
    onboarding_completed: shell.onboardingCompleted,
    question_set_key: getQuestionSetKey(),
    catalog_source: catalog.status,
    catalog_generation: catalog.version,
    bank_revision: getObservedBankRevision(),
    bank_revision_basis: "loaded_catalogue_fingerprint",
    exam_rules_revision: contentFingerprint(getExamProfileForCountry(shell.examCountry)),
    exam_rules_revision_basis: "current_country_config",
    catalog_ready: catalog.resolved,
    monetization_policy: FEATURE_FLAGS.monetizationV2 ? "v2" : "legacy",
    ads_policy_enabled: FEATURE_FLAGS.enableAds,
    timezone,
    utc_offset_minutes: -new Date().getTimezoneOffset(),
  };
}
