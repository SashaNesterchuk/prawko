import { shouldResetCountryScopedStores } from "../persist";

describe("shouldResetCountryScopedStores", () => {
  it("does not wipe stores on a fresh JS load of the same country", () => {
    expect(shouldResetCountryScopedStores(null, "PL")).toBe(false);
  });

  it("does not wipe stores when rehydrating the country already in memory", () => {
    expect(shouldResetCountryScopedStores("PL", "PL")).toBe(false);
  });

  it("resets stores only when switching away from a hydrated country", () => {
    expect(shouldResetCountryScopedStores("PL", "CZ")).toBe(true);
  });
});
