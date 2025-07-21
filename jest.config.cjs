// jest.config.cjs
/**
 * @file Jest configuration for the DaitanJS monorepo.
 * @description This config uses moduleNameMapper to resolve workspace imports
 * and transformIgnorePatterns to handle ES modules in dependencies.
 * It uses CommonJS syntax (module.exports) to be compatible with Jest.
 */
module.exports = {
  // The test environment that will be used for testing.
  // 'node' is default, but some packages might override this with a docblock.
  testEnvironment: 'node',

  // Automatically clear mock calls, instances, and results before every test
  clearMocks: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: 'coverage',

  // A list of file extensions your modules use
  moduleFileExtensions: ['js', 'json', 'jsx', 'node'],

  // The glob patterns Jest uses to detect test files.
  // This will find any .test.js or .spec.js file in any package's src directory.
  testMatch: ['**/src/**/*.test.js', '**/src/**/*.spec.js'],

  // A map from regular expressions to paths to transformers.
  // We need babel-jest to handle modern JavaScript syntax.
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },

  // An array of glob patterns indicating a set of files for which coverage information should be collected.
  collectCoverageFrom: [
    'src/**/src/**/*.js',
    '!src/**/src/index.js',
    '!src/**/src/**/index.js',
    '!src/**/babel.config.cjs',
    '!src/knowledge/src/**/*.js', // knowledge package is mostly static data
    '!**/*.test.js',
    '!**/*.spec.js',
    '!**/node_modules/**',
  ],

  // FIX FOR MODULE RESOLUTION & ESM DEPENDENCIES
  transformIgnorePatterns: [
    // This pattern tells Jest to NOT ignore these specific ESM-only packages in node_modules,
    // allowing Babel to transpile them. Add other pure ESM packages here if they cause issues.
    '/node_modules/(?!chalk|inquirer|ora|node-fetch|data-uri-to-buffer|fetch-blob|formdata-polyfill)',
  ],

  moduleNameMapper: {
    // This handles deep imports like '@daitanjs/data/models' or '@daitanjs/data/caching'.
    // It maps them to the correct source file path inside the monorepo structure.
    '^@daitanjs/([a-zA-Z0-9_-]+)/(.*)$': '<rootDir>/src/$1/src/$2',
    // This handles main entry point imports like '@daitanjs/data'.
    '^@daitanjs/([a-zA-Z0-9_-]+)$': '<rootDir>/src/$1/src',

    // This is a common fix for pure ESM dependencies like 'chalk' and 'ora'
    // that use internal # imports, which Jest doesn't resolve by default.
    '#ansi-styles':
      '<rootDir>/node_modules/chalk/source/vendor/ansi-styles/index.js',
    '#supports-color':
      '<rootDir>/node_modules/chalk/source/vendor/supports-color/index.js',
  },

  verbose: true,
};
