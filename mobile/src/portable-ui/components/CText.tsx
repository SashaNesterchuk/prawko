import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "@react-navigation/native";

import { useResponsiveFonts } from "../hooks/useResponsiveFonts";
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
  italic?: boolean;
  boldItalic?: boolean;
  sansBoldItalic?: boolean;
  robotoSerifMediumItalic28?: boolean;
  light?: boolean;
  responsive?: boolean;
  regular?: boolean;
  medium?: boolean;
  bold?: boolean;
  textStyle?: TextSizeKey;
};

interface TextSegment {
  text: string;
  bold?: boolean;
  medium?: boolean;
  regular?: boolean;
  italic?: boolean;
  boldItalic?: boolean;
  sansBoldItalic?: boolean;
  robotoSerifMediumItalic28?: boolean;
  light?: boolean;
  dynamic?: boolean;
  size?: TextSizeKey;
  color?: string;
  opacity?: number;
}

function stripStyleTags(text: string) {
  const tagRegex =
    /<(style|bold|medium|regular|italic|light|boldItalic|sansBoldItalic|robotoSerifMediumItalic28)[^>]*>(.*?)<\/\1>/g;
  return text.replace(tagRegex, "$2");
}

function parseTextWithTags(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const tagRegex =
    /<(style|bold|medium|regular|italic|light|boldItalic|sansBoldItalic|robotoSerifMediumItalic28)([^>]*)>(.*?)<\/\1>/g;

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
        } else if (attr === "medium") {
          segment.medium = true;
        } else if (attr === "regular") {
          segment.regular = true;
        } else if (attr === "italic") {
          segment.italic = true;
        } else if (attr === "light") {
          segment.light = true;
        } else if (attr === "boldItalic") {
          segment.boldItalic = true;
        } else if (attr === "sansBoldItalic") {
          segment.sansBoldItalic = true;
        } else if (attr === "robotoSerifMediumItalic28") {
          segment.robotoSerifMediumItalic28 = true;
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
    } else if (tagName === "medium") {
      segment.medium = true;
    } else if (tagName === "regular") {
      segment.regular = true;
    } else if (tagName === "italic") {
      segment.italic = true;
    } else if (tagName === "light") {
      segment.light = true;
    } else if (tagName === "boldItalic") {
      segment.boldItalic = true;
    } else if (tagName === "sansBoldItalic") {
      segment.sansBoldItalic = true;
    } else if (tagName === "robotoSerifMediumItalic28") {
      segment.robotoSerifMediumItalic28 = true;
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

  if (props.medium) {
    return "medium";
  }

  if (props.regular) {
    return "regular";
  }

  if (props.light) {
    return "light";
  }

  if (props.italic) {
    return "italic";
  }

  if (props.boldItalic) {
    return "boldItalic";
  }

  if (props.sansBoldItalic) {
    return "sansBoldItalic";
  }

  if (props.robotoSerifMediumItalic28) {
    return "robotoSerifMediumItalic28";
  }

  return "regular";
}

function resolveSegmentWeight(segment: TextSegment): TextStyle {
  if (segment.bold) {
    return getTextWeightStyle("bold");
  }

  if (segment.medium) {
    return getTextWeightStyle("medium");
  }

  if (segment.italic) {
    return getTextWeightStyle("italic");
  }

  if (segment.boldItalic) {
    return getTextWeightStyle("boldItalic");
  }

  if (segment.light) {
    return getTextWeightStyle("light");
  }

  if (segment.sansBoldItalic) {
    return getTextWeightStyle("sansBoldItalic");
  }

  if (segment.robotoSerifMediumItalic28) {
    return getTextWeightStyle("robotoSerifMediumItalic28");
  }

  if (segment.regular) {
    return getTextWeightStyle("regular");
  }

  return getTextWeightStyle("regular");
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
  const { colors } = useTheme();
  const { responsiveFont } = useResponsiveFonts();

  const sizeProp = sizes.find((sizeKey) => props[sizeKey]);
  const sizeKey = sizeProp ?? textStyle ?? "s16";
  const baseStyle = getTextSizeStyle(sizeKey);
  const baseNumeric = getFontSizeMetrics(sizeKey);
  const scaledBase =
    responsive === false
      ? undefined
      : {
          fontSize: responsiveFont(baseNumeric.fontSize),
          lineHeight: responsiveFont(baseNumeric.lineHeight),
        };

  const weightStyle = getTextWeightStyle(resolveWeightKey(props));
  const fontColor = {
    color: props.color || colors.text,
    opacity: props.opacity,
  };
  const center = props.center ? { textAlign: "center" as const } : {};
  const right = props.right ? { textAlign: "right" as const } : {};
  const left = props.left ? { textAlign: "left" as const } : {};

  if (typeof children === "string") {
    if (ignoreStyles) {
      return (
        <Text
          style={[
            baseStyle,
            scaledBase,
            weightStyle,
            center,
            right,
            left,
            fontColor,
            propsStyle,
          ]}
          {...rest}
        >
          {stripStyleTags(children)}
        </Text>
      );
    }

    const segments = parseTextWithTags(children);
    const hasStyledSegments = segments.some(
      (segment) =>
        segment.bold ||
        segment.medium ||
        segment.regular ||
        segment.italic ||
        segment.boldItalic ||
        segment.sansBoldItalic ||
        segment.robotoSerifMediumItalic28 ||
        segment.light ||
        segment.size ||
        segment.color ||
        segment.opacity !== undefined
    );

    if (segments.length === 1 && !hasStyledSegments) {
      return (
        <Text
          style={[
            baseStyle,
            scaledBase,
            weightStyle,
            center,
            right,
            left,
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
          center,
          right,
          left,
          fontColor,
          propsStyle,
        ]}
        {...rest}
      >
        {segments.map((segment, index) => {
          if (!segment.text) {
            return null;
          }

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
            : {};
          const segmentOpacity =
            segment.opacity !== undefined ? { opacity: segment.opacity } : {};

          return (
            <Text
              key={`${index}-${segment.text}`}
              style={[
                segmentSize,
                segmentScaled,
                segmentWeight,
                segmentColor,
                segmentOpacity,
                segment.dynamic ? props.dynamic : undefined,
              ]}
            >
              {segment.text}
            </Text>
          );
        })}
      </Text>
    );
  }

  return (
    <Text
      style={[baseStyle, scaledBase, weightStyle, center, right, left, fontColor, propsStyle]}
      {...rest}
    >
      {children}
    </Text>
  );
}
