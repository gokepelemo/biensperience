module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.worktrees/'],
  setupFilesAfterEnv: [],
  testTimeout: 30000,
  verbose: true,
  collectCoverageFrom: [
    'controllers/**/*.js',
    'routes/**/*.js',
    'utilities/**/*.js',
    '!**/node_modules/**',
    '!**/build/**',
    '!**/tests/**',
  ],
};
