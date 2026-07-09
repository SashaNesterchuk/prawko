import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { SafeAreaView } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import {
  getQuestionMediaViewerAssetUrl,
  getQuestionMediaViewerPreviewUrl,
  type QuestionMediaViewerParams,
} from "../../src/features/questions/question-media";
import { useErrorLogger } from "../../src/providers/ErrorLoggingProvider";
import { greenWave } from "../../src/theme/green-wave";

export default function MediaViewerModalScreen() {
  const { t } = useTranslation();
  const { captureError } = useErrorLogger();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const styles = useMemo(
    () => getStyles(windowWidth, windowHeight),
    [windowHeight, windowWidth]
  );
  const params = useLocalSearchParams<{
    label?: string | string[];
    mediaType?: string | string[];
    posterStorageBucket?: string | string[];
    posterStoragePath?: string | string[];
    storageBucket?: string | string[];
    storagePath?: string | string[];
  }>();
  const [previewFailed, setPreviewFailed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const viewer = useMemo(() => parseViewerParams(params), [params]);
  const previewUrl = getQuestionMediaViewerPreviewUrl(viewer);
  const assetUrl = getQuestionMediaViewerAssetUrl(viewer);
  const hasPreview = Boolean(previewUrl) && !previewFailed;
  const isVideo = viewer?.mediaType === "video";
  const title = viewer?.label ?? t("question.media.viewerTitle");
  const subtitle =
    viewer?.mediaType === "video"
      ? t("question.media.viewerVideoBody")
      : t("question.media.viewerImageBody");

  const handleOpenExternally = async () => {
    if (!viewer || !assetUrl) {
      return;
    }

    try {
      await Linking.openURL(assetUrl);
    } catch (error) {
      captureError({
        area: "question_media",
        error,
        eventName: "question_media_external_open_failed",
        message: "Failed to open question media in the system player.",
        metadata: {
          label: viewer.label,
          media_type: viewer.mediaType,
          storage_bucket: viewer.storageBucket,
          storage_path: viewer.storagePath,
        },
      });
    }
  };

  const retry = () => {
    setPreviewFailed(false);
    setIsLoaded(false);
    setReloadKey((value) => value + 1);
  };

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="dark" />

        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
            hitSlop={8}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.headerButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons color={greenWave.color.ink} name="close" size={22} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
        </View>

        <View style={styles.stage}>
          {!viewer ? (
            <View style={[styles.frame, styles.errorFrame]}>
              <Text style={styles.errorTitle}>
                {t("question.media.previewUnavailable")}
              </Text>
              <Text style={styles.errorBody}>
                {t("question.media.viewerMissingAsset")}
              </Text>
            </View>
          ) : !hasPreview ? (
            <View style={[styles.frame, styles.errorFrame]}>
              <Text style={styles.errorTitle}>
                {t("question.media.mediaUnavailableTitle")}
              </Text>
              <Text style={styles.errorBody}>
                {previewUrl
                  ? t("question.media.viewerLoadFailed")
                  : t("question.media.viewerMissingAsset")}
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
                    color={greenWave.color.inkSecondary}
                    name="refresh"
                    size={18}
                  />
                  <Text style={styles.retryLabel}>
                    {t("question.media.retry")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.frame}>
              {!isLoaded ? (
                <View pointerEvents="none" style={styles.skeleton} />
              ) : null}

              <Image
                key={reloadKey}
                resizeMode={isVideo ? "cover" : "contain"}
                source={{ uri: previewUrl ?? undefined }}
                style={styles.preview}
                onError={() => setPreviewFailed(true)}
                onLoad={() => setIsLoaded(true)}
              />

              {isVideo ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("question.media.viewerOpenExternal")}
                  disabled={!assetUrl}
                  onPress={() => void handleOpenExternally()}
                  style={({ pressed }) => [
                    styles.playBadge,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <MaterialCommunityIcons
                    color={greenWave.color.ink}
                    name="play"
                    size={32}
                  />
                </Pressable>
              ) : null}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {viewer && isVideo ? (
            <Pressable
              accessibilityRole="button"
              disabled={!assetUrl}
              onPress={() => void handleOpenExternally()}
              style={({ pressed }) => [
                styles.primaryButton,
                !assetUrl ? styles.primaryButtonDisabled : null,
                pressed && assetUrl ? styles.pressed : null,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {t("question.media.viewerOpenExternal")}
              </Text>
            </Pressable>
          ) : null}

          {isVideo ? (
            <Text style={styles.videoHint}>{t("question.media.videoHint")}</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function parseViewerParams(input: {
  label?: string | string[];
  mediaType?: string | string[];
  posterStorageBucket?: string | string[];
  posterStoragePath?: string | string[];
  storageBucket?: string | string[];
  storagePath?: string | string[];
}): QuestionMediaViewerParams | null {
  const label = getSingleParam(input.label)?.trim();
  const mediaType = getSingleParam(input.mediaType);
  const storageBucket = getSingleParam(input.storageBucket)?.trim();
  const storagePath = getSingleParam(input.storagePath)?.trim();
  const posterStorageBucket = getSingleParam(input.posterStorageBucket)?.trim();
  const posterStoragePath = getSingleParam(input.posterStoragePath)?.trim();

  if (
    !label ||
    (mediaType !== "image" && mediaType !== "video") ||
    !storageBucket ||
    !storagePath
  ) {
    return null;
  }

  return {
    label,
    mediaType,
    posterStorageBucket: posterStorageBucket || undefined,
    posterStoragePath: posterStoragePath || undefined,
    storageBucket,
    storagePath,
  };
}

function getSingleParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

const getStyles = (windowWidth: number, windowHeight: number) => {
  const frameHeight = Math.min(Math.max(windowHeight * 0.56, 280), 520);

  return StyleSheet.create({
    safeArea: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: greenWave.spacing.sm,
      paddingHorizontal: greenWave.spacing.xl,
      paddingTop: greenWave.spacing.sm,
      paddingBottom: greenWave.spacing.lg,
    },
    headerButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: greenWave.radius.md,
      backgroundColor: greenWave.color.surface,
    },
    headerCopy: {
      flex: 1,
      gap: greenWave.spacing.xs,
      paddingTop: greenWave.spacing.xs,
    },
    headerTitle: {
      fontSize: 20,
      lineHeight: 28,
      fontWeight: "700",
      letterSpacing: -0.4,
      color: greenWave.color.ink,
    },
    headerSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      color: greenWave.color.inkSecondary,
    },
    stage: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: greenWave.spacing.xl,
    },
    frame: {
      width: windowWidth - greenWave.spacing.xl * 2,
      height: frameHeight,
      alignSelf: "center",
      borderRadius: greenWave.radius.xl,
      overflow: "hidden",
      backgroundColor: greenWave.color.paper,
      shadowColor: greenWave.color.shadow,
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    preview: {
      width: "100%",
      height: "100%",
      backgroundColor: greenWave.color.track,
    },
    skeleton: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: greenWave.color.track,
    },
    playBadge: {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: 72,
      height: 72,
      marginTop: -36,
      marginLeft: -36,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.88)",
    },
    errorFrame: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: greenWave.spacing.xl,
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
    footer: {
      gap: greenWave.spacing.sm,
      paddingHorizontal: greenWave.spacing.xl,
      paddingTop: greenWave.spacing.lg,
      paddingBottom: greenWave.spacing.md,
    },
    primaryButton: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: greenWave.spacing.xl,
      paddingVertical: greenWave.spacing.md,
      borderRadius: greenWave.radius.pill,
      backgroundColor: greenWave.color.ink,
    },
    primaryButtonDisabled: {
      opacity: 0.45,
    },
    primaryButtonText: {
      fontSize: 16,
      lineHeight: 24,
      fontWeight: "600",
      color: greenWave.color.onAccent,
    },
    videoHint: {
      fontSize: 12,
      lineHeight: 16,
      textAlign: "center",
      color: greenWave.color.inkMuted,
    },
    pressed: {
      opacity: 0.88,
    },
  });
};
