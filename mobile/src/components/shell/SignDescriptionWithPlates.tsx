import { useMemo, useState } from "react";

import { CText, useResponsiveStyles } from "../../portable-ui";
import { getRoadSignById } from "../../features/road-signs/catalog";
import { SignPlatePopup } from "./SignPlatePopup";

const SIGN_CODE_PATTERN = /\b([A-Z]-\d+[a-z]?)\b/g;

type SignDescriptionWithPlatesProps = {
  text: string;
  excludeSignId?: string;
};

type DescriptionPart =
  | { type: "text"; value: string }
  | { type: "chip"; value: string; signId: string };

function splitDescription(text: string, excludeSignId?: string): DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(SIGN_CODE_PATTERN)) {
    const code = match[1];
    const index = match.index ?? 0;

    if (index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, index) });
    }

    const sign = getRoadSignById(code);
    if (sign && sign.id !== excludeSignId) {
      parts.push({ type: "chip", value: code, signId: sign.id });
    } else {
      parts.push({ type: "text", value: code });
    }

    lastIndex = index + code.length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return parts;
}

export function SignDescriptionWithPlates({
  text,
  excludeSignId,
}: SignDescriptionWithPlatesProps) {
  const styles = useStyles();
  const [activeSignId, setActiveSignId] = useState<string | null>(null);
  const parts = useMemo(
    () => splitDescription(text, excludeSignId),
    [excludeSignId, text]
  );

  return (
    <>
      <CText style={styles.body}>
        {parts.map((part, index) => {
          if (part.type === "text") {
            return <CText key={`text-${index}`}>{part.value}</CText>;
          }

          return (
            <CText
              key={`chip-${part.signId}-${index}`}
              onPress={() => setActiveSignId(part.signId)}
              style={styles.chip}
            >
              {` ${part.value} `}
            </CText>
          );
        })}
      </CText>

      <SignPlatePopup
        signId={activeSignId}
        visible={activeSignId != null}
        onClose={() => setActiveSignId(null)}
      />
    </>
  );
}

function useStyles() {
  return useResponsiveStyles(({ colors, radius, responsiveFont, spacing, theme }) => ({
    body: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      color: colors.ink,
    },
    chip: {
      fontSize: responsiveFont(18),
      lineHeight: responsiveFont(28),
      color: colors.ink,
      backgroundColor: theme.accents.blue.soft,
      borderRadius: radius.pill,
      overflow: "hidden",
      paddingHorizontal: spacing.md,
    },
  }));
}
