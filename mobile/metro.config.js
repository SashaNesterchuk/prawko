const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const { getVariantId } = require("./variants/manifest.cjs");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const roadSignsDataRoots = [
  path.resolve(workspaceRoot, "data/pl-road-signs-wikimedia"),
  path.resolve(workspaceRoot, "data/cz-road-signs-dopravni-znaceni-eu"),
];
const variantRuntimePath = path.resolve(
  projectRoot,
  "variants",
  getVariantId(process.env.APP_VARIANT),
  "runtime.ts"
);
const variantRoadSignAssetsPath = path.resolve(
  projectRoot,
  "variants",
  getVariantId(process.env.APP_VARIANT),
  "road-sign-assets.ts"
);
const variantRoadSignContentPath = path.resolve(
  projectRoot,
  "variants",
  getVariantId(process.env.APP_VARIANT),
  "road-sign-content.ts"
);
const variantRoadSignCatalogPath = path.resolve(
  projectRoot,
  "variants",
  getVariantId(process.env.APP_VARIANT),
  "road-sign-catalog.ts"
);

const config = getDefaultConfig(projectRoot);

const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...resolver.sourceExts, "svg"],
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@app-variant") {
    return { type: "sourceFile", filePath: variantRuntimePath };
  }

  if (moduleName === "@app-road-sign-assets") {
    return { type: "sourceFile", filePath: variantRoadSignAssetsPath };
  }

  if (moduleName === "@app-road-sign-content") {
    return { type: "sourceFile", filePath: variantRoadSignContentPath };
  }

  if (moduleName === "@app-road-sign-catalog") {
    return { type: "sourceFile", filePath: variantRoadSignCatalogPath };
  }

  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

config.watchFolders = [
  ...new Set([...config.watchFolders, ...roadSignsDataRoots]),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.blockList = [
  ...(config.resolver.blockList ?? []),
  /\/ios\/Pods\//,
  /\/ios\/build\//,
  /\/android\/\.gradle\//,
  /\/android\/build\//,
  /\/android\/app\/build\//,
];

// Watchman startWatching() times out on this monorepo; Node crawling is reliable.
config.resolver.useWatchman = false;

module.exports = config;
