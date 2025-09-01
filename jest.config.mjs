/**
 * @type {import('jest').Config}
 */
export default {
  clearMocks: true,
  collectCoverage: false,
  coverageDirectory: "coverage",
  coverageProvider: "v8",
  // ts-jest与@swc/jest二选一
  // preset: 'ts-jest',
  transform: {
    "^.+\\.(t|j)s$": "@swc/jest",
  },
  moduleNameMapper: {
    "@/(.*)": "<rootDir>/src/$1",
  },
  testMatch: ["<rootDir>/src/**/*/*.spec.ts"],
};
