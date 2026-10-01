import AsyncStorage from "@react-native-async-storage/async-storage";

export const MONETIZATION_V2_COHORT_KEY = "prawko-monetization-v2-cohort";
export const MONETIZATION_V1_STORAGE_KEY = "prawko-monetization-v1";

export type MonetizationV2Cohort = "legacy" | "v2";

/**
 * Every install is Monetization V2. A previously stamped "legacy" cohort is
 * upgraded. The v1 blob argument is ignored; the storage wrapper still passes it.
 */
export async function stampMonetizationV2Cohort(_existingV1Json: string | null) {
  const current = await AsyncStorage.getItem(MONETIZATION_V2_COHORT_KEY);

  if (current === "v2") {
    return current;
  }

  await AsyncStorage.setItem(MONETIZATION_V2_COHORT_KEY, "v2");
  return "v2";
}

export async function readMonetizationV2Cohort(): Promise<MonetizationV2Cohort | null> {
  const current = await AsyncStorage.getItem(MONETIZATION_V2_COHORT_KEY);

  if (current === "legacy" || current === "v2") {
    return current;
  }

  return null;
}

export function createMonetizationV1Storage(base: {
  getItem: (name: string) => Promise<string | null>;
  setItem: (name: string, value: string) => Promise<void>;
  removeItem: (name: string) => Promise<void>;
}) {
  return {
    getItem: async (name: string) => {
      const value = await base.getItem(name);

      if (name === MONETIZATION_V1_STORAGE_KEY) {
        await stampMonetizationV2Cohort(value);
      }

      return value;
    },
    setItem: (name: string, value: string) => base.setItem(name, value),
    removeItem: (name: string) => base.removeItem(name),
  };
}
