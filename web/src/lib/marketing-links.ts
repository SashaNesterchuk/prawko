import { webEnv } from "./env";

const FALLBACK_SUPPORT_EMAIL = "hello@prawko.app";

export function getMarketingLinks() {
  const supportEmail =
    normalizeValue(webEnv.NEXT_PUBLIC_SUPPORT_EMAIL) ?? FALLBACK_SUPPORT_EMAIL;

  return {
    appStoreUrl:
      normalizeValue(webEnv.NEXT_PUBLIC_APPLE_APP_URL) ?? "/support",
    googlePlayUrl:
      normalizeValue(webEnv.NEXT_PUBLIC_GOOGLE_PLAY_URL) ?? "/support",
    schoolInquiryUrl:
      normalizeValue(webEnv.NEXT_PUBLIC_SCHOOL_INQUIRY_URL) ??
      `mailto:${supportEmail}?subject=Prawko%20school%20pilot`,
    supportEmail,
    supportEmailHref: `mailto:${supportEmail}`,
  };
}

function normalizeValue(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
