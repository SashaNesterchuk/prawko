/**
 * AdServices attribution token. Loaded lazily so Jest never touches Expo native bindings.
 * The token is an install credential: do not log it or put it on an analytics event.
 */
export async function readAppleSearchAdsAttributionToken(): Promise<string> {
  const { requireOptionalNativeModule } = require("expo") as {
    requireOptionalNativeModule: <T>(name: string) => T | null;
  };
  const native = requireOptionalNativeModule<{
    getAttributionToken?: () => Promise<string>;
  }>("AppleSearchAds");

  if (!native?.getAttributionToken) {
    throw new Error("apple_search_ads_token_unavailable");
  }

  const token = await native.getAttributionToken();
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("apple_search_ads_token_unavailable");
  }

  return token;
}
