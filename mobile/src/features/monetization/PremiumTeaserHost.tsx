import {
  BottomSheetBackdrop,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { LinearGradient } from "expo-linear-gradient";
import { router, usePathname, useSegments } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  InteractionManager,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ANALYTICS_EVENTS } from "../../analytics/catalog";
import { isHomeScreenFromSegments } from "../../analytics/screenRoutes";
import { AppButton } from "../../components/shell/AppButton";
import { NavigationButton } from "../../components/shell/NavigationButton";
import { CText, useResponsiveStyles } from "../../portable-ui";
import { useAnalytics } from "../../providers/AnalyticsProvider";
import { useTheme } from "../../providers/ThemeProvider";
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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = useMemo(
    () => Math.round(Math.max(380, windowHeight * 0.44)),
    [windowHeight]
  );
  const styles = useStyles(sheetHeight, insets.bottom);
  const snapPoints = useMemo(() => [sheetHeight], [sheetHeight]);
  const pathname = usePathname();
  const segments = useSegments();
  const isHomeScreen = isHomeScreenFromSegments(segments);
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
  const launchCount = useMonetizationStore((state) => state.launchCount);
  const requestSurface = useMonetizationStore(
    (state) => state.requestSurface
  );
  const setInstalledAt = useMonetizationStore(
    (state) => state.setInstalledAt
  );
  const didRecordLaunchRef = useRef(false);
  const didEvaluateAppOpenRef = useRef(false);
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
        recordLaunch();
      });
  }, [
    appShellHydrated,
    monetizationHydrated,
    recordLaunch,
    setInstalledAt,
  ]);

  useEffect(() => {
    if (
      didEvaluateAppOpenRef.current ||
      launchCount < 1 ||
      !appShellHydrated ||
      !monetizationHydrated ||
      !onboardingCompleted ||
      !isHomeScreen
    ) {
      return;
    }

    didEvaluateAppOpenRef.current = true;
    if (hasPlusAccess) {
      return;
    }

    const state = useMonetizationStore.getState();
    if (
      launchCount >= 2 &&
      (state.trainingCompletedLifetime > 0 ||
        state.examCompletedLifetime > 0)
    ) {
      requestSurface("teaser", "app_open");
    }
  }, [
    appShellHydrated,
    hasPlusAccess,
    isHomeScreen,
    launchCount,
    monetizationHydrated,
    onboardingCompleted,
    requestSurface,
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

    if (hasPlusAccess && pendingRequest.moment !== "manual_test") {
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

    if (pendingRequest.moment === "app_open" && !isHomeScreen) {
      return;
    }

    const delayMs = pendingRequest.moment === "manual_test" ? 0 : 200;
    let cancelled = false;
    const timeout = setTimeout(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        if (cancelled) return;

        if (
          pendingRequest.moment !== "manual_test" &&
          !canShowMonetizationSurface(
            pendingRequest.surface,
            Date.now(),
            pendingRequest.moment
          )
        ) {
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
    isHomeScreen,
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
        opacity={0.45}
        onPress={() => {
          dismissMethodRef.current = "outside_tap";
        }}
        pressBehavior="close"
      />
    ),
    []
  );

  const renderBackground = useCallback(
    (props: { style?: StyleProp<ViewStyle> }) => (
      <PremiumTeaserBackground style={props.style} />
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
      if (activeRequest.moment !== "manual_test") {
        markMonetizationSurfaceShown("teaser");
      }
      track(ANALYTICS_EVENTS.premiumPromptShown.key, {
        ...getMonetizationContextProperties(),
        moment: activeRequest.moment,
        source:
          activeRequest.moment === "manual_test" ? "manual_test" : "automatic",
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
        source:
          activeRequest.moment === "manual_test" ? "manual_test" : "automatic",
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
      source:
        activeRequest.moment === "manual_test" ? "manual_test" : "automatic",
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
      backgroundComponent={renderBackground}
      backgroundStyle={styles.sheetBackground}
      enableDynamicSizing={false}
      enablePanDownToClose
      handleComponent={null}
      onChange={handleSheetChanged}
      onDismiss={handleDismissed}
      snapPoints={snapPoints}
    >
      <View style={styles.content} testID="premium-teaser">
        <View style={styles.closeRow}>
          <NavigationButton
            accessibilityLabel={t("common.close")}
            onPress={handleClose}
            testID="premium-teaser-close"
            type="close"
          />
        </View>

        <View style={styles.copy}>
          <View style={styles.titleBlock}>
            <CText bold center s24 style={styles.title}>
              <MaterialCommunityIcons
                color={styles.iconGlyph.color}
                name="crown-outline"
                size={32}
              />   {t("paywall.comparisonTitle")}
            </CText>
          </View>

          <CText bold center s32 style={styles.price}>
            {t("paywall.priceHeadline", { price: displayPrice })}
          </CText>

          <CText center s18 style={styles.subtitle}>
            {t("paywall.subtitle")}
          </CText>
        </View>

        <AppButton
          label={t("paywall.teaserCta")}
          onPress={handleOpenPaywall}
          testID="premium-teaser-cta"
        />
      </View>
    </BottomSheetModal>
  );
}

function PremiumTeaserBackground({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) {
  const { accents, background, colors, radius } = useTheme();

  return (
    <Animated.View
      style={[
        style,
        {
          backgroundColor: colors.paper,
          borderTopLeftRadius: radius.xxxl,
          borderTopRightRadius: radius.xxxl,
          overflow: "hidden",
        },
      ]}
    >
      <LinearGradient
        colors={[accents.green.wash, background.end, colors.paper]}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.48, 1]}
        pointerEvents="none"
        start={{ x: 0.5, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

function useStyles(sheetHeight: number, bottomInset: number) {
  return useResponsiveStyles(
    ({ accents, colors, radius, spacing }) => ({
      sheetBackground: {
        backgroundColor: colors.paper,
        borderTopLeftRadius: radius.xxxl,
        borderTopRightRadius: radius.xxxl,
      },
      content: {
        height: sheetHeight,
        paddingBottom: spacing.exact(24) + bottomInset,
        paddingHorizontal: spacing.exact(24),
        paddingTop: spacing.exact(8),
      },
      closeRow: {
        alignItems: "flex-end",
      },
      copy: {
        flex: 1,
      },
      titleBlock: {
        marginBottom: spacing.exact(32),
        alignItems: "center",
      },
      title: {
        color: colors.textPrimary,
      },
      price: {
        color: colors.textPrimary,
        letterSpacing: -0.64,
        lineHeight: 36,
        marginBottom: spacing.exact(16),
      },
      subtitle: {
        color: colors.textSecondary,
      },
      iconGlyph: {
        color: accents.amber.fill,
      },
    })
  );
}
