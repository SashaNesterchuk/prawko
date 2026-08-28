const sharedAssets = {
  icon: "./assets/images/icon.png",
  splash: "./assets/images/splash-icon.png",
};

const prawko = {
  id: "prawko",
  productionReady: true,
  name: "Prawko",
  slug: "prawko",
  scheme: "prawko",
  iosBundleIdentifier: "com.mindjar.prawko",
  androidPackage: "com.mindjar.prawko",
  iosAppStoreUrl: "https://apps.apple.com/app/id6795258105",
  androidPlayStoreUrl: "https://play.google.com/store/apps/details?id=com.mindjar.prawko",
  easProjectId: "db4df591-0771-4d6f-a7bf-3fd1304bb080",
  submitIosAppId: "6795258105",
  questionSetKey: "pl-v2-current",
  defaultLocale: "ua",
  supportedLocales: ["pl", "ua", "en", "de", "es"],
  features: { roadSigns: true },
  assets: sharedAssets,
};

const czech = {
  id: "czech",
  productionReady: false,
  name: "Řidičák: Autoškola Testy 2026",
  displayName: "Řidičák",
  slug: "ridicak",
  scheme: "ridicak",
  iosBundleIdentifier: "com.mindjar.ridicak",
  androidPackage: "com.mindjar.ridicak",
  iosAppStoreUrl: null,
  androidPlayStoreUrl: null,
  easProjectId: null,
  submitIosAppId: null,
  iosSku: "ridicak-cz-ios",
  questionSetKey: "cz-v2-current",
  defaultLocale: "cs",
  supportedLocales: ["cs", "en"],
  features: { roadSigns: true },
  // Placeholder assets keep development builds usable. Production is blocked
  // until this variant receives its own native brand assets and EAS project.
  assets: sharedAssets,
};

const greece = {
  id: "greece",
  productionReady: false,
  name: "Driving Theory GR",
  slug: "driving-theory-gr",
  scheme: "drivingtheorygr",
  iosBundleIdentifier: "com.mindjar.drivingtheorygr",
  androidPackage: "com.mindjar.drivingtheorygr",
  iosAppStoreUrl: null,
  androidPlayStoreUrl: null,
  easProjectId: null,
  submitIosAppId: null,
  questionSetKey: "gr-v2-current",
  defaultLocale: "el",
  supportedLocales: ["el", "en"],
  features: { roadSigns: false },
  assets: sharedAssets,
};

const variants = { prawko, czech, greece };

function resolveMediaBaseUrl(variant) {
  // Prawko keeps the existing Polish CDN. Czech media lives in the separate
  // `czech-media-prod` R2 bucket; those objects 404 on media.mind-jar.com.
  if (variant.id === "prawko") {
    return process.env.EXPO_PUBLIC_MEDIA_BASE_URL || "";
  }

  if (variant.id === "czech") {
    return process.env.EXPO_PUBLIC_CZECH_MEDIA_BASE_URL || "";
  }

  return "";
}

function getVariantId(value) {
  return value && Object.hasOwn(variants, value) ? value : "prawko";
}

function getVariant(value) {
  const variant = variants[getVariantId(value)];
  return {
    ...variant,
    mediaBaseUrl: resolveMediaBaseUrl(variant),
  };
}

module.exports = { variants, getVariant, getVariantId, resolveMediaBaseUrl };
