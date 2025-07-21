// File: jest.config.js
export default {
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // An array of glob patterns indicating a set of files for which coverage information should be collected
  collectCoverageFrom: [
    'src/**/*.{js,jsx}', // Adjust if you have other file extensions
    '!src/**/*.d.ts',    // Exclude TypeScript definition files
    '!src/index.js',     // Often entry points don't have much testable logic
    '!**/node_modules/**',
    '!**/vendor/**',
    // Exclude test files themselves from coverage report
    '!src/**/*.test.js',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    // Exclude files that are hard to test or primarily configuration
    '!src/config/configManager.js', // ConfigManager relies heavily on process.env, better for integration/e2e
    '!src/intelligence/core/llmPricing.js', // Data-heavy, changes often
  ],

  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: ['json', 'text', 'lcov', 'clover', 'html'],

  // The test environment that will be used for testing
  testEnvironment: 'node',

  // Test spec file pattern
  testMatch: [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],

  // Support for ES Modules
  transform: {
    '^.+\\.jsx?$': 'babel-jest', // Use babel-jest for JS/JSX files
  },
  moduleFileExtensions: ['js', 'jsx', 'json', 'node'],

  // If you're using ES modules and jest has trouble with `import.meta.url` or similar:
  // Might not be needed with recent Jest versions and proper babel config.
  // transformIgnorePatterns: [
  //   '/node_modules/(?!your-es-module-dependency)/',
  // ],

  // Setup file - can be used for global mocks or environment setup
  // setupFilesAfterEnv: ['./jest.setup.js'], // Uncomment if you create this file

  // Clear mocks between every test for isolation
  clearMocks: true,

  // Automatically reset mock state before every test
  resetMocks: true,

  // Automatically restore mock state and implementation before every test
  restoreMocks: true,

  // Display individual test results with the test suite hierarchy
  verbose: true,
};