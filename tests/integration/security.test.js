'use strict';

/* global describe, it, expect, beforeAll, afterAll */
const { createTestHarness } = require('../helpers/test-harness');

describe('Input validation and auth', () => {
  let harness;

  beforeAll(() => {
    harness = createTestHarness();
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  describe('Parameter validation', () => {
    it('should reject path traversal in db param', async () => {
      const res = await harness.agent.get('/restore?db=../../etc/passwd');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid db parameter');
    });

    it('should reject invalid characters in id param', async () => {
      const res = await harness.agent.get('/logger?id=../../../etc/passwd');
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid id parameter');
    });

    it('should allow valid db param', async () => {
      const res = await harness.agent.get('/restore?db=crontab.db');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('restore=crontab.db');
    });

    it('should allow valid id param', async () => {
      const res = await harness.agent.get('/logger?id=abc123_test-id');
      expect(res.status).toBe(200);
    });
  });
});

describe('Basic auth', () => {
  let harness;

  beforeAll(() => {
    harness = createTestHarness({ auth: { user: 'testuser', password: 'testpass' } });
  });

  afterAll(async () => {
    await harness.cleanup();
  });

  it('should reject unauthenticated requests', async () => {
    const res = await harness.agent.get('/');
    expect(res.status).toBe(401);
  });

  it('should allow authenticated requests', async () => {
    const res = await harness.agent
      .get('/')
      .auth('testuser', 'testpass');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Cron GUI');
  });
});
