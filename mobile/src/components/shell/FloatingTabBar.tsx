import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "../icons";
import {
  useResponsiveFonts,
  useResponsiveSpacing,
  useResponsiveStyles,
} from "../../portable-ui";
import { useTheme } from "../../providers/ThemeProvider";

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
  const activePalette = theme.accents.green;
  const inactiveInk = theme.colors.inkMuted;
  const styles = useStyles({
    bottomPadding: bottom > 0 ? bottom : spacing.md,
  });

  return (
    <View
      pointerEvents="box-none"
      style={styles.wrap}
    >
      <View style={styles.menu}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? activePalette.ink : inactiveInk;
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
              style={[styles.tab, isFocused ? styles.tabActive : null]}
            >
              <Icon color={color} name={iconName} size={responsiveFont(24)} />
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  isFocused ? styles.labelActive : styles.labelInactive,
                ]}
              >
                {label}
              </Text>
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
  return useResponsiveStyles(({ colors, responsiveFont, spacing, theme }) => ({
    wrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.exact(24),
      paddingTop: spacing.sm,
      paddingBottom: bottomPadding,
      backgroundColor: colors.transparent,
    },
    menu: {
      flexDirection: "row",
      padding: spacing.xs,
      borderRadius: spacing.exact(28),
      backgroundColor: colors.surfaceStrong,
      shadowColor: colors.shadow,
      shadowOpacity: 0.1,
      shadowRadius: spacing.exact(18),
      shadowOffset: { width: 0, height: spacing.exact(14) },
      elevation: 8,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: spacing.exact(24),
      overflow: "hidden",
    },
    tabActive: {
      backgroundColor: theme.accents.green.soft,
    },
    label: {
      fontSize: responsiveFont(11),
      lineHeight: responsiveFont(12),
      fontWeight: "500",
    },
    labelActive: {
      color: theme.accents.green.ink,
    },
    labelInactive: {
      color: colors.inkMuted,
    },
  }));
}
