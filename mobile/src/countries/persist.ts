import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_COUNTRY_CODE, type CountryCode } from "@prawko/config";

export function scopedPersistName(base: string, country: CountryCode) {
  return `${base}:${country}`;
}

/** Reset in-memory country stores only when leaving a previously hydrated country. */
export function shouldResetCountryScopedStores(
  lastHydratedCountry: CountryCode | null,
  nextCountry: CountryCode
) {
  return lastHydratedCountry != null && lastHydratedCountry !== nextCountry;
}

export async function migrateUnscopedPersistKey(
  base: string,
  country: CountryCode = DEFAULT_COUNTRY_CODE,
) {
  const scopedName = scopedPersistName(base, country);

  try {
    const [legacy, scoped] = await AsyncStorage.multiGet([base, scopedName]);
    const legacyValue = legacy?.[1];
    const scopedValue = scoped?.[1];

    if (legacyValue && !scopedValue) {
      await AsyncStorage.setItem(scopedName, legacyValue);
    }
  } catch (error) {
    console.warn(`Failed to migrate persist key "${base}".`, error);
  }
}
