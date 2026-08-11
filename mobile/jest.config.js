/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.(test|spec).(ts|tsx)"],
  clearMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "babel-jest",
      {
        babelrc: false,
        configFile: false,
        presets: [
          ["@babel/preset-env", { targets: { node: "current" } }],
          "@babel/preset-typescript",
        ],
      },
    ],
  },
  moduleNameMapper: {
    "^react-native$": "<rootDir>/src/features/ads/__tests__/mocks/react-native.ts",
    "^expo-router$": "<rootDir>/src/features/ads/__tests__/mocks/expo-router.ts",
  },
};
