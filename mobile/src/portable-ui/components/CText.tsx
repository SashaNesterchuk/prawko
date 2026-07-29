import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@react-navigation/native";

import { useResponsiveFonts } from "../hooks/useResponsiveFonts";
import { useResponsiveStyles } from "../hooks/useResponsiveStyles";
import {
  getFontSizeMetrics,
  getTextSizeStyle,
  getTextWeightStyle,
  type TextSizeKey,
} from "../typography/styles";
import type { FontWeightKey } from "../typography/fontRegistry";

const sizes: TextSizeKey[] = [
  "s72",
  "s52",
  "s44",
  "s36",
  "s32",
  "s28",
  "s24",
  "s20",
  "s18",
  "s16",
  "s14",
  "s12",
  "s10",
];

export type CTextProps = TextProps & {
  color?: string;
  opacity?: number;
  dynamic?: TextStyle;
  ignoreStyles?: boolean;
  s72?: boolean;
  s52?: boolean;
  s44?: boolean;
  s36?: boolean;
  s32?: boolean;
  s28?: boolean;
  s24?: boolean;
  s20?: boolean;
  s18?: boolean;
  s16?: boolean;
  s14?: boolean;
  s12?: boolean;
  s10?: boolean;
  center?: boolean;
  right?: boolean;
  left?: boolean;
  responsive?: boolean;
  regular?: boolean;
  medium?: boolean;
  semiBold?: boolean;
  bold?: boolean;
  mono?: boolean;
  textStyle?: TextSizeKey;
};

interface TextSegment {
  text: string;
  bold?: boolean;
  medium?: boolean;
  semiBold?: boolean;
  regular?: boolean;
  mono?: boolean;
  dynamic?: boolean;
  size?: TextSizeKey;
  color?: string;
  opacity?: number;
}

function stripStyleTags(text: string) {
  const tagRegex =
    /<(style|bold|semiBold|medium|regular|mono)[^>]*>(.*?)<\/\1>/g;
  return text.replace(tagRegex, "$2");
}

function parseTextWithTags(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const tagRegex =
    /<(style|bold|semiBold|medium|regular|mono)([^>]*)>(.*?)<\/\1>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const beforeText = text.slice(lastIndex, match.index);
      if (beforeText.length > 0) {
        segments.push({ text: beforeText });
      }
    }

    const tagName = match[1];
    const attributes = match[2].trim();
    const content = match[3];
    const segment: TextSegment = { text: content };

    if (tagName === "style") {
      const attrs = attributes.split(/\s+/).filter((attr) => attr.length > 0);

      attrs.forEach((attr) => {
        if (attr.match(/^s(72|52|44|36|32|28|24|20|18|16|14|12|10)$/)) {
          segment.size = attr as TextSizeKey;
        } else if (attr === "bold") {
          segment.bold = true;
        } else if (attr === "semiBold") {
          segment.semiBold = true;
        } else if (attr === "medium") {
          segment.medium = true;
        } else if (attr === "regular") {
          segment.regular = true;
        } else if (attr === "mono") {
          segment.mono = true;
        } else if (attr === "dynamic") {
          segment.dynamic = true;
        } else if (attr.startsWith("opacity=")) {
          const opacityValue = Number.parseFloat(attr.split("=")[1] ?? "");
          if (!Number.isNaN(opacityValue)) {
            segment.opacity = opacityValue;
          }
        } else {
          segment.color = attr;
        }
      });
    } else if (tagName === "bold") {
      segment.bold = true;
    } else if (tagName === "semiBold") {
      segment.semiBold = true;
    } else if (tagName === "medium") {
      segment.medium = true;
    } else if (tagName === "regular") {
      segment.regular = true;
    } else if (tagName === "mono") {
      segment.mono = true;
    }

    segments.push(segment);
    lastIndex = tagRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    if (remainingText.length > 0) {
      segments.push({ text: remainingText });
    }
  }

  return segments.length > 0 ? segments : [{ text }];
}

function resolveWeightKey(props: CTextProps): FontWeightKey {
  if (props.bold) {
    return "bold";
  }

  if (props.semiBold) {
    return "semiBold";
  }

  if (props.medium) {
    return "medium";
  }

  if (props.mono) {
    return "mono";
  }

  if (props.regular) {
    return "regular";
  }

  return "regular";
}

function resolveSegmentWeight(segment: TextSegment): TextStyle {
  if (segment.bold) {
    return getTextWeightStyle("bold");
  }

  if (segment.semiBold) {
    return getTextWeightStyle("semiBold");
  }

  if (segment.medium) {
    return getTextWeightStyle("medium");
  }

  if (segment.mono) {
    return getTextWeightStyle("mono");
  }

  if (segment.regular) {
    return getTextWeightStyle("regular");
  }

  return getTextWeightStyle("regular");
}

function useAlignmentStyles() {
  return useResponsiveStyles(() => ({
    center: {
      textAlign: "center" as const,
    },
    right: {
      textAlign: "right" as const,
    },
    left: {
      textAlign: "left" as const,
    },
  }));
}

