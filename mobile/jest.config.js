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
    "^@app-variant$": "<rootDir>/variants/prawko/runtime.ts",
    "^@app-road-sign-assets$": "<rootDir>/variants/prawko/road-sign-assets.ts",
    "^@app-road-sign-content$": "<rootDir>/variants/prawko/road-sign-content.ts",
    "^@app-road-sign-catalog$": "<rootDir>/variants/prawko/road-sign-catalog.ts",
    "^react-native$": "<rootDir>/src/features/ads/__tests__/mocks/react-native.ts",
    "^expo-router$": "<rootDir>/src/features/ads/__tests__/mocks/expo-router.ts",
  },
};
