import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from "expo-router/react-navigation";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { InteractionManager, View } from "react-native";

import { AppButton } from "../src/components/shell/AppButton";
import { AppCard } from "../src/components/shell/AppCard";
import { AppScreen } from "../src/components/shell/AppScreen";
import { ProgressBar } from "../src/components/shell/ProgressBar";
import {
  ProfileSettingsGroup,
  ProfileSettingsRow,
} from "../src/components/shell/ProfileSettingsGroup";
import { LoadingStateView } from "../src/components/shell/StateViews";
import { mobileEnv } from "../src/config/env";
import {
  cancelOfflinePackDownload,
  clearOfflinePack,
  downloadOfflinePack,
  estimateOfflinePackDownloadBytes,
  formatOfflineBytes,
  getOfflinePackErrorMessage,
  isOfflinePackStorageLow,
  type OfflinePackSnapshot,
  type OfflinePackTransfer,
  readOfflinePackSnapshot,
  type OfflinePackError,
} from "../src/features/offline/offline-pack";
import { getQuestionBank } from "../src/features/questions/question-bank";
import {
  CText,
  getFontFamily,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../src/portable-ui";
import { useTheme } from "../src/providers/ThemeProvider";
import { useHasPlusAccess } from "../src/state/entitlements";
import { useAppShellStore } from "../src/state/app-shell";
import {
  useQuestionCatalogResolved,
  useQuestionCatalogStatus,
  useQuestionCatalogVersion,
} from "../src/state/question-catalog";
import {
  ANALYTICS_EVENTS,
  getAnalyticsErrorCode,
} from "../src/analytics/catalog";
import { useAnalytics } from "../src/providers/AnalyticsProvider";

type FeedbackState =
  | {
    kind: "error" | "info";
    message: string;
  }
  | null;

export default function OfflineModeScreen() {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const styles = useStyles();
  const { accents, colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const isFocused = useIsFocused();
  const hasPlusAccess = useHasPlusAccess();
  const iconSize = responsiveFont(18);
  const preferredCategory = useAppShellStore((state) => state.preferredCategory);
  const questionCatalogResolved = useQuestionCatalogResolved();
  const questionCatalogStatus = useQuestionCatalogStatus();
  const questionCatalogVersion = useQuestionCatalogVersion();
  const [snapshot, setSnapshot] = useState<OfflinePackSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const canUseCurrentCatalog =
    questionCatalogResolved &&
    (questionCatalogStatus === "remote" ||
      questionCatalogStatus === "offline" ||
      (mobileEnv.enableE2ETestMode && getQuestionBank().length > 0));

  useEffect(() => {
    if (!hasPlusAccess) {
      track(ANALYTICS_EVENTS.offlineAccessBlocked.key, {
        source: "offline_mode",
      });
      router.replace("/paywall");
    }
  }, [hasPlusAccess, track]);

  const refreshSnapshot = useCallback(async () => {
    // Paint metadata first — never block the screen on catalog hashing.
    const baseSnapshot = await readOfflinePackSnapshot({
      currentCategory: preferredCategory,
      questionBank: null,
    });
    setSnapshot(baseSnapshot);

    if (!canUseCurrentCatalog) {
      return;
    }

    const questionBank = getQuestionBank();
    if (questionBank.length === 0) {
      return;
    }

    // Size estimate for the download card (no signature hash).
    const estimatedSnapshot = await readOfflinePackSnapshot({
      currentCategory: preferredCategory,
      matchLiveCatalog: false,
      questionBank,
    });
    setSnapshot(estimatedSnapshot);

    if (!baseSnapshot.readyPack) {
      return;
    }

    // Yield so the screen can paint before the expensive catalog signature hash.
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });

    const matchedSnapshot = await readOfflinePackSnapshot({
      currentCategory: preferredCategory,
      matchLiveCatalog: true,
      questionBank,
    });
    setSnapshot(matchedSnapshot);
  }, [canUseCurrentCatalog, preferredCategory]);

  useEffect(() => {
    if (!isFocused || !hasPlusAccess) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void refreshSnapshot()
      .catch((error) => {
        if (!cancelled) {
          setFeedback({
            kind: "error",
            message: getOfflinePackErrorMessage(error),
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    hasPlusAccess,
    isFocused,
    preferredCategory,
    questionCatalogResolved,
    questionCatalogStatus,
    questionCatalogVersion,
    refreshSnapshot,
  ]);

  const handlePrimaryAction = async () => {
    const questionBank = getQuestionBank();
    const canDownload =
      canUseCurrentCatalog ||
      (mobileEnv.enableE2ETestMode && questionBank.length > 0);

    if (!canDownload) {
      setFeedback({
        kind: "info",
        message: t("offlineMode.catalogUnavailableBody"),
      });
      return;
    }

    setIsWorking(true);
    setFeedback(null);
    track(ANALYTICS_EVENTS.offlinePackDownloadStarted.key, {
      category: preferredCategory,
      question_count: questionBank.length,
    });

    try {
      await downloadOfflinePack({
        category: preferredCategory,
        questionBank,
        onProgress: (transfer) => {
          setSnapshot((current) =>
            current
              ? {
                ...current,
                transfer,
              }
              : current
          );
        },
      });
      await refreshSnapshot();
      track(ANALYTICS_EVENTS.offlinePackDownloadCompleted.key, {
        category: preferredCategory,
        question_count: questionBank.length,
      });
    } catch (error) {
      const offlineError = error as OfflinePackError;
      if (offlineError?.code === "cancelled") {
        track(ANALYTICS_EVENTS.offlinePackDownloadCancelled.key, {
          category: preferredCategory,
        });
      } else {
        track(ANALYTICS_EVENTS.offlinePackDownloadFailed.key, {
          category: preferredCategory,
          error_code: getAnalyticsErrorCode(error),
        });
        setFeedback({
          kind: "error",
          message: mapOfflineActionError(error, t),
        });
      }
      await refreshSnapshot();
    } finally {
      setIsWorking(false);
    }
  };

  const handleStopDownload = () => {
    cancelOfflinePackDownload();
    track(ANALYTICS_EVENTS.offlinePackDownloadCancelled.key, {
      category: preferredCategory,
      source: "stop_button",
    });
    if (!isWorking) {
      void refreshSnapshot().catch(() => {
        // Keep current UI if snapshot refresh fails after stop.
      });
    }
  };

  const handleClearPack = async () => {
    setIsWorking(true);
    setFeedback(null);

    try {
      await clearOfflinePack();
      track(ANALYTICS_EVENTS.offlinePackRemoved.key, {
        category: preferredCategory,
      });
    } catch (error) {
      track(ANALYTICS_EVENTS.offlinePackDownloadFailed.key, {
        category: preferredCategory,
        error_code: getAnalyticsErrorCode(error),
        operation: "remove",
      });
      setFeedback({
        kind: "error",
        message: getOfflinePackErrorMessage(error),
      });
    } finally {
      try {
        await refreshSnapshot();
      } catch {
        // Keep the previous feedback/error if snapshot refresh fails.
      }
      setIsWorking(false);
    }
  };

  if (!hasPlusAccess) {
    return (
      <AppScreen
        scroll={false}
        closeAccessibilityLabel={t("common.close")}
        closeTestID="offline-mode-close"
        onClose={() => router.back()}
        title={t("offlineMode.title")}
      >
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("offlineMode.subtitle", {
            category: preferredCategory,
          })}
        />
      </AppScreen>
    );
  }

  if (isLoading && !snapshot) {
    return (
      <AppScreen
        scroll={false}
        closeAccessibilityLabel={t("common.close")}
        closeTestID="offline-mode-close"
        onClose={() => router.back()}
        title={t("offlineMode.title")}
      >
        <LoadingStateView
          title={t("states.loadingTitle")}
          description={t("offlineMode.subtitle", {
            category: preferredCategory,
          })}
        />
      </AppScreen>
    );
  }

  const plan = snapshot?.plan ?? null;
  const readyPack = snapshot?.readyPack ?? null;
  const transfer = snapshot?.transfer ?? null;
  const progressPercent = getTransferPercent(transfer);
  const primaryLabel = getPrimaryActionLabel({
    hasStoredData: snapshot?.hasStoredData ?? false,
    isWorking,
    readyPackMatchesCurrentCatalog:
      snapshot?.readyPackMatchesCurrentCatalog ?? null,
    readyPackMatchesCurrentCategory:
      snapshot?.readyPackMatchesCurrentCategory ?? false,
    t,
    transfer,
  });
  const showRemoveAction =
    snapshot?.hasStoredData ?? Boolean(readyPack || transfer);
  const isDownloadInProgress =
    isWorking || transfer?.status === "downloading";
  const packState = getOfflinePackUiState({
    readyPackMatchesCurrentCategory:
      snapshot?.readyPackMatchesCurrentCategory ?? false,
    readyPackCategory: readyPack?.category ?? null,
    transfer,
  });
  const packQuestionCount = plan?.questionCount ?? readyPack?.questionCount ?? 0;
  const packAssetCount = plan?.assetCount ?? readyPack?.assetCount ?? 0;
  const packBytes =
    plan ? estimateOfflinePackDownloadBytes(plan) : readyPack?.totalBytes ?? 0;
  const freeSpace = snapshot?.availableDiskSpace ?? null;
  const storageLooksLow = isOfflinePackStorageLow(freeSpace, plan);
  const freeSpaceLabel =
    freeSpace === null
      ? t("offlineMode.storageUnknown")
      : formatOfflineBytes(freeSpace);

  const statusBody = getOfflineStatusBody({
    hasStoredData: snapshot?.hasStoredData ?? false,
    preferredCategory,
    readyPackCategory: readyPack?.category ?? null,
    readyPackMatchesCurrentCatalog:
      snapshot?.readyPackMatchesCurrentCatalog ?? null,
    readyPackMatchesCurrentCategory:
      snapshot?.readyPackMatchesCurrentCategory ?? false,
    t,
    transfer,
  });

  return (
    <AppScreen
      testID="screen-offline-mode"
      title={t("offlineMode.title")}
      subtitle={t("offlineMode.subtitle", {
        category: preferredCategory,
      })}
      closeAccessibilityLabel={t("common.close")}
      closeTestID="offline-mode-close"
      onClose={() => router.back()}
      footer={
        <View style={styles.footerStack}>
          {isDownloadInProgress ? (
            <>
              <AppButton
                disabled
                label={t("offlineMode.downloadingBadge")}
                testID="offline-mode-primary-action"
                onPress={() => undefined}
              />
              <AppButton
                testID="offline-mode-stop-action"
                variant="secondary"
                label={t("offlineMode.stopCta")}
                onPress={handleStopDownload}
              />
            </>
          ) : (
            <>
              <AppButton
                disabled={isWorking}
                label={primaryLabel}
                testID="offline-mode-primary-action"
                onPress={() => void handlePrimaryAction()}
              />
              {showRemoveAction ? (
                <AppButton
                  disabled={isWorking}
                  testID="offline-mode-remove-action"
                  variant="secondary"
                  label={t("offlineMode.removeCta")}
                  onPress={() => void handleClearPack()}
                />
              ) : null}
            </>
          )}
        </View>
      }
    >
      <View testID={`offline-mode-pack-state-${packState}`} style={styles.blockStack}>
        <AppCard>
          <CText style={styles.sectionLabel}>{t("offlineMode.statusTitle")}</CText>
          <CText style={styles.bodyText}>{statusBody}</CText>

          {transfer ? (
            <View style={styles.progressBlock}>
              <ProgressBar progress={progressPercent} />
              <CText style={styles.progressText}>
                {t("offlineMode.downloadedProgress", {
                  done: transfer.downloadedAssetCount,
                  total: transfer.targetAssetCount,
                })}
              </CText>
              <CText style={styles.progressText}>
                {formatOfflineBytes(transfer.downloadedBytes)} /{" "}
                {formatOfflineBytes(transfer.targetTotalBytes)}
              </CText>
              {transfer.status === "error" && transfer.lastError ? (
                <CText style={[styles.progressText, styles.errorText]}>
                  {t("offlineMode.transferError", {
                    message: transfer.lastError,
                  })}
                </CText>
              ) : null}
            </View>
          ) : null}
        </AppCard>

        <ProfileSettingsGroup>
          <ProfileSettingsRow
            title={t("offlineMode.questionsLabel")}
            value={String(packQuestionCount)}
            icon={
              <Ionicons
                color={colors.textSecondary}
                name="help-circle-outline"
                size={iconSize}
              />
            }
          />
          <ProfileSettingsRow
            title={t("offlineMode.assetsLabel")}
            value={String(packAssetCount)}
            icon={
              <Ionicons
                color={colors.textSecondary}
                name="images-outline"
                size={iconSize}
              />
            }
          />
          <ProfileSettingsRow
            title={t("offlineMode.requiredSpaceLabel")}
            value={formatOfflineBytes(packBytes)}
            icon={
              <Ionicons
                color={colors.textSecondary}
                name="cloud-download-outline"
                size={iconSize}
              />
            }
          />
          <ProfileSettingsRow
            title={t("offlineMode.freeSpaceLabel")}
            value={freeSpaceLabel}
            icon={
              <Ionicons
                color={colors.textSecondary}
                name="phone-portrait-outline"
                size={iconSize}
              />
            }
            isLast={!readyPack?.completedAt}
          />
          {readyPack?.completedAt ? (
            <ProfileSettingsRow
              title={t("offlineMode.lastUpdatedLabel")}
              value={readyPack.completedAt.slice(0, 10)}
              icon={
                <Ionicons
                  color={colors.textSecondary}
                  name="calendar-outline"
                  size={iconSize}
                />
              }
              isLast
            />
          ) : null}
        </ProfileSettingsGroup>
      </View>

      {storageLooksLow ? (
        <AppCard accent>
          <CText style={[styles.sectionLabel, { color: accents.red.ink }]}>
            {t("offlineMode.storageLowWarning")}
          </CText>
        </AppCard>
      ) : null}

      {!canUseCurrentCatalog && !readyPack ? (
        <AppCard accent>
          <CText style={styles.sectionLabel}>
            {t("offlineMode.catalogUnavailableTitle")}
          </CText>
          <CText style={styles.bodyText}>{t("offlineMode.catalogUnavailableBody")}</CText>
        </AppCard>
      ) : null}

      {readyPack &&
        readyPack.category !== preferredCategory &&
        canUseCurrentCatalog ? (
        <AppCard accent>
          <CText style={styles.sectionLabel}>
            {t("offlineMode.replaceCategoryNote")}
          </CText>
        </AppCard>
      ) : null}

      {feedback ? (
        <AppCard accent={feedback.kind === "info"}>
          <CText
            style={[
              styles.bodyText,
              feedback.kind === "error" ? styles.errorText : null,
            ]}
          >
            {feedback.message}
          </CText>
        </AppCard>
      ) : null}
    </AppScreen>
  );
}

function getOfflinePackUiState({
  readyPackCategory,
  readyPackMatchesCurrentCategory,
  transfer,
}: {
  readyPackCategory: string | null;
  readyPackMatchesCurrentCategory: boolean;
  transfer: OfflinePackTransfer | null;
}) {
  if (transfer?.status === "downloading") {
    return "downloading";
  }

  if (transfer) {
    return "incomplete";
  }

  if (readyPackMatchesCurrentCategory) {
    return "ready";
  }

  if (readyPackCategory) {
    return "other_category";
  }

  return "missing";
}

function getTransferPercent(transfer: OfflinePackTransfer | null) {
  if (!transfer) {
    return 0;
  }

  if (transfer.unknownSizeAssetCount > 0 && transfer.targetAssetCount > 0) {
    return Math.round(
      (transfer.downloadedAssetCount / Math.max(transfer.targetAssetCount, 1)) *
      100
    );
  }

  if (transfer.targetTotalBytes <= 0) {
    if (transfer.targetAssetCount <= 0) {
      return 0;
    }

    return Math.round(
      (transfer.downloadedAssetCount / Math.max(transfer.targetAssetCount, 1)) *
      100
    );
  }

  return Math.round(
    (transfer.downloadedBytes / Math.max(transfer.targetTotalBytes, 1)) * 100
  );
}

function getPrimaryActionLabel({
  hasStoredData,
  isWorking,
  readyPackMatchesCurrentCatalog,
  readyPackMatchesCurrentCategory,
  t,
  transfer,
}: {
  hasStoredData: boolean;
  isWorking: boolean;
  readyPackMatchesCurrentCatalog: boolean | null;
  readyPackMatchesCurrentCategory: boolean;
  t: ReturnType<typeof useTranslation>["t"];
  transfer: OfflinePackTransfer | null;
}) {
  if (isWorking || transfer?.status === "downloading") {
    return t("offlineMode.downloadingBadge");
  }

  if (transfer?.status === "error") {
    return t("offlineMode.resumeCta");
  }

  if (hasStoredData && !readyPackMatchesCurrentCategory) {
    return t("offlineMode.repairCta");
  }

  if (readyPackMatchesCurrentCategory && readyPackMatchesCurrentCatalog !== false) {
    return t("offlineMode.updateCta");
  }

  if (readyPackMatchesCurrentCategory && readyPackMatchesCurrentCatalog === false) {
    return t("offlineMode.updateCta");
  }

  return t("offlineMode.downloadCta");
}

function getOfflineStatusBody({
  hasStoredData,
  preferredCategory,
  readyPackCategory,
  readyPackMatchesCurrentCatalog,
  readyPackMatchesCurrentCategory,
  t,
  transfer,
}: {
  hasStoredData: boolean;
  preferredCategory: string;
  readyPackCategory: string | null;
  readyPackMatchesCurrentCatalog: boolean | null;
  readyPackMatchesCurrentCategory: boolean;
  t: ReturnType<typeof useTranslation>["t"];
  transfer: OfflinePackTransfer | null;
}) {
  if (transfer?.status === "downloading") {
    return t("offlineMode.statusDownloading");
  }

  if (transfer?.status === "error") {
    return t("offlineMode.statusInterrupted");
  }

  if (readyPackMatchesCurrentCategory && readyPackMatchesCurrentCatalog === false) {
    return t("offlineMode.statusUpdateAvailable");
  }

  if (readyPackMatchesCurrentCategory) {
    return t("offlineMode.statusReady");
  }

  if (readyPackCategory) {
    return t("offlineMode.statusOtherCategory", {
      category: readyPackCategory,
    });
  }

  if (hasStoredData) {
    return t("offlineMode.statusNeedsRepair");
  }

  return t("offlineMode.statusNotDownloaded", {
    category: preferredCategory,
  });
}

function mapOfflineActionError(
  error: unknown,
  t: ReturnType<typeof useTranslation>["t"]
) {
  const offlineError = error as OfflinePackError;

  if (offlineError?.code === "storage_low") {
    return t("offlineMode.storageLowWarning");
  }

  if (offlineError?.code === "connectivity_required") {
    return t("offlineMode.internetRequiredBody");
  }

  if (offlineError?.code === "catalog_unavailable") {
    return t("offlineMode.catalogUnavailableBody");
  }

  return getOfflinePackErrorMessage(error);
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    footerStack: {
      gap: spacing.exact(10),
    },
    blockStack: {
      gap: spacing.exact(12),
    },
    sectionLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontFamily: getFontFamily("medium"),
      color: colors.textPrimary,
      marginBottom: spacing.exact(6),
    },
    bodyText: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontFamily: getFontFamily("regular"),
      color: colors.textSecondary,
    },
    progressBlock: {
      gap: spacing.exact(8),
      marginTop: spacing.exact(14),
    },
    progressText: {
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: colors.textSecondary,
    },
    errorText: {
      color: colors.warningInk,
    },
  }));
}
