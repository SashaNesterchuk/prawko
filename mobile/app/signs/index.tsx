import { Redirect } from "expo-router";
import { withRoadSignsFeature } from "../../src/app-config/with-road-signs-feature";

function SignsScreen() {
  return <Redirect href="/(tabs)/signs" />;
}

export default withRoadSignsFeature(SignsScreen);
