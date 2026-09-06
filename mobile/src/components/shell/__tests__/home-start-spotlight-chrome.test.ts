import {
  getHomeStartSpotlightActive,
  setHomeStartSpotlightActive,
} from "../home-start-spotlight-chrome";

describe("home start spotlight chrome", () => {
  afterEach(() => {
    setHomeStartSpotlightActive(false);
  });

  it("marks the spotlight as active only while it is visible", () => {
    expect(getHomeStartSpotlightActive()).toBe(false);

    setHomeStartSpotlightActive(true);
    expect(getHomeStartSpotlightActive()).toBe(true);

    setHomeStartSpotlightActive(false);
    expect(getHomeStartSpotlightActive()).toBe(false);
  });
});
