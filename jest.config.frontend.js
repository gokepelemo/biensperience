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
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/tests/__mocks__/fileMock.js',
    // Resolve @ark-ui/react subpath imports — Jest 27 can't handle wildcard exports patterns.
    // Special subpaths (non-component) must be listed before the catch-all.
    '^@ark-ui/react/anatomy$': '<rootDir>/node_modules/@ark-ui/react/dist/components/anatomy.cjs',
    '^@ark-ui/react/factory$': '<rootDir>/node_modules/@ark-ui/react/dist/components/factory.cjs',
    '^@ark-ui/react/environment$': '<rootDir>/node_modules/@ark-ui/react/dist/providers/environment/index.cjs',
    '^@ark-ui/react/locale$': '<rootDir>/node_modules/@ark-ui/react/dist/providers/locale/index.cjs',
    '^@ark-ui/react/utils$': '<rootDir>/node_modules/@ark-ui/react/dist/utils/index.cjs',
    // Catch-all: component subpaths (e.g. @ark-ui/react/menu → dist/components/menu/index.cjs)
    '^@ark-ui/react/(.+)$': '<rootDir>/node_modules/@ark-ui/react/dist/components/$1/index.cjs'
  },
  transform: {
    '^.+\\.(js|jsx|mjs|cjs)$': 'babel-jest'
  },
  transformIgnorePatterns: [
    // Transform ESM-only packages through babel-jest so Jest can parse them.
    // These packages ship "type": "module" in their package.json.
    '/node_modules/(?!(@chakra-ui|@ark-ui|proxy-compare|uqr|.*\\.mjs$))'
  ]
};
