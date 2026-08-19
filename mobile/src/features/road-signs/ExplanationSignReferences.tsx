import { View } from "react-native";

import { CText, getFontFamily, useResponsiveStyles } from "../../portable-ui";
import { getSignAssetComponent } from "./content/signAssets";
import { extractExplanationSignCodes } from "./explanation-sign-codes";

type ExplanationSignReferencesProps = {
  explanation: string;
};

/**
 * Renders the local sign artwork for explicitly referenced sign codes. The
 * source text remains readable on its own when no matching local asset exists.
 */
export function ExplanationSignReferences({
  explanation,
}: ExplanationSignReferencesProps) {
  const styles = useStyles();
  const signCodes = extractExplanationSignCodes(explanation).filter(
    (signCode) => Boolean(getSignAssetComponent(signCode))
  );

  if (signCodes.length === 0) {
    return null;
  }

  return (
    <View
      accessibilityLabel={`Знаки з пояснення: ${signCodes.join(", ")}`}
      style={styles.list}
      testID="question-explanation-signs"
    >
      {signCodes.map((signCode) => (
        <ExplanationSignReference key={signCode} signCode={signCode} />
      ))}
    </View>
  );
}

function ExplanationSignReference({ signCode }: { signCode: string }) {
  const styles = useStyles();
  const SvgComponent = getSignAssetComponent(signCode);

  if (!SvgComponent) {
    return null;
  }

  return (
    <View
      accessibilityLabel={`Знак ${signCode}`}
      style={styles.reference}
      testID={`question-explanation-sign-${signCode}`}
    >
      <View style={styles.signFrame}>
        <SvgComponent
          height={styles.signSize.width}
          preserveAspectRatio="xMidYMid meet"
          width={styles.signSize.width}
        />
      </View>
      <CText style={styles.signCode}>{signCode}</CText>
    </View>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing }) => {
    const signSize = spacing.exact(56);

    return {
      list: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.exact(10),
        marginTop: spacing.exact(12),
      },
      reference: {
        alignItems: "center",
        gap: spacing.exact(4),
      },
      signFrame: {
        alignItems: "center",
        backgroundColor: colors.paper,
        borderRadius: radius.md,
        height: signSize,
        justifyContent: "center",
        width: signSize,
      },
      signSize: {
        width: signSize - spacing.exact(8),
      },
      signCode: {
        color: colors.textSecondary,
        fontFamily: getFontFamily("semiBold"),
        fontSize: responsiveFont(11),
        lineHeight: responsiveFont(14),
      },
    };
  });
}
