import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import type { SupportedLocale } from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";

import { useErrorLogger } from "../../providers/ErrorLoggingProvider";
import { useAppShellStore } from "../../state/app-shell";
import { greenWave } from "../../theme/green-wave";
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
  const { captureError } = useErrorLogger();
  const enablePjmTracks = useAppShellStore((state) => state.enablePjmTracks);
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => getStyles(windowWidth), [windowWidth]);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const didLogPreviewFailureRef = useRef(false);

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
                size={18}
                color={greenWave.color.inkSecondary}
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
              },
              severity: "warning",
            });
          }}
        />

        {isVideo ? (
          <View pointerEvents="none" style={styles.playBadge}>
            <MaterialCommunityIcons
              name="play"
              size={28}
              color={greenWave.color.ink}
            />
          </View>
        ) : (
          <View pointerEvents="none" style={styles.cornerButton}>
            <MaterialCommunityIcons
              name="magnify-plus-outline"
              size={22}
              color={greenWave.color.ink}
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

const getStyles = (windowWidth: number) =>
  StyleSheet.create({
    root: {
      width: windowWidth,
      alignSelf: "center",
    },
    frame: {
      width: windowWidth,
      height: MEDIA_HEIGHT,
      alignSelf: "center",
      borderRadius: greenWave.radius.xl,
      overflow: "hidden",
      backgroundColor: greenWave.color.paper,
    },
    mediaPressed: {
      opacity: 0.96,
    },
    skeleton: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: greenWave.color.track,
    },
    preview: {
      width: "100%",
      height: "100%",
    },
    cornerButton: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.82)",
    },
    playBadge: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 56,
      height: 56,
      marginTop: -28,
      marginLeft: -28,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.82)",
    },
    errorFrame: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: greenWave.spacing.sm,
      backgroundColor: greenWave.color.track,
    },
    errorTitle: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "600",
      color: greenWave.color.ink,
      textAlign: "center",
    },
    errorBody: {
      fontSize: 14,
      lineHeight: 20,
      color: greenWave.color.inkMuted,
      textAlign: "center",
    },
    retryButton: {
      marginTop: greenWave.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: greenWave.spacing.sm,
      paddingHorizontal: greenWave.spacing.lg,
      paddingVertical: greenWave.spacing.md,
      borderRadius: greenWave.radius.pill,
      backgroundColor: greenWave.color.surface,
    },
    retryLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: greenWave.color.inkSecondary,
    },
    pressed: {
      opacity: 0.85,
    },
    pjmIconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(24, 32, 24, 0.78)",
      borderWidth: 1,
      borderColor: "rgba(248, 246, 240, 0.35)",
    },
    pjmIconButtonDisabled: {
      opacity: 0.35,
    },
    pjmIconButtonPressed: {
      opacity: 0.88,
    },
    pjmIconGlyph: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
      color: "#F8F6F0",
      letterSpacing: 0.4,
    },
    pjmOverlay: {
      position: "absolute",
      right: 12,
      bottom: 12,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-end",
      gap: 8,
      maxWidth: "70%",
    },
  });
