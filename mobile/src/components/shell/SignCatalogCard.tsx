import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Icon } from "../icons";

import { useResponsiveStyles } from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { getSignDisplayName } from "../../features/road-signs/content/registry";
import { SignImage } from "../../features/road-signs/SignImage";
import type { RoadSign } from "../../features/road-signs/types";

type SignCatalogCardProps = {
  sign: RoadSign;
  showWrongBadge?: boolean;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onPress?: () => void;
};

export function SignCatalogCard({
  sign,
  showWrongBadge = false,
  isBookmarked = false,
  onToggleBookmark,
  onPress,
}: SignCatalogCardProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const styles = useStyles();
  const displayName = getSignDisplayName(sign.id, i18n.language, sign.code);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={displayName}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
      testID={`sign-card-${sign.id}`}
    >
      <View style={styles.topRow}>
        <View style={styles.sideColumn}>
          <Text style={styles.code}>{sign.code}</Text>
        </View>

        <View style={styles.imageWrap}>
          <SignImage sign={sign} size={80} />
        </View>

        <View style={[styles.sideColumn, styles.sideColumnRight]}>
          <View style={styles.topActions}>
            {showWrongBadge ? (
              <Icon
                color={theme.accents.red.fill}
                name="bulletWrong"
                size={24}
              />
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isBookmarked
                  ? t("signs.removeBookmark")
                  : t("signs.bookmark")
              }
              accessibilityState={{ selected: isBookmarked }}
              disabled={!onToggleBookmark}
              hitSlop={8}
              onPress={(event) => {
                event.stopPropagation?.();
                onToggleBookmark?.();
              }}
              style={({ pressed }) => [
                styles.bookmarkHit,
                pressed ? styles.pressed : null,
              ]}
            >
              <Icon
                color={
                  isBookmarked
                    ? theme.accents.amber.fill
                    : theme.colors.ink2
                }
                name={isBookmarked ? "stateActive" : "stateDefault"}
                size={24}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={styles.name} numberOfLines={3}>
        {displayName}
      </Text>
    </Pressable>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => ({
    card: {
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      shadowColor: colors.shadow,
      shadowOpacity: 0.05,
      shadowRadius: spacing.exact(12),
      shadowOffset: { width: 0, height: spacing.exact(2) },
      elevation: 1,
    },
    pressed: {
      opacity: 0.92,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    sideColumn: {
      flex: 1,
    },
    sideColumnRight: {
      alignItems: "flex-end",
    },
    code: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "400",
      color: colors.ink2,
    },
    topActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    bookmarkHit: {
      padding: spacing.exact(4),
    },
    imageWrap: {
      width: spacing.exact(80),
      height: spacing.exact(80),
      alignItems: "center",
      justifyContent: "center",
    },
    name: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      fontWeight: "400",
      color: colors.ink,
      textAlign: "center",
    },
  }));
}
