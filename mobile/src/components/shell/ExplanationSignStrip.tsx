import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CText, useResponsiveStyles } from "../../portable-ui";
import { getSignDisplayName } from "../../features/road-signs/content/registry";
import { extractSignReferences } from "../../features/road-signs/sign-codes";
import { SignImage } from "../../features/road-signs/SignImage";
import { SignPlatePopup } from "./SignPlatePopup";

const TILE_SIZE = 72;

type ExplanationSignStripProps = {
  text: string | null | undefined;
  /** Sign already shown in the question body, so it is not repeated here. */
  excludeSignId?: string;
};

/**
 * Renders the road signs an explanation refers to by code, so the reader does
 * not have to remember what `B-20` looks like.
 */
export function ExplanationSignStrip({
  text,
  excludeSignId,
}: ExplanationSignStripProps) {
  const { i18n } = useTranslation();
  const styles = useStyles();
  const [activeSignId, setActiveSignId] = useState<string | null>(null);
  const signs = useMemo(
    () => extractSignReferences(text, excludeSignId),
    [excludeSignId, text]
  );

  if (signs.length === 0) {
    return null;
  }

  return (
    <>
      <View style={styles.divider} />
      <View style={styles.row}>
        {signs.map((sign) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={getSignDisplayName(
              sign.id,
              i18n.language,
              sign.code
            )}
            key={sign.id}
            onPress={() => setActiveSignId(sign.id)}
            style={({ pressed }) => [
              styles.tile,
              pressed ? styles.pressed : null,
            ]}
            testID={`explanation-sign-${sign.code}`}
          >
            <SignImage sign={sign} size={TILE_SIZE} />
            <CText style={styles.code}>{sign.code}</CText>
          </Pressable>
        ))}
      </View>

      <SignPlatePopup
        signId={activeSignId}
        visible={activeSignId != null}
        onClose={() => setActiveSignId(null)}
      />
    </>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, responsiveFont, spacing }) => ({
    divider: {
      alignSelf: "stretch",
      height: 1,
      marginTop: spacing.exact(16),
      backgroundColor: colors.line,
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "flex-start",
      justifyContent: "center",
      gap: spacing.exact(12),
      marginTop: spacing.exact(16),
    },
    tile: {
      alignItems: "center",
      gap: spacing.exact(4),
    },
    code: {
      fontSize: responsiveFont(12),
      lineHeight: responsiveFont(16),
      color: colors.ink2,
    },
    pressed: {
      opacity: 0.7,
    },
  }));
}
