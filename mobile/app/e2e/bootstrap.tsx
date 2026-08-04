import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { mobileEnv } from "../../src/config/env";
import { normalizeSupportedLocale } from "../../src/i18n/locale";
import { useHasHydrated } from "../../src/state/app-shell";
import {
  prepareE2EAppState,
  resolveE2EDestination,
} from "../../src/testing/e2e/bootstrap";
import type { E2EOfflinePackStatus } from "../../src/testing/e2e/state";
import type { RemoteExamSessionStatus } from "../../src/features/exam/types";

type BootstrapParams = {
  category?: string | string[];
  daysUntilExam?: string | string[];
  destination?: string | string[];
  examSessionCategory?: string | string[];
  examSessionStatus?: string | string[];
  examStartOrder?: string | string[];
  locale?: string | string[];
  offlinePackCategory?: string | string[];
  offlinePackStatus?: string | string[];
  plusAccess?: string | string[];
  reachability?: string | string[];
  signCategoryId?: string | string[];
  topicId?: string | string[];
};

export default function E2EBootstrapScreen() {
  const hasHydrated = useHasHydrated();
  const hasBootstrappedRef = useRef(false);
  const params = useLocalSearchParams<BootstrapParams>();
  const destination = getSingleParam(params.destination);
  const category = getSingleParam(params.category);
  const plusAccess = parseOptionalBoolean(getSingleParam(params.plusAccess));
  const reachability = parseOptionalBoolean(getSingleParam(params.reachability));
  const locale = normalizeSupportedLocale(getSingleParam(params.locale));
  const offlinePackCategory = getSingleParam(params.offlinePackCategory);
  const offlinePackStatus = parseOfflinePackStatus(
    getSingleParam(params.offlinePackStatus)
  );
  const examSessionCategory = getSingleParam(params.examSessionCategory);
  const examSessionStatus = parseExamSessionStatus(
    getSingleParam(params.examSessionStatus)
  );
  const reviewStartOrder = parsePositiveInteger(
    getSingleParam(params.examStartOrder)
  );
  const signCategoryId = getSingleParam(params.signCategoryId);
  const topicId = getSingleParam(params.topicId);
  const daysUntilExam = parsePositiveInteger(getSingleParam(params.daysUntilExam));

  useEffect(() => {
    if (
      !mobileEnv.enableE2ETestMode ||
      !hasHydrated ||
      hasBootstrappedRef.current
    ) {
      return;
    }

    hasBootstrappedRef.current = true;
    void (async () => {
      const prepared = await prepareE2EAppState({
        category,
        daysUntilExam,
        examSessionCategory,
        examSessionStatus,
        locale,
        offlinePackCategory,
        offlinePackStatus,
        plusAccess,
        reachability,
      });

      router.replace(
        resolveE2EDestination({
          destination,
          reviewStartOrder,
          seededExamSessionId: prepared.seededExamSessionId,
          signCategoryId,
          topicId,
        }),
      );
    })();
  }, [
    category,
    daysUntilExam,
    destination,
    examSessionCategory,
    examSessionStatus,
    hasHydrated,
    locale,
    offlinePackCategory,
    offlinePackStatus,
    plusAccess,
    reachability,
    reviewStartOrder,
    signCategoryId,
    topicId,
  ]);

  const isEnabled = mobileEnv.enableE2ETestMode;
  const status = !isEnabled
    ? "E2E bootstrap disabled"
    : hasHydrated
      ? "Preparing app state"
      : "Waiting for persisted state";
  const detail = !isEnabled
    ? "Set EXPO_PUBLIC_E2E_TEST_MODE=1 in the app build used by Maestro."
    : "Seeding completed onboarding and redirecting to the requested screen.";

  return (
    <View
      style={styles.container}
      testID={isEnabled ? "screen-e2e-bootstrap" : "screen-e2e-bootstrap-disabled"}
    >
      <Text style={styles.title}>{status}</Text>
      <Text style={styles.detail}>{detail}</Text>
    </View>
  );
}

function getSingleParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalBoolean(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

function parseOfflinePackStatus(
  value: string | undefined
): E2EOfflinePackStatus | null {
  switch (value?.trim().toLowerCase()) {
    case "missing":
      return "missing";
    case "ready":
      return "ready";
    case "incomplete":
      return "incomplete";
    default:
      return null;
  }
}

function parseExamSessionStatus(
  value: string | undefined
): RemoteExamSessionStatus | null {
  switch (value?.trim().toLowerCase()) {
    case "active":
      return "active";
    case "completed":
      return "completed";
    case "abandoned":
      return "abandoned";
    case "expired":
      return "expired";
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#EEF4F2",
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: "#102A26",
    textAlign: "center",
  },
  detail: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#40615A",
    textAlign: "center",
  },
});
