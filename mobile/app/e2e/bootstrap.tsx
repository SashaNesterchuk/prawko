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

type BootstrapParams = {
  category?: string | string[];
  daysUntilExam?: string | string[];
  destination?: string | string[];
  locale?: string | string[];
  signCategoryId?: string | string[];
  topicId?: string | string[];
};

export default function E2EBootstrapScreen() {
  const hasHydrated = useHasHydrated();
  const hasBootstrappedRef = useRef(false);
  const params = useLocalSearchParams<BootstrapParams>();
  const destination = getSingleParam(params.destination);
  const category = getSingleParam(params.category);
  const locale = normalizeSupportedLocale(getSingleParam(params.locale));
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
    prepareE2EAppState({
      category,
      daysUntilExam,
      locale,
    });
    router.replace(
      resolveE2EDestination({
        destination,
        signCategoryId,
        topicId,
      }),
    );
  }, [
    category,
    daysUntilExam,
    destination,
    hasHydrated,
    locale,
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
