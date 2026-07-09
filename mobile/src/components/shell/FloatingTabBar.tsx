import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "../icons";
import { greenWave, greenWaveAccent } from "../../theme/green-wave";

type TabsProps = ComponentProps<typeof Tabs>;
export type FloatingTabBarProps = Parameters<
  NonNullable<TabsProps["tabBar"]>
>[0];

const ACTIVE_INK = greenWaveAccent.green.ink;
const ACTIVE_BG = greenWaveAccent.green.soft;
const INACTIVE_INK = greenWave.color.inkMuted;

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
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { paddingBottom: bottom > 0 ? bottom : greenWave.spacing.md },
      ]}
    >
      <View style={styles.menu}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const color = isFocused ? ACTIVE_INK : INACTIVE_INK;
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
              <Icon color={color} name={iconName} size={24} />
              <Text
                numberOfLines={1}
                style={[styles.label, { color }]}
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

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: greenWave.spacing.xl,
    paddingTop: greenWave.spacing.sm,
    backgroundColor: "transparent",
  },
  menu: {
    flexDirection: "row",
    padding: greenWave.spacing.xs,
    borderRadius: 28,
    backgroundColor: "#ffffff",
    shadowColor: greenWave.color.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: greenWave.spacing.xs,
    paddingVertical: greenWave.spacing.sm,
    borderRadius: 24,
    overflow: "hidden",
  },
  tabActive: {
    backgroundColor: ACTIVE_BG,
  },
  label: {
    fontSize: 11,
    lineHeight: 12,
    fontWeight: "500",
  },
});
