import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useResponsiveStyles } from "../../portable-ui";

const MEDIA_HEIGHT = 220;

export function QuestionMediaEmptyPlaceholder() {
  const { t } = useTranslation();
  const styles = useStyles();

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={t("question.media.noIllustration")}
      style={styles.root}
    >
      <View style={styles.frame}>
        <Text style={styles.label}>{t("question.media.noIllustration")}</Text>
      </View>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    root: {
      width: "100%",
      alignSelf: "stretch",
    },
    frame: {
      width: "100%",
      height: spacing.exact(MEDIA_HEIGHT),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.exact(32),
      backgroundColor: colors.ink2,
    },
    label: {
      fontSize: responsiveFont(14),
      lineHeight: responsiveFont(20),
      textAlign: "center",
      color: colors.paper,
    },
  }));
}