function useResolvedTextStyleParts({
  center,
  color,
  left,
  opacity,
  responsive,
  right,
  sizeKey,
  weightKey,
}: {
  center?: boolean;
  color?: string;
  left?: boolean;
  opacity?: number;
  responsive?: boolean;
  right?: boolean;
  sizeKey: TextSizeKey;
  weightKey: FontWeightKey;
}) {
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();
  const alignmentStyles = useAlignmentStyles();

  return React.useMemo(() => {
    const baseStyle = getTextSizeStyle(sizeKey);
    const baseNumeric = getFontSizeMetrics(sizeKey);
    const scaledBase =
      responsive === false
        ? undefined
        : {
            fontSize: responsiveFont(baseNumeric.fontSize),
            lineHeight: responsiveFont(baseNumeric.lineHeight),
          };
    const weightStyle = getTextWeightStyle(weightKey);
    const fontColor = {
      color: color || colors.text,
      opacity,
    };
    const alignmentStyle = center
      ? alignmentStyles.center
      : right
        ? alignmentStyles.right
        : left
          ? alignmentStyles.left
          : undefined;

    return {
      alignmentStyle,
      baseStyle,
      fontColor,
      scaledBase,
      weightStyle,
    };
  }, [
    alignmentStyles.center,
    alignmentStyles.left,
    alignmentStyles.right,
    center,
    color,
    colors.text,
    left,
    opacity,
    responsive,
    responsiveFont,
    right,
    sizeKey,
    weightKey,
  ]);
}

function useResolvedStyledSegments({
  children,
  dynamic,
  ignoreStyles,
  responsive,
  sizeKey,
}: {
  children: React.ReactNode;
  dynamic?: TextStyle;
  ignoreStyles: boolean;
  responsive?: boolean;
  sizeKey: TextSizeKey;
}) {
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();

  return React.useMemo(() => {
    if (typeof children !== "string" || ignoreStyles) {
      return null;
    }

    const segments = parseTextWithTags(children);
    const hasStyledSegments = segments.some(
      (segment) =>
        segment.bold ||
        segment.semiBold ||
        segment.medium ||
        segment.regular ||
        segment.mono ||
        segment.size ||
        segment.color ||
        segment.opacity !== undefined
    );

    const resolvedSegments = segments
      .filter((segment) => segment.text)
      .map((segment, index) => {
        const segmentSizeKey = segment.size ?? sizeKey;
        const segmentSize = getTextSizeStyle(segmentSizeKey);
        const segmentNumeric = getFontSizeMetrics(segmentSizeKey);
        const segmentScaled =
          responsive === false
            ? undefined
            : {
                fontSize: responsiveFont(segmentNumeric.fontSize),
                lineHeight: responsiveFont(segmentNumeric.lineHeight),
              };
        const segmentWeight = resolveSegmentWeight(segment);
        const segmentColor = segment.color
          ? {
              color:
                (colors as Record<string, string | undefined>)[segment.color] ??
                segment.color,
            }
          : undefined;
        const segmentOpacity =
          segment.opacity !== undefined ? { opacity: segment.opacity } : undefined;

        return {
          key: `${index}-${segment.text}`,
          style: [
            segmentSize,
            segmentScaled,
            segmentWeight,
            segmentColor,
            segmentOpacity,
            segment.dynamic ? dynamic : undefined,
          ],
          text: segment.text,
        };
      });

    return {
      hasStyledSegments,
      resolvedSegments,
    };
  }, [children, colors, dynamic, ignoreStyles, responsive, responsiveFont, sizeKey]);
}

export default function CText(props: CTextProps) {
  const {
    ignoreStyles = true,
    textStyle,
    style: propsStyle,
    children,
    responsive,
    ...rest
  } = props;

  const sizeProp = sizes.find((sizeKey) => props[sizeKey]);
  const sizeKey = sizeProp ?? textStyle ?? "s16";
  const weightKey = resolveWeightKey(props);
  const {
    alignmentStyle,
    baseStyle,
    fontColor,
    scaledBase,
    weightStyle,
  } = useResolvedTextStyleParts({
    center: props.center,
    color: props.color,
    left: props.left,
    opacity: props.opacity,
    responsive,
    right: props.right,
    sizeKey,
    weightKey,
  });
  const styledSegments = useResolvedStyledSegments({
    children,
    dynamic: props.dynamic,
    ignoreStyles,
    responsive,
    sizeKey,
  });

  if (typeof children === "string") {
    if (ignoreStyles) {
      return (
        <Text
          style={[
            baseStyle,
            scaledBase,
            weightStyle,
            alignmentStyle,
            fontColor,
            propsStyle,
          ]}
          {...rest}
        >
          {stripStyleTags(children)}
        </Text>
      );
    }

    if (
      styledSegments &&
      styledSegments.resolvedSegments.length === 1 &&
      !styledSegments.hasStyledSegments
    ) {
      return (
        <Text
          style={[
            baseStyle,
            scaledBase,
            weightStyle,
            alignmentStyle,
            fontColor,
            propsStyle,
          ]}
          {...rest}
        >
          {children}
        </Text>
      );
    }

    return (
      <Text
        style={[
          baseStyle,
          scaledBase,
          weightStyle,
          alignmentStyle,
          fontColor,
          propsStyle,
        ]}
        {...rest}
      >
        {styledSegments?.resolvedSegments.map((segment) => (
          <Text key={segment.key} style={segment.style}>
            {segment.text}
          </Text>
        ))}
      </Text>
    );
  }

  return (
    <Text
      style={[
        baseStyle,
        scaledBase,
        weightStyle,
        alignmentStyle,
        fontColor,
        propsStyle,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
