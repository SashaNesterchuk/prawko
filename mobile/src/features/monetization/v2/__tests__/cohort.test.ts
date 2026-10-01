import {
  MONETIZATION_V2_COHORT_KEY,
  stampMonetizationV2Cohort,
} from "../cohort";

const mockMemory = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: async (key: string) => mockMemory.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    mockMemory.set(key, value);
  },
  removeItem: async (key: string) => {
    mockMemory.delete(key);
  },
}));

describe("monetization v2 cohort", () => {
  beforeEach(() => {
    mockMemory.clear();
  });

  it("puts every install on Monetization V2", async () => {
    await expect(stampMonetizationV2Cohort(null)).resolves.toBe("v2");
    await expect(stampMonetizationV2Cohort('{"state":{}}')).resolves.toBe("v2");
  });

  it("upgrades an install already stamped legacy", async () => {
    mockMemory.set(MONETIZATION_V2_COHORT_KEY, "legacy");

    await expect(stampMonetizationV2Cohort('{"state":{}}')).resolves.toBe("v2");
    expect(mockMemory.get(MONETIZATION_V2_COHORT_KEY)).toBe("v2");
  });
});
