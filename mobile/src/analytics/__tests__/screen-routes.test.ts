import { ANALYTICS_SCREENS } from "../catalog";
import {
  analyticsPathFromSegments,
  resolveScreenRoute,
} from "../screenRoutes";

describe("analyticsPathFromSegments", () => {
  it("keeps the root gate as /", () => {
    expect(analyticsPathFromSegments([])).toBe("/");
    expect(analyticsPathFromSegments(["index"])).toBe("/index");
  });

  it("preserves Expo Router groups so Home is not /", () => {
    expect(analyticsPathFromSegments(["(tabs)"])).toBe("/(tabs)");
    expect(analyticsPathFromSegments(["(tabs)", "index"])).toBe(
      "/(tabs)/index"
    );
  });
});

describe("resolveScreenRoute", () => {
  it("maps the root gate to app_entry and the Home tab to home", () => {
    expect(resolveScreenRoute("/")).toMatchObject({
      routePattern: "/",
      screenName: ANALYTICS_SCREENS.appEntry,
    });
    expect(resolveScreenRoute("/index")).toMatchObject({
      routePattern: "/index",
      screenName: ANALYTICS_SCREENS.appEntry,
    });
    expect(resolveScreenRoute("/(tabs)")).toMatchObject({
      routePattern: "/(tabs)",
      screenName: ANALYTICS_SCREENS.home,
    });
    expect(resolveScreenRoute("/(tabs)/index")).toMatchObject({
      routePattern: "/(tabs)/index",
      screenName: ANALYTICS_SCREENS.home,
    });
  });

  it("maps grouped tab paths to the same screens as ungrouped ones", () => {
    expect(resolveScreenRoute("/(tabs)/learn").screenName).toBe(
      ANALYTICS_SCREENS.learn
    );
    expect(resolveScreenRoute("/learn").screenName).toBe(ANALYTICS_SCREENS.learn);
    expect(resolveScreenRoute("/(tabs)/profile").screenName).toBe(
      ANALYTICS_SCREENS.profile
    );
  });
});
