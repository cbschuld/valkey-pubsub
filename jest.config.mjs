export default {
  preset: "ts-jest/presets/default-esm", // Still use ESM preset for base settings
  testEnvironment: "node",
  testMatch: ["<rootDir>/__tests__/*.test.ts"],
  moduleFileExtensions: ["ts", "js"],
  extensionsToTreatAsEsm: [".ts"], // Treat .ts files as ESM
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true, // Enable ESM support
        tsconfig: "<rootDir>/tsconfig.esm.json", // Use ESM-specific tsconfig
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
