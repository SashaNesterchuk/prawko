import { LogBox } from "react-native";

import { mobileEnv } from "../../config/env";

// Keep Maestro taps from hitting the yellow LogBox banner over footers/CTAs.
if (mobileEnv.enableE2ETestMode) {
  LogBox.ignoreAllLogs(true);
}
