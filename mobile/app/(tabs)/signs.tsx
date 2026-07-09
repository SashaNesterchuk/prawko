import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";

import { GreenWaveScreen } from "../../src/components/shell/GreenWaveScreen";
import { useResponsiveStyles } from "../../src/portable-ui";
import { SignsHomeContent } from "../../src/features/road-signs/SignsHomeContent";

export default function SignsTabScreen() {
  const styles = useStyles();

  return (
    <GreenWaveScreen>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <SignsHomeContent />
      </SafeAreaView>
    </GreenWaveScreen>
  );
}

function useStyles() {
  return useResponsiveStyles(() => ({
    safeArea: {
      flex: 1,
    },
  }));
}
