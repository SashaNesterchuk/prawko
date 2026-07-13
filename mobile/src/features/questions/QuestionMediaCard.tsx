import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import type { SupportedLocale } from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";

import {
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useErrorLogger } from "../../providers/ErrorLoggingProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { useAppShellStore } from "../../state/app-shell";
import {
  buildQuestionMediaViewerParams,
  getQuestionDeliveryAssetUrl,
  getQuestionMediaPreviewUrl,
} from "./question-media";
import type { QuestionMedia } from "./types";

const MEDIA_HEIGHT = 220;

export function QuestionMediaCard({
  locale,
  media,
}: {
  locale: SupportedLocale;
  media: QuestionMedia;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const { captureError } = useErrorLogger();
  const enablePjmTracks = useAppShellStore((state) => state.enablePjmTracks);
  const { width: windowWidth } = useWindowDimensions();
  const styles = useStyles({ windowWidth });
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const didLogPreviewFailureRef = useRef(false);
  const refreshIconSize = responsiveFont(18);
  const playIconSize = responsiveFont(28);
  const zoomIconSize = responsiveFont(22);

  const previewUrl = getQuestionMediaPreviewUrl(media);
  const assetUrl = getQuestionDeliveryAssetUrl(media.asset);
  const primaryLabel =
    media.type === "image"
      ? t("question.media.primaryImageLabel")
      : t("question.media.primaryVideoLabel");
  const pjmActions = useMemo(
    () => (enablePjmTracks ? buildPjmActions(media, t) : []),
    [enablePjmTracks, media, t]
  );
  const hasPreview = Boolean(previewUrl) && !previewFailed;
  const isVideo = media.type === "video";
  const showVideoPlaceholder = isVideo && (!previewUrl || previewFailed);

  const openViewer = (asset: QuestionDeliveryAsset, label: string) => {
    router.push({
      pathname: "/modals/media-viewer",
      params: buildQuestionMediaViewerParams({
        asset,
        label,
      }),
    });
  };

  const retry = () => {
    setPreviewFailed(false);
    setIsLoaded(false);
    setReloadKey((value) => value + 1);
  };

  if (showVideoPlaceholder) {
    return (
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("question.media.openPreviewAccessibility", {
            type: t(`question.mediaTypes.${media.type}`),
          })}
          disabled={!assetUrl}
          onPress={() => openViewer(media.asset, primaryLabel)}
          style={({ pressed }) => [
            styles.frame,
            styles.videoPlaceholderFrame,
            pressed ? styles.mediaPressed : null,
          ]}
        >
          <Text style={styles.videoPlaceholderLabel}>{primaryLabel}</Text>
          <Text style={styles.videoPlaceholderBody}>
            {t("question.media.tapToOpen")}
          </Text>

          <View pointerEvents="none" style={styles.playBadge}>
            <MaterialCommunityIcons
              name="play"
              size={playIconSize}
              color={colors.textPrimary}
            />
          </View>

          {enablePjmTracks && pjmActions.length > 0 ? (
            <View style={styles.pjmOverlay}>
              {pjmActions.map((action) => {
                const isEnabled = Boolean(
                  getQuestionDeliveryAssetUrl(action.asset)
                );

                return (
                  <Pressable
                    key={`${action.shortLabel}:${action.asset.mediaKey}`}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    disabled={!isEnabled}
                    onPress={(event) => {
                      event.stopPropagation();
                      openViewer(action.asset, action.label);
                    }}
                    style={({ pressed }) => [
                      styles.pjmIconButton,
                      !isEnabled ? styles.pjmIconButtonDisabled : null,
                      pressed && isEnabled ? styles.pjmIconButtonPressed : null,
                    ]}
                  >
                    <Text style={styles.pjmIconGlyph}>{action.shortLabel}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </View>
    );
  }

  if (!hasPreview) {
    return (
      <View style={styles.root}>
        <View style={[styles.frame, styles.errorFrame]}>
          <Text style={styles.errorTitle}>
            {t("question.media.mediaUnavailableTitle")}
          </Text>
          <Text style={styles.errorBody}>
            {t("question.media.mediaUnavailableBody")}
          </Text>
          {__DEV__ && previewUrl ? (
            <Text selectable style={styles.debugUrl}>
              {previewUrl}
            </Text>
          ) : null}
          {previewUrl ? (
            <Pressable
              accessibilityRole="button"
              onPress={retry}
              style={({ pressed }) => [
                styles.retryButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={refreshIconSize}
                color={colors.textSecondary}
              />
              <Text style={styles.retryLabel}>{t("question.media.retry")}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("question.media.openPreviewAccessibility", {
          type: t(`question.mediaTypes.${media.type}`),
        })}
        disabled={!assetUrl}
        onPress={() => openViewer(media.asset, primaryLabel)}
        style={({ pressed }) => [
          styles.frame,
          pressed ? styles.mediaPressed : null,
        ]}
      >
        {!isLoaded ? <View style={styles.skeleton} pointerEvents="none" /> : null}

        <Image
          key={reloadKey}
          source={{ uri: previewUrl ?? undefined }}
          resizeMode="cover"
          style={styles.preview}
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setPreviewFailed(true);

            if (didLogPreviewFailureRef.current) {
              return;
            }

            didLogPreviewFailureRef.current = true;
            captureError({
              area: "question_media",
              eventName: "question_media_preview_failed",
              message: "Question media preview failed to load.",
              metadata: {
                locale,
                media_key: media.asset.mediaKey,
                media_type: media.type,
                source_kind: media.asset.sourceKind,
                storage_bucket: media.asset.storageBucket,
                storage_path: media.asset.storagePath,
                preview_url: previewUrl,
                asset_url: assetUrl,
              },
              severity: "warning",
            });
            if (__DEV__) {
              console.warn("[question_media] preview failed", {
                previewUrl,
                assetUrl,
              });
            }
          }}
        />

        {isVideo ? (
          <View pointerEvents="none" style={styles.playBadge}>
            <MaterialCommunityIcons
              name="play"
              size={playIconSize}
              color={colors.textPrimary}
            />
          </View>
        ) : (
          <View pointerEvents="none" style={styles.cornerButton}>
            <MaterialCommunityIcons
              name="magnify-plus-outline"
              size={zoomIconSize}
              color={colors.textPrimary}
            />
          </View>
        )}

        {enablePjmTracks && pjmActions.length > 0 ? (
          <View style={styles.pjmOverlay}>
            {pjmActions.map((action) => {
              const isEnabled = Boolean(
                getQuestionDeliveryAssetUrl(action.asset)
              );

              return (
                <Pressable
                  key={`${action.shortLabel}:${action.asset.mediaKey}`}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  disabled={!isEnabled}
                  onPress={(event) => {
                    event.stopPropagation();
                    openViewer(action.asset, action.label);
                  }}
                  style={({ pressed }) => [
                    styles.pjmIconButton,
                    !isEnabled ? styles.pjmIconButtonDisabled : null,
                    pressed && isEnabled ? styles.pjmIconButtonPressed : null,
                  ]}
                >
                  <Text style={styles.pjmIconGlyph}>{action.shortLabel}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

function buildPjmActions(
  media: QuestionMedia,
  t: (key: string, options?: Record<string, unknown>) => string
) {
  const actions: Array<{
    asset: QuestionDeliveryAsset;
    label: string;
    shortLabel: string;
  }> = [];

  if (media.pjm?.questionAsset) {
    actions.push({
      asset: media.pjm.questionAsset,
      label: t("question.media.pjmQuestionLabel"),
      shortLabel: "PJM",
    });
  }

  const answerAssets = media.pjm?.answerAssets ?? {};

  for (const answerSlot of ["A", "B", "C"] as const) {
    const asset = answerAssets[answerSlot];

    if (!asset) {
      continue;
    }

    actions.push({
      asset,
      label: t("question.media.pjmAnswerLabel", {
        answer: answerSlot,
      }),
      shortLabel: answerSlot,
    });
  }

  return actions;
}

function useStyles({ windowWidth }: { windowWidth: number }) {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    root: {
      width: windowWidth,
      alignSelf: "center",
    },
    frame: {
      width: windowWidth,
      height: spacing.exact(MEDIA_HEIGHT),
      alignSelf: "center",
      borderRadius: radius.xl,
      overflow: "hidden",
      backgroundColor: colors.paper,
    },
    mediaPressed: {
      opacity: 0.96,
    },
    skeleton: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.track,
    },
    preview: {
      width: "100%",
      height: "100%",
    },
    cornerButton: {
      position: "absolute",
      top: spacing.exact(12),
      right: spacing.exact(12),
      width: spacing.exact(40),
      height: spacing.exact(40),
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardMuted,
    },
    playBadge: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: spacing.exact(56),
      height: spacing.exact(56),
      marginTop: -spacing.exact(28),
      marginLeft: -spacing.exact(28),
      borderRadius: spacing.exact(28),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.cardMuted,
    },
    videoPlaceholderFrame: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.exact(8),
      paddingHorizontal: spacing.exact(24),
      backgroundColor: colors.track,
    },
    videoPlaceholderLabel: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
    },
    videoPlaceholderBody: {
      maxWidth: "78%",
      fontSize: responsiveFont(13),
      lineHeight: responsiveFont(18),
      color: colors.textMuted,
      textAlign: "center",
    },
    errorFrame: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.exact(24),
      gap: spacing.exact(8),
      backgroundColor: colors.track,
    },
    errorTitle: {
      fontSize: responsiveFont(16),
      lineHeight: responsiveFont(24),
      fontWeight: "600",
      color: colors.textPrimary,
      textAlign: "center",
    },
    errorBody: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      color: colors.textMuted,
      textAlign: "center",
    },
    debugUrl: {
      marginTop: spacing.exact(8),
      maxWidth: "92%",
      fontSize: responsiveFont(10),
      lineHeight: responsiveFont(14),
      color: colors.textSecondary,
      textAlign: "center",
    },
    retryButton: {
      marginTop: spacing.exact(8),
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.exact(8),
      paddingHorizontal: spacing.exact(16),
      paddingVertical: spacing.exact(12),
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
    },
    retryLabel: {
      fontSize: responsiveFont(14),
      fontWeight: "600",
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.85,
    },
    pjmIconButton: {
      width: spacing.exact(40),
      height: spacing.exact(40),
      borderRadius: spacing.exact(20),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.overlayInk,
      borderWidth: 1,
      borderColor: colors.borderInverseSoft,
    },
    pjmIconButtonDisabled: {
      opacity: 0.35,
    },
    pjmIconButtonPressed: {
      opacity: 0.88,
    },
    pjmIconGlyph: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      fontWeight: "800",
      color: colors.onAccent,
      letterSpacing: 0.4,
    },
    pjmOverlay: {
      position: "absolute",
      right: spacing.exact(12),
      bottom: spacing.exact(12),
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: spacing.exact(8),
      maxWidth: "70%",
    },
  }));
}
