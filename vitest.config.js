'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['tests/e2e/**', 'tests/helpers/**'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
