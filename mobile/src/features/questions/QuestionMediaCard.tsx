import { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { SupportedLocale } from "@prawko/config";

import { AppCard } from "../../components/shell/AppCard";
import { useTheme } from "../../providers/ThemeProvider";
import {
  getQuestionDeliveryPosterUrl,
  getQuestionDeliveryAssetUrl,
  getQuestionMediaPjmSummary,
  getQuestionMediaPreviewUrl,
} from "./question-media";
import type { QuestionMedia } from "./types";

export function QuestionMediaCard({
  locale,
  media,
}: {
  locale: SupportedLocale;
  media: QuestionMedia;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);
  const [previewFailed, setPreviewFailed] = useState(false);

  const previewUrl = getQuestionMediaPreviewUrl(media);
  const assetUrl = getQuestionDeliveryAssetUrl(media.asset);
  const posterUrl = getQuestionDeliveryPosterUrl(media.asset);
  const pjmSummary = getQuestionMediaPjmSummary(media);
  const hasPreview = Boolean(previewUrl) && !previewFailed;

  return (
    <AppCard>
      <View style={styles.headerRow}>
        <View style={styles.headerMeta}>
          <Text style={styles.mediaTitle}>
            {t(`question.mediaTypes.${media.type}`)}
          </Text>
          <Text style={styles.mediaSubtitle}>
            {t(`question.media.sourceKinds.${media.asset.sourceKind}`)}
          </Text>
        </View>
        <View style={styles.pills}>
          <MediaPill label={t("question.media.deliveryReady")} />
          {media.type === "video" && posterUrl ? (
            <MediaPill label={t("question.media.posterReady")} accent />
          ) : null}
        </View>
      </View>

      {hasPreview ? (
        <Image
          source={{ uri: previewUrl ?? undefined }}
          resizeMode="cover"
          style={styles.preview}
          onError={() => setPreviewFailed(true)}
          accessibilityLabel={t("question.media.previewAccessibility", {
            type: t(`question.mediaTypes.${media.type}`),
            locale: locale.toUpperCase(),
          })}
        />
      ) : (
        <View style={styles.previewFallback}>
          <Text style={styles.previewFallbackTitle}>
            {t("question.media.previewUnavailable")}
          </Text>
          <Text style={styles.previewFallbackBody}>
            {previewUrl
              ? t("question.media.previewLoadFailed")
              : t("question.media.previewNotConfigured")}
          </Text>
        </View>
      )}

      <View style={styles.metaList}>
        <MetaRow
          label={t("question.media.bucketLabel")}
          value={media.asset.storageBucket}
        />
        <MetaRow
          label={t("question.media.storagePathLabel")}
          value={media.asset.storagePath}
          mono
        />
        {media.type === "video" && media.asset.posterStoragePath ? (
          <MetaRow
            label={t("question.media.posterPathLabel")}
            value={media.asset.posterStoragePath}
            mono
          />
        ) : null}
        <MetaRow
          label={t("question.media.originalFileLabel")}
          value={media.asset.originalFilename}
        />
        {assetUrl ? (
          <MetaRow
            label={t("question.media.publicUrlLabel")}
            value={assetUrl}
            mono
          />
        ) : null}
        {pjmSummary.hasQuestionTrack || pjmSummary.answerTrackCount > 0 ? (
          <MetaRow
            label={t("question.media.pjmLabel")}
            value={t("question.media.pjmSummary", {
              questionTrack: pjmSummary.hasQuestionTrack
                ? t("common.configured")
                : t("common.missing"),
              answerCount: pjmSummary.answerTrackCount,
            })}
          />
        ) : null}
      </View>
    </AppCard>
  );
}

function MetaRow({
  label,
  mono = false,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono ? styles.metaValueMono : null]}>
        {value}
      </Text>
    </View>
  );
}

function MediaPill({
  accent = false,
  label,
}: {
  accent?: boolean;
  label: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={[styles.pill, accent ? styles.pillAccent : null]}>
      <Text style={[styles.pillText, accent ? styles.pillTextAccent : null]}>
        {label}
      </Text>
    </View>
  );
}

const getStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    headerMeta: {
      flex: 1,
      gap: 4,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    mediaSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      fontWeight: "700",
    },
    mediaTitle: {
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "800",
      color: theme.colors.accent,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    metaLabel: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.colors.textMuted,
      fontWeight: "700",
      minWidth: 96,
    },
    metaList: {
      gap: 10,
    },
    metaRow: {
      gap: 6,
    },
    metaValue: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textPrimary,
    },
    metaValueMono: {
      fontFamily: "monospace",
      color: theme.colors.textSecondary,
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.colors.cardMuted,
    },
    pillAccent: {
      backgroundColor: "#DCEBE5",
    },
    pillText: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "800",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    pillTextAccent: {
      color: theme.colors.accent,
    },
    pills: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
      justifyContent: "flex-end",
    },
    preview: {
      width: "100%",
      height: 196,
      borderRadius: theme.radius.large,
      backgroundColor: theme.colors.cardMuted,
      marginBottom: 14,
    },
    previewFallback: {
      borderRadius: theme.radius.large,
      backgroundColor: theme.colors.cardMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      minHeight: 140,
      justifyContent: "center",
      padding: 18,
      marginBottom: 14,
      gap: 6,
    },
    previewFallbackBody: {
      fontSize: 14,
      lineHeight: 21,
      color: theme.colors.textSecondary,
    },
    previewFallbackTitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "800",
      color: theme.colors.textPrimary,
    },
  });
