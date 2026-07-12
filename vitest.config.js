'use strict';

const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.js'],
    exclude: ['tests/e2e/**'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
