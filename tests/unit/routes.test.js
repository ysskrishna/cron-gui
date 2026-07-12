'use strict';

/* global describe, it, expect */

describe('Routes module', () => {
  it('should export routes with base_url prefix', () => {
    const { routes, base_url } = require('../../routes');
    expect(routes.root).toBe(base_url + '/');
    expect(routes.save).toBe(base_url + '/save');
    expect(routes.backup).toBe(base_url + '/backup');
  });

  it('should export relative routes', () => {
    const { relative } = require('../../routes');
    expect(relative.save).toBe('save');
    expect(relative.backup).toBe('backup');
    expect(relative.restore_data).toBe('restore_data');
  });
});
