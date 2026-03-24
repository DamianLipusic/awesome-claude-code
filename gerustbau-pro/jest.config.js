/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Mock react-native polyfills and ESM packages that don't work in Node
    '^react-native-get-random-values$': '<rootDir>/src/__mocks__/react-native-get-random-values.js',
    '^uuid$': '<rootDir>/src/__mocks__/uuid.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        strict: true,
        esModuleInterop: true,
      },
    }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
