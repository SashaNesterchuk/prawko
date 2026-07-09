const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");
const roadSignsDataRoot = path.resolve(workspaceRoot, "data/pl-road-signs-wikimedia");

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

config.watchFolders = [
  ...new Set([...config.watchFolders, roadSignsDataRoot]),
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
