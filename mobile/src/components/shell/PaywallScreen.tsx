import type { PropsWithChildren } from "react";
import { View } from "react-native";

import { useResponsiveStyles } from "../../portable-ui";

export function PaywallScreen({ children }: PropsWithChildren) {
  const styles = useStyles();
  return <View style={styles.root}>{children}</View>;
}

function useStyles() {
  return useResponsiveStyles(({ theme }) => ({
    root: {
      flex: 1,
      backgroundColor: theme.accents.green.fill,
    },
  }));
}
