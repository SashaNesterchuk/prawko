import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "../icons";
import {
  CText,
  getTypographyStyle,
  useResponsiveFonts,
  useResponsiveSpacing,
  useResponsiveStyles,
  withResponsiveFont,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";
import { useHomeStartSpotlightActive } from "./home-start-spotlight-chrome";

type TabsProps = ComponentProps<typeof Tabs>;
export type FloatingTabBarProps = Parameters<
  NonNullable<TabsProps["tabBar"]>
>[0];

const ROUTE_ICONS: Record<string, IconName> = {
  index: "home",
  learn: "book",
  signs: "roadSign",
  profile: "profile",
};

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: FloatingTabBarProps) {
  const theme = useTheme();
  const spacing = useResponsiveSpacing();
  const { responsiveFont } = useResponsiveFonts();
  const { bottom } = useSafeAreaInsets();
  const spotlightActive = useHomeStartSpotlightActive();
  const activePalette = theme.accents.green;
  const inactiveInk = theme.colors.ink3;
  const styles = useStyles({
    bottomPadding: Math.max(bottom, spacing.xxl),
  });

  return (
    <View
      pointerEvents={spotlightActive ? "none" : "box-none"}
      style={styles.wrap}
    >
      {spotlightActive ? null : (
        <LinearGradient
          colors={[`${theme.colors.paper}00`, theme.colors.paper]}
          end={{ x: 0.5, y: 1 }}
          locations={[0, 0.5]}
          pointerEvents="none"
          start={{ x: 0.5, y: 0 }}
          style={styles.fade}
        />
      )}
      <View
        style={[styles.menu, spotlightActive ? styles.menuQuiet : null]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color =
            isFocused && !spotlightActive ? activePalette.ink : inactiveInk;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const iconName = ROUTE_ICONS[route.name] ?? "home";

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[
                styles.tab,
                isFocused && !spotlightActive ? styles.tabActive : null,
              ]}
              testID={`tab-${route.name}`}
            >
              <Icon color={color} name={iconName} size={responsiveFont(24)} />
              <CText
                numberOfLines={1}
                style={[
                  styles.label,
                  isFocused && !spotlightActive
                    ? styles.labelActive
                    : styles.labelInactive,
                ]}
              >
                {label}
              </CText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function useStyles({
  bottomPadding,
}: {
  bottomPadding: number;
}) {
  return useResponsiveStyles(
    ({ colors, elevation, radius, responsiveFont, spacing, theme }) => ({
      wrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: spacing.xxl,
        paddingTop: spacing.xxl,
        paddingBottom: bottomPadding,
        backgroundColor: colors.transparent,
        overflow: "visible",
      },
      fade: {
        ...StyleSheet.absoluteFill,
      },
      menu: {
        flexDirection: "row",
        padding: spacing.xs,
        borderRadius: radius.xxxxl,
        backgroundColor: colors.white,
        ...elevation.raised,
      },
      menuQuiet: {
        backgroundColor: colors.surface,
        shadowOpacity: 0,
        elevation: 0,
        boxShadow: "none",
      },
      tab: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
        borderRadius: radius.xxxl,
        overflow: "hidden",
      },
      tabActive: {
        backgroundColor: theme.accents.green.soft,
      },
      label: {
        ...withResponsiveFont(getTypographyStyle("labelXS"), responsiveFont),
      },
      labelActive: {
        color: theme.accents.green.ink,
      },
      labelInactive: {
        color: colors.ink3,
      },
    })
  );
}
