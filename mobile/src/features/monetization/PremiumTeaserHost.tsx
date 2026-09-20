import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { router, usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { InteractionManager, Pressable, View } from "react-native";

import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import { CText, useResponsiveStyles } from "../../portable-ui";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { useHasPlusAccess } from "../../state/entitlements";
import { useAppShellStore, useHasHydrated } from "../../state/app-shell";
import { getMonetizationContextProperties } from "./monetization-analytics";
import {
  canShowMonetizationSurface,
  markMonetizationSurfaceShown,
  type MonetizationRequest,
  useMonetizationStore,
} from "./monetization-store";
import {
  isInterstitialShowing,
  subscribeInterstitialShowing,
} from "../ads/interstitial-controller";

type DismissMethod = "close_button" | "swipe" | "outside_tap";

export function PremiumTeaserHost() {
  const { t } = useTranslation();
  const styles = useStyles();
  const pathname = usePathname();
  const { track } = useAnalytics();
  const hasPlusAccess = useHasPlusAccess();
  const appShellHydrated = useHasHydrated();
  const onboardingCompleted = useAppShellStore(
    (state) => state.onboardingCompleted
  );
  const monetizationHydrated = useMonetizationStore(
    (state) => state.hasHydrated
  );
  const pendingRequest = useMonetizationStore(
    (state) => state.pendingRequest
  );
  const resolveRequest = useMonetizationStore(
    (state) => state.resolveRequest
  );
  const recordLaunch = useMonetizationStore((state) => state.recordLaunch);
  const requestSurface = useMonetizationStore(
    (state) => state.requestSurface
  );
  const setInstalledAt = useMonetizationStore(
    (state) => state.setInstalledAt
  );
  const didRecordLaunchRef = useRef(false);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const activeTeaserRequestRef = useRef<MonetizationRequest | null>(null);
  const dismissMethodRef = useRef<DismissMethod>("swipe");
  const shownAtRef = useRef<number | null>(null);
  const didTrackShownRequestRef = useRef<string | null>(null);
  const suppressDismissAnalyticsRef = useRef(false);
  const [isAdShowing, setIsAdShowing] = useState(isInterstitialShowing);

  useEffect(
    () => subscribeInterstitialShowing(setIsAdShowing),
    []
  );

  useEffect(() => {
    if (!pendingRequest && activeTeaserRequestRef.current) {
      dismissMethodRef.current = "close_button";
      bottomSheetRef.current?.dismiss();
    }
  }, [pendingRequest]);

  useEffect(() => {
    if (
      !appShellHydrated ||
      !monetizationHydrated ||
      didRecordLaunchRef.current
    ) {
      return;
    }

    didRecordLaunchRef.current = true;
    void Application.getInstallationTimeAsync()
      .then(setInstalledAt)
      .catch(() => undefined)
      .finally(() => {
        const { isFirstEverLaunch } = recordLaunch();
        const state = useMonetizationStore.getState();

        if (
          !isFirstEverLaunch &&
          onboardingCompleted &&
          pathname === "/" &&
          (state.trainingCompletedLifetime > 0 ||
            state.examCompletedLifetime > 0)
        ) {
          requestSurface("teaser", "app_open");
        }
      });
  }, [
    appShellHydrated,
    monetizationHydrated,
    onboardingCompleted,
    pathname,
    recordLaunch,
    requestSurface,
    setInstalledAt,
  ]);

  useEffect(() => {
    if (
      !pendingRequest ||
      isAdShowing ||
      !appShellHydrated ||
      !monetizationHydrated ||
      !onboardingCompleted
    ) {
      return;
    }

    if (hasPlusAccess) {
      resolveRequest(pendingRequest.id);
      return;
    }

    if (
      pathname.includes("/paywall") ||
      pathname.includes("/(onboarding)") ||
      pathname.includes("/exam/session")
    ) {
      return;
    }

    const delayMs =
      pendingRequest.moment === "after_exam"
        ? 1_000
        : pendingRequest.moment === "app_open"
          ? 1_000
          : 700;
    let cancelled = false;
    const timeout = setTimeout(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;

        if (!canShowMonetizationSurface(pendingRequest.surface)) {
          resolveRequest(pendingRequest.id);
          return;
        }

        if (pendingRequest.surface === "paywall") {
          markMonetizationSurfaceShown("paywall");
          resolveRequest(pendingRequest.id);
          router.push({
            pathname: "/paywall",
            params: {
              moment: pendingRequest.moment,
              presentation: "modal",
              source: "automatic",
            },
          });
          return;
        }

        dismissMethodRef.current = "swipe";
        suppressDismissAnalyticsRef.current = false;
        activeTeaserRequestRef.current = pendingRequest;
        bottomSheetRef.current?.present();
      });

      if (cancelled) task.cancel?.();
    }, delayMs);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [
    appShellHydrated,
    hasPlusAccess,
    isAdShowing,
    monetizationHydrated,
    onboardingCompleted,
    pathname,
    pendingRequest,
    resolveRequest,
  ]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        onPress={() => {
          dismissMethodRef.current = "outside_tap";
        }}
        pressBehavior="close"
      />
    ),
    []
  );

  const handleSheetChanged = useCallback(
    (index: number) => {
      const activeRequest = activeTeaserRequestRef.current;
      if (
        index < 0 ||
        !activeRequest ||
        didTrackShownRequestRef.current === activeRequest.id
      ) {
        return;
      }

      didTrackShownRequestRef.current = activeRequest.id;
      shownAtRef.current = Date.now();
      markMonetizationSurfaceShown("teaser");
      track(ANALYTICS_EVENTS.premiumPromptShown.key, {
        ...getMonetizationContextProperties(),
        moment: activeRequest.moment,
        source: "automatic",
      });
    },
    [track]
  );

  const handleDismissed = useCallback(() => {
    const activeRequest = activeTeaserRequestRef.current;
    if (!activeRequest) return;

    if (!suppressDismissAnalyticsRef.current && shownAtRef.current != null) {
      track(ANALYTICS_EVENTS.premiumPromptDismissed.key, {
        dismiss_method: dismissMethodRef.current,
        moment: activeRequest.moment,
        source: "automatic",
        time_visible_ms: Math.max(0, Date.now() - shownAtRef.current),
      });
    }

    shownAtRef.current = null;
    activeTeaserRequestRef.current = null;
    resolveRequest(activeRequest.id);
  }, [resolveRequest, track]);

  const handleClose = useCallback(() => {
    dismissMethodRef.current = "close_button";
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleOpenPaywall = useCallback(() => {
    const activeRequest = activeTeaserRequestRef.current;
    if (!activeRequest) return;

    suppressDismissAnalyticsRef.current = true;
    track(ANALYTICS_EVENTS.premiumPromptClicked.key, {
      ...getMonetizationContextProperties(),
      moment: activeRequest.moment,
      source: "automatic",
      time_visible_ms:
        shownAtRef.current == null
          ? 0
          : Math.max(0, Date.now() - shownAtRef.current),
    });
    bottomSheetRef.current?.dismiss();
    router.push({
      pathname: "/paywall",
      params: {
        moment: "premium_prompt",
        presentation: "modal",
        source: "premium_prompt",
      },
    });
  }, [track]);

  const offer = getMonetizationContextProperties();
  const displayPrice =
    typeof offer.price_string === "string"
      ? offer.price_string
      : t("paywall.ctaFallbackPrice");

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      enableDynamicSizing
      enablePanDownToClose
      handleIndicatorStyle={styles.handle}
      onChange={handleSheetChanged}
      onDismiss={handleDismissed}
    >
      <BottomSheetView style={styles.content} testID="premium-teaser">
        <View style={styles.header}>
          <View style={styles.icon}>
            <MaterialCommunityIcons
              color={styles.iconGlyph.color}
              name="crown-outline"
              size={24}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            hitSlop={12}
            onPress={handleClose}
            testID="premium-teaser-close"
          >
            <MaterialCommunityIcons
              color={styles.closeGlyph.color}
              name="close"
              size={24}
            />
          </Pressable>
        </View>

        <View style={styles.copy}>
          <CText bold style={styles.title}>
            {t("paywall.teaserTitle", { price: displayPrice })}
          </CText>
          <CText style={styles.subtitle}>{t("paywall.teaserSubtitle")}</CText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleOpenPaywall}
          style={({ pressed }) => [
            styles.cta,
            pressed ? styles.pressed : null,
          ]}
          testID="premium-teaser-cta"
        >
          <CText semiBold style={styles.ctaLabel}>
            {t("paywall.teaserCta")}
          </CText>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

function useStyles() {
  return useResponsiveStyles(
    ({ accents, colors, radius, responsiveFont, spacing }) => ({
      sheetBackground: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: radius.xl,
        borderTopRightRadius: radius.xl,
      },
      handle: {
        backgroundColor: colors.borderSoft,
      },
      content: {
        gap: spacing.exact(18),
        paddingHorizontal: spacing.exact(24),
        paddingBottom: spacing.exact(32),
      },
      header: {
        alignItems: "center",
        flexDirection: "row",
        justifyContent: "space-between",
      },
      icon: {
        alignItems: "center",
        backgroundColor: accents.amber.wash,
        borderRadius: radius.pill,
        height: spacing.exact(44),
        justifyContent: "center",
        width: spacing.exact(44),
      },
      iconGlyph: {
        color: accents.amber.ink,
      },
      closeGlyph: {
        color: colors.textMuted,
      },
      copy: {
        gap: spacing.exact(6),
      },
      title: {
        color: colors.textPrimary,
        fontSize: responsiveFont(22),
        lineHeight: responsiveFont(28),
      },
      subtitle: {
        color: colors.textMuted,
        fontSize: responsiveFont(16),
        lineHeight: responsiveFont(24),
      },
      cta: {
        alignItems: "center",
        backgroundColor: accents.amber.fill,
        borderRadius: radius.pill,
        justifyContent: "center",
        minHeight: spacing.exact(52),
        paddingHorizontal: spacing.exact(24),
      },
      ctaLabel: {
        color: colors.onAccent,
        fontSize: responsiveFont(18),
        lineHeight: responsiveFont(24),
      },
      pressed: {
        opacity: 0.85,
      },
    })
  );
}
