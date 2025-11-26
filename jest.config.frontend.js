/**
 * Jest configuration for frontend tests (hooks, components, machines)
 */
module.exports = {
  testEnvironment: 'jsdom',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/hooks/**/*.test.js', '**/tests/machines/**/*.test.js', '**/tests/components/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.js'],
  testTimeout: 30000,
  verbose: true,
  collectCoverageFrom: [
    'src/hooks/**/*.js',
    'src/machines/**/*.js',
    'src/components/**/*.jsx',
    '!**/node_modules/**',
    '!**/build/**',
    '!**/tests/**',
  ],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/tests/__mocks__/fileMock.js'
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(.*\\.mjs$))'
  ]
};
