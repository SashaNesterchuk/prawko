import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEvent, useEventListener } from "expo";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import type { SupportedLocale } from "@prawko/config";
import type { QuestionDeliveryAsset } from "@prawko/schemas";

import {
  type PercentageString,
  useResponsiveFonts,
  useResponsiveStyles,
} from "../../portable-ui";
import { useErrorLogger } from "../../providers/ErrorLoggingProvider";
import { useTheme } from "../../providers/ThemeProvider";
import { useAppShellStore } from "../../state/app-shell";
import {
  buildQuestionMediaViewerParams,
  getQuestionDeliveryAssetUrl,
  getQuestionDeliveryPosterUrl,
  getQuestionMediaPreviewUrl,
} from "./question-media";
import type { QuestionMedia } from "./types";

const MEDIA_HEIGHT = 220;

/** Memoized: answering re-renders the trainer, but the media never changes. */
export const QuestionMediaCard = memo(function QuestionMediaCard({
  autoPlayVideo = false,
  locale,
  media,
  onVideoEnded,
  onVideoProgress,
  onVideoStarted,
  playbackLocked = false,
}: {
  autoPlayVideo?: boolean;
  locale: SupportedLocale;
  media: QuestionMedia;
  onVideoEnded?: () => void;
  onVideoProgress?: (progress: {
    currentTime: number;
    duration: number;
  }) => void;
  /** Fired the first time the learner starts playback (manual or autoplay). */
  onVideoStarted?: () => void;
  /** When true, hide play affordance and ignore taps (exam: no replay). */
  playbackLocked?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const { captureError } = useErrorLogger();
  const enablePjmTracks = useAppShellStore((state) => state.enablePjmTracks);
  const styles = useStyles();
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeVideoAsset, setActiveVideoAsset] =
    useState<QuestionDeliveryAsset | null>(
      media.type === "video" ? media.asset : null
    );
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
  const activeVideoUrl = activeVideoAsset
    ? getQuestionDeliveryAssetUrl(activeVideoAsset)
    : null;
  const activeVideoPosterUrl = activeVideoAsset
    ? getQuestionDeliveryPosterUrl(activeVideoAsset) ??
      (activeVideoAsset.mediaKey === media.asset.mediaKey ? previewUrl : null)
    : null;

  const openImageViewer = () => {
    router.push({
      pathname: "/modals/media-viewer",
      params: buildQuestionMediaViewerParams({
        asset: media.asset,
        label: primaryLabel,
      }),
    });
  };

  const playVideoAsset = (asset: QuestionDeliveryAsset) => {
    setActiveVideoAsset(asset);
  };

  const retry = () => {
    setPreviewFailed(false);
    setIsLoaded(false);
    setReloadKey((value) => value + 1);
  };

  const pjmOverlay =
    enablePjmTracks && pjmActions.length > 0 ? (
      <View style={styles.pjmOverlay}>
        {pjmActions.map((action) => {
          const isEnabled = Boolean(getQuestionDeliveryAssetUrl(action.asset));

          return (
            <Pressable
              key={`${action.shortLabel}:${action.asset.mediaKey}`}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              disabled={!isEnabled}
              onPress={(event) => {
                event.stopPropagation();
                playVideoAsset(action.asset);
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
    ) : null;

  if (activeVideoAsset && activeVideoUrl) {
    return (
      <View style={styles.root}>
        <InlineQuestionVideo
          key={activeVideoUrl}
          accessibilityLabel={t("question.media.playVideoAccessibility")}
          autoPlay={autoPlayVideo}
          onEnded={onVideoEnded}
          onProgress={onVideoProgress}
          onStarted={onVideoStarted}
          overlay={pjmOverlay}
          playbackLocked={playbackLocked}
          playIconSize={playIconSize}
          posterUrl={activeVideoPosterUrl}
          styles={styles}
          url={activeVideoUrl}
        />
      </View>
    );
  }

  if (isVideo && !activeVideoUrl) {
    return (
      <View style={styles.root}>
        <View style={[styles.frame, styles.errorFrame]}>
          <Text style={styles.errorTitle}>
            {t("question.media.mediaUnavailableTitle")}
          </Text>
          <Text style={styles.errorBody}>
            {t("question.media.mediaUnavailableBody")}
          </Text>
          {pjmOverlay}
        </View>
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
        onPress={openImageViewer}
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

        {pjmOverlay}
      </Pressable>

      <View style={styles.zoomRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("question.media.openPreviewAccessibility", {
            type: t(`question.mediaTypes.${media.type}`),
          })}
          disabled={!assetUrl}
          onPress={openImageViewer}
          style={({ pressed }) => [
            styles.zoomButton,
            pressed ? styles.pressed : null,
          ]}
        >
          <MaterialCommunityIcons
            name="magnify-plus-outline"
            size={zoomIconSize}
            color={colors.textPrimary}
          />
        </Pressable>
      </View>
    </View>
  );
});

function InlineQuestionVideo({
  accessibilityLabel,
  autoPlay,
  onEnded,
  onProgress,
  onStarted,
  overlay,
  playbackLocked,
  playIconSize,
  posterUrl,
  styles,
  url,
}: {
  accessibilityLabel: string;
  autoPlay: boolean;
  onEnded?: () => void;
  onProgress?: (progress: { currentTime: number; duration: number }) => void;
  onStarted?: () => void;
  overlay: ReactNode;
  playbackLocked: boolean;
  playIconSize: number;
  posterUrl: string | null;
  styles: ReturnType<typeof useStyles>;
  url: string;
}) {
  const { colors } = useTheme();
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
    instance.timeUpdateEventInterval = 0.1;
  });
  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });
  const [hasStarted, setHasStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const endedRef = useRef(false);
  const startedNotifiedRef = useRef(false);
  const onProgressRef = useRef(onProgress);
  const onStartedRef = useRef(onStarted);
  const showPoster = Boolean(posterUrl) && !hasStarted;
  const progressFraction =
    duration > 0 ? Math.max(0, Math.min(1, currentTime / duration)) : 0;
  const timelineStyles = useTimelineStyles({
    progressWidth: `${progressFraction * 100}%` as PercentageString,
  });

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  useEffect(() => {
    onStartedRef.current = onStarted;
  }, [onStarted]);

  function notifyStarted() {
    if (startedNotifiedRef.current) {
      return;
    }

    startedNotifiedRef.current = true;
    onStartedRef.current?.();
  }

  useEventListener(player, "timeUpdate", ({ currentTime: nextTime }) => {
    setCurrentTime(nextTime);
    const nextDuration = player.duration > 0 ? player.duration : duration;
    if (player.duration > 0) {
      setDuration(player.duration);
    }
    onProgressRef.current?.({
      currentTime: nextTime,
      duration: nextDuration,
    });
  });

  useEventListener(player, "sourceLoad", ({ duration: nextDuration }) => {
    if (nextDuration > 0) {
      setDuration(nextDuration);
      onProgressRef.current?.({
        currentTime: player.currentTime,
        duration: nextDuration,
      });
    }
  });

  useEventListener(player, "playToEnd", () => {
    const endedAt = player.duration || currentTime;
    setCurrentTime(endedAt);
    setHasStarted(true);
    onProgressRef.current?.({
      currentTime: endedAt,
      duration: player.duration || duration || endedAt,
    });

    if (endedRef.current) {
      return;
    }

    endedRef.current = true;
    onEnded?.();
  });

  useEffect(() => {
    endedRef.current = false;
    startedNotifiedRef.current = false;
  }, [url]);

  useEffect(() => {
    if (!autoPlay) {
      return;
    }

    endedRef.current = false;
    try {
      player.currentTime = 0;
    } catch {
      // Some platforms throw if the source is not ready yet.
    }
    setCurrentTime(0);
    player.play();
    setHasStarted(true);
    notifyStarted();
  }, [autoPlay, player]);

  const togglePlayback = () => {
    if (playbackLocked) {
      return;
    }

    if (isPlaying) {
      // One-shot exam videos: ignore pause while playing.
      return;
    }

    endedRef.current = false;
    player.play();
    setHasStarted(true);
    notifyStarted();
  };

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={togglePlayback}
        style={({ pressed }) => [
          styles.frame,
          pressed ? styles.mediaPressed : null,
        ]}
      >
        <VideoView
          allowsFullscreen={false}
          contentFit="cover"
          fullscreenOptions={{ enable: false }}
          nativeControls={false}
          player={player}
          style={styles.preview}
        />

        {showPoster ? (
          <Image
            resizeMode="cover"
            source={{ uri: posterUrl ?? undefined }}
            style={styles.posterOverlay}
          />
        ) : null}

        {!isPlaying && !playbackLocked ? (
          <View pointerEvents="none" style={styles.playBadge}>
            <MaterialCommunityIcons
              name="play"
              size={playIconSize}
              color={colors.textPrimary}
            />
          </View>
        ) : null}

        {overlay}
      </Pressable>

      <View style={timelineStyles.timeline}>
        <View style={timelineStyles.track}>
          <View style={timelineStyles.fill} />
        </View>
      </View>
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

function useTimelineStyles({
  progressWidth,
}: {
  progressWidth: PercentageString;
}) {
  return useResponsiveStyles(({ accents, colors, spacing }) => ({
    timeline: {
      width: "100%",
    },
    track: {
      width: "100%",
      height: spacing.exact(4),
      backgroundColor: colors.track,
      overflow: "hidden",
    },
    fill: {
      width: progressWidth,
      height: "100%",
      backgroundColor: accents.green.fill,
    },
  }));
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    root: {
      width: "100%",
      alignSelf: "stretch",
    },
    frame: {
      width: "100%",
      height: spacing.exact(MEDIA_HEIGHT),
      alignSelf: "stretch",
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
    posterOverlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: "100%",
      height: "100%",
    },
    zoomRow: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingTop: spacing.exact(8),
      paddingHorizontal: spacing.exact(4),
    },
    zoomButton: {
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
